// Provider 3 (kostenlos, ohne API-Key): liest Produktseiten direkt von Hersteller-/Händlerwebsites.
// Ablauf: robots.txt → Sitemap → URL-Vorauswahl nach Suchprofil → Produktseiten abrufen → JSON-LD + Textanalyse → bikeSchema.
// Ehrlichkeit: Preis/Name/Bild stammen aus strukturierten Seitendaten, Technikdaten aus dem Seitentext (automatisch extrahiert).
import { readFile } from 'node:fs/promises';
import { PoliteFetcher, RobotsError } from '../lib/politeFetch.js';
import { extractProductMeta, extractSpecs, classify, htmlToText } from '../lib/htmlExtract.js';
import { normalizeBike } from '../../shared/bikeSchema.js';
import { TYPE_LABEL } from '../../shared/taxonomy.js';

const KEYWORDS = {
  mtb: ['mtb', 'mountainbike', 'fully', 'hardtail'], emtb: ['emtb', 'e-mtb', 'e-mountain', 'e-fully', 'e-hardtail', 'mountainbike', 'mtb'],
  trekking: ['trekking'], etrekking: ['trekking', 'e-trekking'], city: ['city', 'citybike', 'stadt'], ecity: ['city', 'e-city', 'citybike'],
  gravel: ['gravel'], road: ['rennrad', 'road'], cross: ['cross'], fitness: ['fitness'], cargo: ['cargo', 'lasten'], touring: ['touring', 'reise', 'tour'],
  commute: ['pendler', 'commut', 'urban'], allround: ['trekking', 'city', 'cross'],
};
const BIKE_WORDS = /(bike|rad\b|rennrad|gravel|mtb|mountain|trekking|citybike|pedelec|fully|hardtail|crossbike)/i;
const ACCESSORY = /(helm|schloss|pedal|reifen|sattel|lenker|griff|kette|bremsscheibe|bremsbel|schutzblech|ersatz|zubeh|tasche|korb|pumpe|werkzeug|beleuchtung|licht|handschuh|trikot|hose|schuh|jacke|brille|kindersitz|anhaenger|anhänger|akku-|ladeger|display|gutschein|service|gabel-|laufrad|felge|schlauch|kassette|kurbel)/i;
// Redaktionelle/Service-Seiten sind keine Produkte (Blog, Ratgeber, Magazin, Hilfe …)
const EDITORIAL = /(blog|ratgeber|magazin|magazine|news|guide|hilfe|help|support|service|stor(y|ies)|content|events?|about|ueber-uns|karriere|jobs|faq|kontakt|contact|tipps|tips|vergleich|test(bericht)?s?|marken|brands|stores?|haendler|retailer|impressum|agb|datenschutz|newsletter|gutschein|finanzierung|leasing|jobrad|sale-?info)/i;
const MAX_URLS = 60000;

