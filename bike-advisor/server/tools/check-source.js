// Prüft, ob eine Website für KonfiRad nutzbar ist:  npm run check-source -- https://www.beispiel.de
import { PoliteFetcher } from '../lib/politeFetch.js';
import { WebsiteProvider } from '../providers/websiteProvider.js';
import { loadConfig } from '../config.js';

const origin = process.argv[2]?.replace(/\/$/, '');
if (!origin) { console.error('Aufruf: npm run check-source -- https://www.beispiel.de'); process.exit(1); }
const cfg = loadConfig();
const fetcher = new PoliteFetcher({ delayMs: cfg.siteDelayMs, cacheDir: null, userAgent: cfg.siteUserAgent });
const p = new WebsiteProvider(cfg, fetcher);
const src = { id: 'check', label: origin, origin };
const robots = await fetcher.getRobots(origin);
console.log(`robots.txt: Sitemaps ${robots.sitemaps.length ? robots.sitemaps.join(', ') : '(keine angegeben → /sitemap.xml)'}`);
const urls = await p.sitemapUrls(src).catch((e) => { console.log('✗ Sitemap:', e.message); return []; });
console.log(`Sitemap-URLs: ${urls.length}`);
const spec = { uses: [{ type: 'trekking', weight: 3 }, { type: 'gravel', weight: 3 }, { type: 'mtb', weight: 3 }, { type: 'city', weight: 3 }], brandsPreferred: [], electric: false };
const cand = p.rankUrls(urls, spec, src).slice(0, 3);
console.log(`Produkt-Kandidaten: ${cand.length}`);
for (const u of cand) {
  try {
    const bike = p.parsePage(await fetcher.get(u), u, { ...src, brand: null });
    console.log(bike ? `✓ ${u}\n   ${bike.brand} ${bike.model} | ${bike.type} | ${bike.price.amount ?? 'kein Preis'} € | extrahiert: ${bike.verification.extractedFields.join(', ') || '–'}` : `– ${u}: keine auswertbaren Produktdaten`);
  } catch (e) { console.log(`✗ ${u}: ${e.message}`); }
}
