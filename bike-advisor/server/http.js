import { readFile } from 'node:fs/promises';
import path from 'node:path';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };
export const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
};

export function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SECURITY_HEADERS });
  res.end(JSON.stringify(body));
}

export async function readJson(req, limit = 64 * 1024) {
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) { const e = new Error('Anfrage zu groß'); e.status = 413; throw e; }
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { const e = new Error('Ungültiges JSON'); e.status = 400; throw e; }
}

export async function serveStatic(res, roots, urlPath) {
  const rel = decodeURIComponent(urlPath.split('?')[0]);
  for (const [prefix, dir] of roots) {
    if (!(rel === prefix || rel.startsWith(prefix === '/' ? '/' : prefix + '/'))) continue;
    const sub = prefix === '/' ? rel : rel.slice(prefix.length);
    const file = path.normalize(path.join(dir, sub === '/' || sub === '' ? 'index.html' : sub));
    if (!file.startsWith(dir + path.sep)) continue; // Path-Traversal-Schutz
    try {
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache', ...SECURITY_HEADERS });
      return res.end(data);
    } catch { /* nächste Wurzel */ }
  }
  res.writeHead(404, { 'content-type': 'text/plain', ...SECURITY_HEADERS }); res.end('Not found');
}

/** Einfacher Fenster-Ratenbegrenzer pro Client-IP. */
export function rateLimiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= max) { hits.set(key, arr); return false; }
    arr.push(now); hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    return true;
  };
}
