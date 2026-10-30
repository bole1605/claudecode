import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Minimaler .env-Loader (keine Abhängigkeiten). Bereits gesetzte Umgebungsvariablen haben Vorrang. */
function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export function loadConfig(env = process.env) {
  loadEnv(path.join(ROOT, '.env'));
  const e = { ...process.env, ...env };
  return {
    port: Number(e.PORT) || 3000,
    anthropicKey: e.ANTHROPIC_API_KEY || '',
    model: e.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    webSearchTool: e.ANTHROPIC_WEB_SEARCH_TOOL || 'web_search_20250305',
    maxSearchRequests: Math.min(Number(e.BIKE_SEARCH_MAX_REQUESTS) || 3, 6),
    cacheTtlMs: (Number(e.BIKE_CACHE_TTL_MIN) || 360) * 60_000,
    catalogDir: e.BIKE_CATALOG_DIR || path.join(ROOT, 'data', 'catalog'),
    sourcesFile: e.BIKE_SOURCES_FILE || path.join(ROOT, 'data', 'sources.json'),
    siteCacheDir: e.BIKE_SITE_CACHE_DIR || path.join(ROOT, 'data', 'cache'),
    siteDelayMs: Number(e.BIKE_SITE_DELAY_MS) || 1200,
    siteUserAgent: e.BIKE_USER_AGENT || 'KonfiRadBot/0.1 (persönliche Kaufberatung; lokal)',
    host: e.HOST || '127.0.0.1',
    appPin: e.APP_PIN || '',
    userDataFile: e.BIKE_USER_DATA || path.join(ROOT, 'data', 'user', 'store.json'),
    brandsFile: e.BIKE_BRANDS_FILE || path.join(ROOT, 'data', 'brands.extra.json'),
  };
}
