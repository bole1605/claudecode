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
    brandsFile: e.BIKE_BRANDS_FILE || path.join(ROOT, 'data', 'brands.extra.json'),
  };
}
