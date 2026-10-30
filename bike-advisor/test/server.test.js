import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/index.js';
import { defaultAnswers } from '../shared/questionnaire.js';
import { extractJson } from '../server/providers/claudeWebProvider.js';
import { ClaudeWebProvider } from '../server/providers/claudeWebProvider.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

async function boot(overrides = {}) {
  const { server, config } = await createApp({ config: { catalogDir: fixtures, anthropicKey: '', ...overrides.config }, ...overrides });
  await new Promise((r) => server.listen(0, r));
  return { base: `http://localhost:${server.address().port}`, close: () => server.close(), config };
}
const valid = () => ({ ...defaultAnswers(), category: 'ebike', uses: { etrekking: 5 }, budget: { range: 'r2', condition: 'new' }, battery: { rangeKm: 80, assist: 'tour' } });
const poll = async (base, id) => {
  for (let i = 0; i < 50; i++) { const r = await (await fetch(`${base}/api/search/${id}`)).json(); if (r.status !== 'running') return r; await new Promise((r) => setTimeout(r, 20)); }
  throw new Error('timeout');
};

test('Suche mit Katalog liefert bewertete Ergebnisse, Fail-Bikes unten', async () => {
  const { base, close } = await boot();
  try {
    const { jobId } = await (await fetch(`${base}/api/search`, { method: 'POST', body: JSON.stringify({ answers: valid() }) })).json();
    const r = await poll(base, jobId);
    assert.equal(r.status, 'done');
    assert.equal(r.result.results[0].model, 'Fixture E-Trekking A');
    assert.equal(r.result.results[0].match.fails.length, 0);
    assert.ok(r.result.results.find((b) => b.model === 'Fixture E-Trekking B').match.score <= 64);
    assert.ok(r.result.results.every((b) => b.model !== 'Ungültig ohne URL'));
    assert.ok(r.result.valuePick);
  } finally { close(); }
});

test('Ohne Datenquelle: keine simulierten Ergebnisse', async () => {
  const { base, close } = await boot({ config: { catalogDir: '/nonexistent' } });
  try {
    const { jobId } = await (await fetch(`${base}/api/search`, { method: 'POST', body: JSON.stringify({ answers: valid() }) })).json();
    const r = await poll(base, jobId);
    assert.equal(r.result.unavailable, true);
    assert.equal(r.result.results.length, 0);
  } finally { close(); }
});

test('Ungültige Eingaben und Advisor ohne Key', async () => {
  const { base, close } = await boot();
  try {
    let r = await fetch(`${base}/api/search`, { method: 'POST', body: JSON.stringify({ answers: { category: 'ebike', ergo: { height: 1 } } }) });
    assert.equal(r.status, 422);
    r = await fetch(`${base}/api/search`, { method: 'POST', body: '{kaputt' });
    assert.equal(r.status, 400);
    r = await fetch(`${base}/api/advisor`, { method: 'POST', body: JSON.stringify({ question: 'Brauche ich 750 Wh?', answers: {} }) });
    assert.equal(r.status, 503);
    assert.equal((await fetch(`${base}/..%2f..%2fetc/passwd`)).status, 404);
    assert.equal((await fetch(`${base}/`)).status, 200);
  } finally { close(); }
});

test('Claude-Provider: Verifizierung nur bei bestätigter Produkt-URL', async () => {
  const bikesJson = { bikes: [
    { brand: 'T', model: 'Seen', type: 'etrekking', url: 'https://shop.test/seen', price: { amount: 2500 } },
    { brand: 'T', model: 'Unseen', type: 'etrekking', url: 'https://other.test/ghost', price: { amount: 2500 } },
  ] };
  const fetchMock = async () => ({ ok: true, json: async () => ({ stop_reason: 'end_turn', content: [
    { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://shop.test/seen' }] },
    { type: 'text', text: '```json\n' + JSON.stringify(bikesJson) + '\n```' },
  ] }) });
  const p = new ClaudeWebProvider({ anthropicKey: 'k', model: 'm', webSearchTool: 't', maxSearchRequests: 1 }, [], fetchMock);
  const spec = { budget: { min: 0, max: 3000 }, uses: [{ type: 'etrekking', weight: 5 }], drive: 'ebike', condition: 'new', brandsPreferred: [], brandsExcluded: [], equipment: { drivetrain: 'any', brakes: 'any', suspension: 'any' }, features: {}, ergo: {}, electric: false };
  const { bikes } = await p.search(spec);
  const by = Object.fromEntries(bikes.map((b) => [b.model, b.verification.status]));
  assert.equal(by.Seen, 'verified');
  assert.equal(by.Unseen, 'unverified');
});

test('extractJson', () => {
  assert.deepEqual(extractJson('text {"a":1} ende'), { a: 1 });
  assert.equal(extractJson('kein json'), null);
});
