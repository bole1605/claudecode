import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseRobots, PoliteFetcher } from '../server/lib/politeFetch.js';
import { extractProductMeta, extractSpecs, classify, parsePrice, htmlToText } from '../server/lib/htmlExtract.js';
import { WebsiteProvider, loc } from '../server/providers/websiteProvider.js';
import { UserStore } from '../server/services/userStore.js';
import { createApp } from '../server/index.js';

// TEST-FIXTURE: erfundener Shop, nur für Tests
const productHtml = (name, price, body) => `<html><head><title>x</title>
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name, brand: { name: 'Testmarke' }, image: '/img/a.jpg', offers: { '@type': 'Offer', price, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' } })}</script></head>
<body><h1>${name}</h1><p>${body}</p><script>var secret="100 Wh"</script></body></html>`;
const BODY = 'Bosch Performance Line CX Mittelmotor mit 85 Nm. Herausnehmbarer Akku mit 750 Wh. Gewicht: 26,4 kg. Hydraulische Scheibenbremsen. Federgabel, Federweg 100 mm. Kettenschaltung Shimano Deore 10-fach. Rahmen aus Aluminium. Mit Gepäckträger, Schutzblechen und StVZO-Beleuchtung. Rahmengröße: S M L';

async function shop() {
  const server = http.createServer((req, res) => {
    const base = `http://localhost:${server.address().port}`;
    const send = (t, body) => { res.writeHead(200, { 'content-type': t }); res.end(body); };
    if (req.url === '/robots.txt') return send('text/plain', `User-agent: *\nDisallow: /geheim/\nSitemap: ${base}/sitemap.xml`);
    if (req.url === '/sitemap.xml') return send('application/xml', `<urlset>${['/e-trekking/testmarke-trekker-2026', '/zubehoer/helm-trekking', '/geheim/e-trekking-x', '/e-bike/ohne-typ-info/ding'].map((p) => `<url><loc>${base}${p}</loc></url>`).join('')}</urlset>`);
    if (req.url === '/e-trekking/testmarke-trekker-2026') return send('text/html', productHtml('Testmarke Trekker E 2026', '2.799,00', BODY));
    res.writeHead(404); res.end();
  });
  await new Promise((r) => server.listen(0, r));
  return { server, base: `http://localhost:${server.address().port}` };
}
const spec = { uses: [{ type: 'etrekking', weight: 5 }], brandsPreferred: [], electric: true };

test('robots.txt-Parser: Allow/Disallow, Sitemap', () => {
  const r = parseRobots('User-agent: *\nDisallow: /a/\nAllow: /a/ok\nSitemap: https://x.test/s.xml');
  assert.equal(r.allowed('/b'), true); assert.equal(r.allowed('/a/x'), false); assert.equal(r.allowed('/a/ok/1'), true);
  assert.deepEqual(r.sitemaps, ['https://x.test/s.xml']);
  assert.equal(parseRobots('User-agent: konfiradbot\nDisallow: /\nUser-agent: *\nAllow: /').allowed('/x'), false);
});

test('Extraktion: JSON-LD, Preisformate, Textfelder, Klassifikation', () => {
  assert.equal(parsePrice('2.799,00'), 2799); assert.equal(parsePrice('2799.00'), 2799);
  const m = extractProductMeta(productHtml('Rad', '1999', 'x'), 'https://s.test/p');
  assert.equal(m.amount, 1999); assert.equal(m.brand, 'Testmarke'); assert.equal(m.image, 'https://s.test/img/a.jpg');
  const { specs, extracted } = extractSpecs(htmlToText(productHtml('Rad', '1', BODY)));
  assert.equal(specs.battery.wh, 750); assert.equal(specs.motor.torqueNm, 85); assert.equal(specs.motor.brand, 'Bosch'); assert.equal(specs.weightKg, 26.4);
  assert.equal(specs.brakes.type, 'hydraulic'); assert.equal(specs.suspension.type, 'fork'); assert.equal(specs.drivetrain.type, 'chain'); assert.equal(specs.drivetrain.gears, 10);
  assert.equal(specs.material, 'aluminium'); assert.deepEqual(specs.frameSizes, ['S', 'M', 'L']); assert.ok(specs.features.rack && specs.features.fenders && specs.features.lights);
  assert.ok(extracted.includes('battery.wh'));
  assert.ok(!htmlToText('<script>100 Wh</script>ok').includes('Wh'));
  // Mehrdeutigkeit → unbekannt statt geraten
  assert.equal(extractSpecs('Akku 500 Wh oder Akku 625 Wh oder 750 Wh').specs.battery, undefined);
  assert.deepEqual(classify('Testmarke Trekking E', true), { type: 'etrekking', drive: 'ebike' }) ;
  assert.equal(classify('Irgendein Produkt'), null);
});

