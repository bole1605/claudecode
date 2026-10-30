// Höflicher HTTP-Abruf: robots.txt wird respektiert, pro Host gedrosselt, mit Festplatten-Cache (spart Last und Zeit).
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';

export class RobotsError extends Error {}

export function parseRobots(txt, agent = 'konfiradbot') {
  const groups = []; let cur = null; const sitemaps = [];
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) { continue; }
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); }
    else if (k === 'sitemap') sitemaps.push(v);
    else if ((k === 'disallow' || k === 'allow') && cur) cur.rules.push({ allow: k === 'allow', path: v });
  }
  const mine = groups.filter((g) => g.agents.includes(agent));
  const rules = (mine.length ? mine : groups.filter((g) => g.agents.includes('*'))).flatMap((g) => g.rules).filter((r) => r.path);
  const toRe = (p) => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
  const compiled = rules.map((r) => ({ ...r, re: toRe(r.path) }));
  return {
    sitemaps,
    allowed(pathname) {
      const hit = compiled.filter((r) => r.re.test(pathname)).sort((a, b) => b.path.length - a.path.length)[0];
      return !hit || hit.allow;
    },
  };
}

export class PoliteFetcher {
  constructor({ fetchImpl = globalThis.fetch, userAgent = 'KonfiRadBot/0.1 (persönliche Kaufberatung; lokal)', delayMs = 1200, cacheDir = null, ttlMs = 24 * 3600_000 } = {}) {
    Object.assign(this, { fetch: fetchImpl, userAgent, delayMs, cacheDir, ttlMs });
    this.robots = new Map(); this.queues = new Map();
  }

  async throttled(host, fn) {
    const prev = this.queues.get(host) ?? Promise.resolve();
    const run = prev.then(async () => { const r = await fn(); await new Promise((res) => setTimeout(res, this.delayMs)); return r; });
    this.queues.set(host, run.catch(() => {}));
    return run;
  }

  async cachePath(url) { return this.cacheDir ? path.join(this.cacheDir, createHash('sha1').update(url).digest('hex') + '.txt') : null; }
  async fromCache(url) {
    const p = await this.cachePath(url); if (!p) return null;
    try { const s = await stat(p); if (Date.now() - s.mtimeMs < this.ttlMs) return await readFile(p, 'utf8'); } catch { /* kein Cache */ }
    return null;
  }
  async toCache(url, body) {
    const p = await this.cachePath(url); if (!p) return;
    try { await mkdir(this.cacheDir, { recursive: true }); await writeFile(p, body); } catch { /* ignorieren */ }
  }

  async raw(url, { binary = false } = {}) {
    const u = new URL(url);
    return this.throttled(u.host, async () => {
      const res = await this.fetch(url, { headers: { 'user-agent': this.userAgent, accept: 'text/html,application/xml,text/xml,application/xhtml+xml,*/*;q=0.5', 'accept-language': 'de-DE,de;q=0.9' }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status} für ${u.host}${u.pathname}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 6_000_000) throw new Error('Antwort zu groß');
      return binary ? buf : buf.toString('utf8');
    });
  }

  async getRobots(origin) {
    if (!this.robots.has(origin)) {
      this.robots.set(origin, (async () => {
        try { return parseRobots(await this.raw(origin + '/robots.txt'), 'konfiradbot'); }
        catch { return parseRobots('', 'konfiradbot'); } // keine robots.txt erreichbar → keine Einschränkung angegeben
      })());
    }
    return this.robots.get(origin);
  }

  /** Text-Abruf (HTML/XML), robots-konform und gecacht. */
  async get(url) {
    const u = new URL(url);
    const robots = await this.getRobots(u.origin);
    if (!robots.allowed(u.pathname + u.search)) throw new RobotsError(`robots.txt untersagt ${u.pathname}`);
    const cached = await this.fromCache(url);
    if (cached != null) return cached;
    let body;
    if (u.pathname.endsWith('.gz')) body = gunzipSync(await this.raw(url, { binary: true })).toString('utf8');
    else body = await this.raw(url);
    await this.toCache(url, body);
    return body;
  }
}
