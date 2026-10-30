import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { loadConfig, ROOT } from './config.js';
import { sendJson, readJson, serveStatic, rateLimiter } from './http.js';
import { createProviders } from './providers/index.js';
import { SearchService } from './services/searchService.js';
import { AdvisorService } from './services/advisorService.js';
import { validateAnswers } from '../shared/validate.js';
import { DEFAULT_BRANDS, mergeBrands } from '../shared/brands.js';

async function loadBrands(file) {
  try { return mergeBrands(DEFAULT_BRANDS, JSON.parse(await readFile(file, 'utf8'))); } catch { return [...DEFAULT_BRANDS]; }
}

export async function createApp(overrides = {}) {
  const config = { ...loadConfig(), ...overrides.config };
  const brands = await loadBrands(config.brandsFile);
  const providers = overrides.providers ?? createProviders(config, brands, overrides.fetch);
  const search = new SearchService(providers, config);
  const advisor = new AdvisorService(config, overrides.fetch);
  const searchLimit = rateLimiter(8, 10 * 60_000), advisorLimit = rateLimiter(40, 10 * 60_000);

  const handler = async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const ip = req.socket.remoteAddress ?? 'x';
    try {
      if (url.pathname.startsWith('/api/')) {
        if (req.method === 'GET' && url.pathname === '/api/health') return sendJson(res, 200, { providers: await search.status(), advisor: advisor.available });
        if (req.method === 'GET' && url.pathname === '/api/brands') return sendJson(res, 200, { brands: await loadBrands(config.brandsFile) });
        if (req.method === 'POST' && url.pathname === '/api/search') {
          if (!searchLimit(ip)) return sendJson(res, 429, { error: 'Zu viele Suchanfragen. Bitte später erneut versuchen.' });
          const body = await readJson(req);
          const v = validateAnswers(body.answers);
          if (!v.ok) return sendJson(res, 422, { error: 'Ungültige Eingaben', details: v.errors });
          if (!v.answers.uses || !Object.keys(v.answers.uses).length || !v.answers.category) return sendJson(res, 422, { error: 'Fahrradart und Einsatzzweck sind Pflicht' });
          const job = search.start(v.answers);
          return sendJson(res, 202, { jobId: job.id });
        }
        const m = url.pathname.match(/^\/api\/search\/([\w-]{36})$/);
        if (req.method === 'GET' && m) {
          const job = search.jobs.get(m[1]);
          if (!job) return sendJson(res, 404, { error: 'Suche nicht gefunden (abgelaufen?)' });
          return sendJson(res, 200, { status: job.status, progress: job.progress, error: job.error, result: job.status === 'done' ? job.result : null });
        }
        if (req.method === 'POST' && url.pathname === '/api/advisor') {
          if (!advisorLimit(ip)) return sendJson(res, 429, { error: 'Zu viele Fragen. Bitte später erneut versuchen.' });
          const body = await readJson(req);
          const q = typeof body.question === 'string' ? body.question.trim().slice(0, 500) : '';
          if (q.length < 3) return sendJson(res, 422, { error: 'Bitte eine Frage eingeben.' });
          const v = validateAnswers(body.answers ?? {});
          const history = Array.isArray(body.history) ? body.history.filter((h) => ['user', 'assistant'].includes(h?.role) && typeof h.content === 'string').map((h) => ({ role: h.role, content: h.content.slice(0, 1500) })) : [];
          return sendJson(res, 200, { answer: await advisor.ask(q, v.answers, history) });
        }
        return sendJson(res, 404, { error: 'Unbekannter Endpunkt' });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Methode nicht erlaubt' });
      return serveStatic(res, [['/shared', path.join(ROOT, 'shared')], ['/', path.join(ROOT, 'public')]], url.pathname);
    } catch (e) {
      const status = e.status ?? 500;
      if (!e.status) console.error(e);
      return sendJson(res, status, { error: status >= 500 && !e.status ? 'Interner Fehler' : e.message });
    }
  };
  return { server: http.createServer(handler), config, search };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, config } = await createApp();
  server.listen(config.port, () => console.log(`Bike Advisor läuft auf http://localhost:${config.port}`));
}