test('WebsiteProvider: Sitemap → Seite → Bike; robots, Zubehör und Unklares werden ausgelassen', async () => {
  const { server, base } = await shop();
  try {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'kr-'));
    const file = path.join(dir, 'sources.json');
    await writeFile(file, JSON.stringify({ maxPages: 10, sources: [{ id: 't', label: 'Testshop', origin: base, brand: 'Testmarke' }] }));
    const p = new WebsiteProvider({ sourcesFile: file, siteDelayMs: 0, siteCacheDir: null });
    assert.deepEqual(await p.isAvailable(), { ok: true });
    const { bikes } = await p.search(spec);
    assert.equal(bikes.length, 1);
    const b = bikes[0];
    assert.equal(b.price.amount, 2799); assert.equal(b.type, 'etrekking'); assert.equal(b.drive, 'ebike'); assert.equal(b.battery.wh, 750);
    assert.equal(b.verification.status, 'verified'); assert.ok(b.verification.extractedFields.length >= 8);
    assert.equal(b.year, 2026); assert.ok(b.url.endsWith('/e-trekking/testmarke-trekker-2026'));
  } finally { server.close(); }
});

test('WebsiteProvider ohne Quellen: nicht verfügbar', async () => {
  const p = new WebsiteProvider({ sourcesFile: '/nonexistent.json', siteDelayMs: 0 });
  assert.equal((await p.isAvailable()).ok, false);
  assert.deepEqual(loc('<loc>https://a.test/x?a=1&amp;b=2</loc>'), ['https://a.test/x?a=1&b=2']);
});

test('PoliteFetcher: robots-Verbot wird respektiert', async () => {
  const { server, base } = await shop();
  try {
    const f = new PoliteFetcher({ delayMs: 0 });
    await assert.rejects(f.get(base + '/geheim/e-trekking-x'), /robots/);
  } finally { server.close(); }
});

test('UserStore + API: geräteübergreifende Ablage, PIN-Schutz', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kr-'));
  const { server } = await createApp({ config: { catalogDir: '/nonexistent', anthropicKey: '', appPin: '1234', userDataFile: path.join(dir, 's.json'), sourcesFile: '/nonexistent.json' } });
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/api/store`)).status, 401);
    assert.equal((await fetch(`${base}/api/store`, { headers: { 'x-app-pin': 'falsch' } })).status, 401);
    const h = { 'x-app-pin': '1234', 'content-type': 'application/json' };
    assert.equal((await fetch(`${base}/api/store`, { method: 'PUT', headers: h, body: JSON.stringify({ updatedAt: 5, data: { wishlist: [{ id: 'a' }], evil: 1 } }) })).status, 200);
    const got = await (await fetch(`${base}/api/store`, { headers: h })).json();
    assert.equal(got.updatedAt, 5); assert.deepEqual(got.data.wishlist, [{ id: 'a' }]); assert.ok(!('evil' in got.data));
    assert.equal((await fetch(`${base}/api/store`, { method: 'PUT', headers: h, body: JSON.stringify({ data: { saved: 'kein array' } }) })).status, 422);
    assert.equal((await (await fetch(`${base}/api/health`)).json()).pinRequired, true);
  } finally { server.close(); }
  assert.throws(() => UserStore.sanitize([]), /Ungültig/);
});

test('URL-Ranking: Blog-/Ratgeberseiten raus, Produktseiten mit Artikelnummer vorn', () => {
  const p = new WebsiteProvider({ sourcesFile: '/x', siteDelayMs: 0 });
  const urls = ['https://s.test/de-de/blog-content/mtb-news/mountainbike-oder-trekking-bike/b1.html', 'https://s.test/de-de/ratgeber/trekking-bike-kaufen', 'https://s.test/de-de/trekking-bikes/trekkingrad/pathlite/pathlite-7/3351.html', 'https://s.test/de-de/zubehoer/trekking-bike-schloss/1.html'];
  const ranked = p.rankUrls(urls, { uses: [{ type: 'trekking', weight: 5 }], brandsPreferred: [], electric: false }, { origin: 'https://s.test', includePaths: ['/de-de/'] });
  assert.deepEqual(ranked, ['https://s.test/de-de/trekking-bikes/trekkingrad/pathlite/pathlite-7/3351.html']);
  assert.equal(p.parsePage('<html><head><meta property="og:title" content="Ratgeber"></head></html>', 'https://s.test/x', { brand: 'T' }, {}), null);
});