export function loc(xml) { return [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&')); }

export class WebsiteProvider {
  id = 'website';
  label = 'Hersteller-/Händlerseiten (kostenlos)';
  constructor(config, fetcher) {
    this.cfg = config; this.sources = null;
    this.fetcher = fetcher ?? new PoliteFetcher({ fetchImpl: config.fetchImpl, delayMs: config.siteDelayMs, cacheDir: config.siteCacheDir, userAgent: config.siteUserAgent });
  }

  async loadSources() {
    if (this.sources) return this.sources;
    try { this.sources = JSON.parse(await readFile(this.cfg.sourcesFile, 'utf8')); } catch { this.sources = { sources: [] }; }
    return this.sources;
  }

  async isAvailable() {
    const { sources } = await this.loadSources();
    return sources.some((s) => s.enabled !== false) ? { ok: true } : { ok: false, reason: 'Keine aktive Quelle in data/sources.json' };
  }

  async sitemapUrls(src) {
    const robots = await this.fetcher.getRobots(src.origin);
    const roots = src.sitemap ? [].concat(src.sitemap) : robots.sitemaps.length ? robots.sitemaps.slice(0, 4) : [src.origin + '/sitemap.xml'];
    const urls = []; const seen = new Set();
    const visit = async (u, depth) => {
      if (seen.has(u) || seen.size > 40) return; seen.add(u);
      let xml; try { xml = await this.fetcher.get(u); } catch (e) { if (e instanceof RobotsError) throw e; return; }
      const entries = loc(xml);
      if (/<sitemapindex/i.test(xml) && depth < 2) {
        const preferred = entries.filter((x) => /product|produkt|bike|rad/i.test(x));
        for (const child of (preferred.length ? preferred : entries).slice(0, 10)) await visit(child, depth + 1);
      } else for (const e of entries) { if (urls.length < MAX_URLS) urls.push(e); }
    };
    for (const r of roots) await visit(r, 0);
    return urls;
  }

  /** Vorauswahl der Produkt-URLs anhand des Suchprofils (reine URL-Heuristik). */
  rankUrls(urls, spec, src) {
    const kw = new Set(); for (const u of spec.uses) for (const k of KEYWORDS[u.type] ?? []) kw.add(k);
    const brandWords = spec.brandsPreferred.map((b) => b.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const scored = [];
    for (const u of urls) {
      let p; try { p = new URL(u); } catch { continue; }
      if (src.includePaths?.length && !src.includePaths.some((x) => p.pathname.startsWith(x))) continue;
      const path = decodeURIComponent(p.pathname).toLowerCase();
      if (ACCESSORY.test(path) || EDITORIAL.test(path) || !BIKE_WORDS.test(path)) continue;
      let s = 0;
      for (const k of kw) if (path.includes(k)) s += 3;
      if (spec.electric && /e-?bike|pedelec|\be-|emtb/.test(path)) s += 2; else if (!spec.electric && /e-?bike|pedelec/.test(path)) s -= 4;
      for (const b of brandWords) if (b && (path.includes(b) || p.host.replace(/[^a-z0-9]/g, '').includes(b))) s += 2;
      const segs = path.split('/').filter(Boolean);
      if (segs.length < 2) s -= 2; // Rubrikseiten
      if (/\/\d{3,}(\.html?)?$/.test(path) || /\/(p|produkt|product|artikel)\/|\d{4,}\.html?$/.test(path)) s += 3; // typische Produktseiten-Muster (Artikelnummer)
      if (segs.length >= 4) s += 1; // tiefe Pfade sind eher Produkte als Rubriken
      if (s > 0) scored.push([s, u]);
    }
    return [...new Set(scored.sort((a, b) => b[0] - a[0]).map((x) => x[1]))];
  }

  /** `why` (optional) erhält bei Ablehnung den Grund – für check-source und Logs. */
  parsePage(html, url, src, why = {}) {
    const meta = extractProductMeta(html, url);
    why.meta = { structured: meta.structured, name: meta.name, brand: meta.brand, amount: meta.amount, breadcrumb: meta.breadcrumb };
    if (!meta.found || !meta.name) { why.reason = html.length < 2000 ? `Seite fast leer (${html.length} Zeichen) – vermutlich per JavaScript nachgeladen oder Bot-Schutz` : 'weder Produkt-Strukturdaten (JSON-LD) noch og:title gefunden – Seite wird vermutlich per JavaScript gerendert'; return null; }
    if (!meta.structured && meta.amount == null) { why.reason = 'keine Produktseite (weder Produkt-Strukturdaten noch Preis gefunden)'; return null; }
    const text = htmlToText(html);
    const { specs, extracted } = extractSpecs(text);
    const hasMotor = !!(specs.battery?.wh || specs.motor?.brand);
    // Erst enge Hinweise (Name/URL/Rubrik), dann Beschreibung und Seitenanfang – nie raten, wenn nichts passt
    const cls = classify(`${meta.name} ${url} ${meta.breadcrumb}`, hasMotor) ?? classify(`${meta.description} ${text.slice(0, 1500)}`, hasMotor);
    if (!cls) { why.reason = 'Fahrradtyp nicht erkennbar (kein Typ-Stichwort wie Trekking/Gravel/MTB/City in Name, URL, Rubrik, Beschreibung)'; return null; }
    const brand = src.brand ?? meta.brand;
    if (!brand) { why.reason = 'Marke unbekannt (kein "brand" in den Strukturdaten; bei Herstellerseiten in sources.json "brand" setzen)'; return null; }
    const year = (meta.name + ' ' + url).match(/\b(20[12]\d)\b/)?.[1];
    const raw = {
      brand, model: meta.name.replace(new RegExp('^' + brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '').slice(0, 120) || meta.name,
      year: year ? +year : undefined, ...cls, url: meta.url.startsWith('http') ? meta.url : url, retailer: src.brand ? undefined : src.label, imageUrl: meta.image,
      price: { amount: meta.amount, asOf: meta.amount != null ? new Date().toISOString().slice(0, 10) : undefined, note: meta.foreignCurrency ? `Preis in ${meta.foreignCurrency}, nicht übernommen` : undefined },
      ...specs, sources: [url],
    };
    const { ok, bike } = normalizeBike(raw, { provider: this.id });
    if (!ok) { why.reason = 'Pflichtfelder fehlen (Produkt-URL/Typ/Marke/Modell)'; return null; }
    const core = ['price.amount', ...(bike.drive !== 'classic' ? ['battery.wh'] : []), 'weightKg', 'brakes.type'];
    const have = core.filter((k) => k === 'price.amount' ? bike.price.amount != null : extracted.includes(k)).length;
    bike.verification.status = meta.structured && have === core.length ? 'verified' : 'partial';
    bike.verification.note = `Preis${meta.structured ? ' aus strukturierten Seitendaten' : ' (keine strukturierten Daten)'}; Technik automatisch aus dem Seitentext extrahiert (${extracted.length} Felder) – bitte auf der Produktseite prüfen.`;
    bike.verification.extractedFields = extracted;
    if (meta.availability) bike.verification.availability = meta.availability;
    return bike;
  }

  async search(spec, { onProgress = () => {} } = {}) {
    const { sources, maxPages = 24 } = await this.loadSources();
    const active = sources.filter((s) => s.enabled !== false);
    const perSource = Math.max(3, Math.ceil(maxPages / Math.max(1, active.length)));
    const notes = []; const bikes = new Map(); const rejected = [];
    await Promise.all(active.map(async (src) => {
      try {
        onProgress(`${src.label}: Sitemap lesen …`);
        const urls = this.rankUrls(await this.sitemapUrls(src), spec, src).slice(0, perSource * 3);
        if (!urls.length) { notes.push(`${src.label}: keine passenden Produktseiten über die Sitemap gefunden.`); return; }
        let n = 0, found = 0;
        for (const u of urls) {
          if (found >= perSource) break;
          try {
            const why = {};
            const bike = this.parsePage(await this.fetcher.get(u), u, src, why);
            if (!bike) rejected.push(why.reason);
            if (bike) { found++; const prev = bikes.get(bike.id); if (!prev || bike.verification.status === 'verified') bikes.set(bike.id, bike); }
          } catch (e) { if (e instanceof RobotsError) { notes.push(`${src.label}: ${e.message}`); break; } }
          onProgress(`${src.label}: ${++n}/${urls.length} Seiten geprüft`);
        }
      } catch (e) { notes.push(e instanceof RobotsError ? `${src.label}: robots.txt untersagt das Auslesen – Quelle übersprungen.` : `${src.label}: ${e.message}`); }
    }));
    if (!bikes.size && rejected.length) { const top = [...new Set(rejected)].slice(0, 3).join(' | '); notes.push(`Seiten gefunden, aber nicht auswertbar: ${top}`); }
    if (!bikes.size) notes.push(`Keine Modelle aus den Websites extrahiert (gesucht: ${spec.uses.map((u) => TYPE_LABEL[u.type]).join(', ')}). Quellen mit „npm run check-source“ prüfen.`);
    return { bikes: [...bikes.values()], notes };
  }
}
