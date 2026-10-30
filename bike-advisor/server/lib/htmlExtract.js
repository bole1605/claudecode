// Extraktion von Produktdaten aus HTML: strukturierte Daten (JSON-LD) zuerst, technische Daten per vorsichtiger Textanalyse.
// Grundsatz: Was nicht eindeutig gefunden wird, bleibt undefined (= unbekannt) – es wird nie geraten.

const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', euro: '€' };
export const decode = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const c = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(c) && c > 0 && c < 0x10ffff ? String.fromCodePoint(c) : ' '; }
  return ENT[e] ?? m;
});

export function htmlToText(html) {
  return decode(html.replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 250_000);
}

export function getMeta(html, key) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0]; if (!tag) return null;
  const c = tag.match(/content=["']([^"']*)["']/i)?.[1];
  return c ? decode(c).trim() : null;
}

export function parseJsonLd(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (n) => { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === 'object') { out.push(n); if (n['@graph']) walk(n['@graph']); } };
      walk(JSON.parse(m[1].trim()));
    } catch { /* kaputtes JSON-LD ignorieren */ }
  }
  return out;
}
const types = (n) => [].concat(n['@type'] ?? []).map(String);

export function parsePrice(v) {
  if (v == null) return null;
  let s = String(v).replace(/[^\d.,]/g, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const firstStr = (v) => (Array.isArray(v) ? firstStr(v[0]) : typeof v === 'string' ? v : v && typeof v === 'object' ? v.url ?? v.contentUrl ?? v.name ?? null : null);

export function extractProductMeta(html, pageUrl) {
  const nodes = parseJsonLd(html);
  const prod = nodes.find((n) => types(n).includes('Product')) ?? null;
  const crumbs = nodes.find((n) => types(n).includes('BreadcrumbList'));
  const breadcrumb = crumbs ? [].concat(crumbs.itemListElement ?? []).map((i) => i.name ?? i.item?.name ?? '').join(' > ') : '';
  const offerRaw = prod ? [].concat(prod.offers ?? []).flatMap((o) => (o?.offers ? [].concat(o.offers) : [o])) : [];
  const offer = offerRaw.find((o) => o && (o.price ?? o.lowPrice ?? o.priceSpecification?.price) != null) ?? null;
  const amount = offer ? parsePrice(offer.price ?? offer.lowPrice ?? offer.priceSpecification?.price) : parsePrice(getMeta(html, 'product:price:amount'));
  const currency = (offer?.priceCurrency ?? offer?.priceSpecification?.priceCurrency ?? getMeta(html, 'product:price:currency') ?? 'EUR').toUpperCase();
  const abs = (u) => { try { return u ? new URL(u, pageUrl).toString() : null; } catch { return null; } };
  const brand = typeof prod?.brand === 'string' ? prod.brand : prod?.brand?.name ?? null;
  return {
    found: !!prod || !!getMeta(html, 'og:title'),
    structured: !!prod,
    name: decode(String(prod?.name ?? getMeta(html, 'og:title') ?? '')).trim() || null,
    brand: brand ? decode(String(brand)).trim() : null,
    amount: currency === 'EUR' ? amount : null,
    foreignCurrency: currency !== 'EUR' && amount != null ? currency : null,
    image: abs(firstStr(prod?.image) ?? getMeta(html, 'og:image')),
    url: abs(prod?.url ?? getMeta(html, 'og:url')) ?? pageUrl,
    description: prod?.description ? decode(String(prod.description)) : getMeta(html, 'og:description') ?? '',
    breadcrumb,
    availability: offer?.availability ? String(offer.availability).split('/').pop() : null,
  };
}

/** Fahrradtyp und Antriebsart aus Name/URL/Rubrik – bei Unsicherheit null (Modell wird dann verworfen). */
export function classify(haystack, hasMotorData = false) {
  const t = haystack.toLowerCase();
  const speed = /s-?pedelec|speed[- ]?pedelec/.test(t);
  const isE = hasMotorData || speed || /e-?bike|pedelec|\be-?(mtb|fully|hardtail|trekking|city|gravel|cargo|road)|\bemtb\b|electric|elektro/.test(t);
  let type = null;
  if (/cargo|lasten/.test(t)) type = 'cargo';
  else if (/gravel/.test(t)) type = 'gravel';
  else if (/rennrad|road ?bike|\broad\b/.test(t)) type = 'road';
  else if (/e-?mtb|emtb|e-?mountain|e-?fully|e-?hardtail|mountainbike|mountain bike|\bmtb\b|\bfully\b|hardtail/.test(t)) type = isE ? 'emtb' : 'mtb';
  else if (/trekking/.test(t)) type = isE ? 'etrekking' : 'trekking';
  else if (/touring|reiserad|tourenrad/.test(t)) type = 'touring';
  else if (/crossbike|cross[- ]bike/.test(t)) type = 'cross';
  else if (/fitness/.test(t)) type = 'fitness';
  else if (/citybike|city[- ]?bike|\bcity\b|stadtrad|hollandrad/.test(t)) type = isE ? 'ecity' : 'city';
  else if (/pendler|commut/.test(t)) type = 'commute';
  if (!type) return null;
  return { type, drive: speed ? 'speed' : isE ? 'ebike' : 'classic' };
}

const uniq = (a) => [...new Set(a)];
const near = (text, idx, words, before = 70, after = 20) => words.test(text.slice(Math.max(0, idx - before), idx + after));

function pickNumber(text, re, ctxRe, lo, hi) {
  const all = [...text.matchAll(re)].map((m) => ({ v: parseFloat(m[1].replace(',', '.')), i: m.index })).filter((x) => x.v >= lo && x.v <= hi);
  if (!all.length) return undefined;
  const ctx = all.filter((x) => near(text, x.i, ctxRe));
  const d = uniq(ctx.map((x) => x.v));
  if (d.length === 1) return d[0];
  const dAll = uniq(all.map((x) => x.v));
  return dAll.length === 1 ? dAll[0] : undefined; // mehrdeutig (z. B. mehrere Varianten) → unbekannt
}

/** Technische Daten per Textanalyse. Gibt Teil-Rohdaten (bikeSchema-Format) + Liste der extrahierten Felder zurück. */
export function extractSpecs(text) {
  const out = {}; const got = [];
  const set = (path, val) => { if (val === undefined || val === null) return; const keys = path.split('.'); let o = out; for (const k of keys.slice(0, -1)) o = o[k] ??= {}; o[keys.at(-1)] = val; got.push(path); };

  set('battery.wh', pickNumber(text, /(\d{3,4})\s*Wh\b/gi, /akku|batter|powertube|powerpack|kapazit/i, 150, 2500));
  set('motor.torqueNm', pickNumber(text, /(\d{2,3})\s*Nm\b/g, /motor|drehmoment|torque/i, 30, 150));
  set('weightKg', pickNumber(text, /(?:Gewicht|Weight)[^\d]{0,40}?(\d{1,2}(?:[.,]\d{1,2})?)\s*kg/gi, /^$/, 5, 70));
  set('maxSystemWeightKg', pickNumber(text, /(?:zul(?:ässiges|\.)?\s*Gesamtgewicht|Systemgewicht)[^\d]{0,30}(\d{2,3})\s*kg/gi, /^$/, 90, 400));

  const mb = [[/\bBosch\b|Performance Line|Cargo Line|Smart System|Active Line|\bCX\b(?=.{0,30}(?:Motor|Nm))/i, 'Bosch'], [/\bShimano (?:Steps|EP\d|E\d{4})|\bEP8\d*|\bEP6\b|\bSTEPS\b/i, 'Shimano'], [/\bYamaha\b|SyncDrive/i, 'Yamaha'], [/\bBrose\b/i, 'Brose'], [/\bFazua\b/i, 'Fazua'], [/\bTQ[- ]?(?:HPR|Motor)/i, 'TQ'], [/\bAvinox\b|\bDJI\b/i, 'DJI Avinox'], [/Specialized (?:SL|Turbo)|Turbo (?:Levo|Vado|Kenevo|Creo)/i, 'Specialized'], [/\bBafang\b/i, 'Bafang'], [/\bPanasonic\b/i, 'Panasonic']];
  for (const [re, name] of mb) if (re.test(text)) { set('motor.brand', name); break; }
  const mn = text.match(/Performance Line (CX|SX|Sport)|\bEP8\d*|\bEP801|\bSX\b(?= Motor)/i); if (mn) set('motor.name', mn[0]);
  if (/Mittelmotor/i.test(text)) set('motor.concept', 'mid'); else if (/Heckmotor|Hinterradmotor/i.test(text)) set('motor.concept', 'rear'); else if (/Frontmotor|Vorderradmotor/i.test(text)) set('motor.concept', 'front');
  if (/herausnehmbar\w* Akku|Akku[^.]{0,30}herausnehmbar|Akku[^.]{0,30}entnehmbar/i.test(text)) set('battery.removable', true);
  else if (/integrierte[rn]? Akku|Akku[^.]{0,20}integriert/i.test(text)) set('battery.removable', false);

  if (/hydraulisch\w*[^.]{0,30}(?:Scheiben)?brems|hydraulic[^.]{0,20}disc|Scheibenbrems\w*[^.]{0,40}hydraul/i.test(text)) set('brakes.type', 'hydraulic');
  else if (/mechanisch\w*[^.]{0,20}Scheibenbrems/i.test(text)) set('brakes.type', 'mechanical');
  else if (/Felgenbrems|V-Brake/i.test(text) && !/Scheibenbrems/i.test(text)) set('brakes.type', 'rim');

  const travel = [...text.matchAll(/Federweg[^\d]{0,30}(\d{2,3})\s*mm(?:[^\d]{0,15}(\d{2,3})\s*mm)?/gi)][0];
  if (/Vollfeder|\bFully\b|Dual Suspension|Hinterbau/i.test(text) && travel?.[2]) { set('suspension.type', 'full'); set('suspension.travelFrontMm', +travel[1]); set('suspension.travelRearMm', +travel[2]); }
  else if (/Vollfeder|\bFully\b|Dual Suspension/i.test(text)) set('suspension.type', 'full');
  else if (/Federgabel|Suspension fork|Federweg/i.test(text)) { set('suspension.type', 'fork'); if (travel) set('suspension.travelFrontMm', +travel[1]); }
  else if (/Starrgabel|ungefedert|Rigid fork/i.test(text)) set('suspension.type', 'none');

  const hub = text.match(/Nabenschaltung|\bEnviolo\b|\bNexus\b|\bAlfine\b|\bRohloff\b|\bPinion\b|\bNuVinci\b/i);
  const elec = text.match(/\bDi2\b|\bAXS\b|\beTap\b|elektronisch\w* Schalt/i);
  const chain = text.match(/Kettenschaltung|\b(Deore|Cues|Alivio|Altus|Acera|SLX|XT|GRX|Ultegra|105|Tiagra|Sora)\b|\b(GX|NX|SX|NX) Eagle|\b(Apex|Rival|Force)\b/);
  const dt = hub ?? elec ?? chain;
  if (dt) {
    set('drivetrain.type', hub ? 'hub' : elec ? 'electronic' : 'chain');
    const w = dt[0].toLowerCase();
    const brand = /nexus|alfine|deore|cues|alivio|altus|acera|slx|xt|grx|ultegra|105|tiagra|sora|di2/.test(w) ? 'Shimano' : /eagle|apex|rival|force|axs/.test(w) ? 'SRAM' : /enviolo|nuvinci/.test(w) ? 'Enviolo' : /rohloff/.test(w) ? 'Rohloff' : /pinion/.test(w) ? 'Pinion' : null;
    set('drivetrain.brand', brand);
    const g = [...text.matchAll(/\b(\d{1,2})\s*(?:-?fach|-?Gang|-?Gänge|-?speed)\b/gi)].map((m) => +m[1]).filter((n) => n >= 1 && n <= 36);
    if (g.length && uniq(g).length === 1) set('drivetrain.gears', g[0]);
  }

  const mat = text.match(/Rahmen[^.]{0,40}?(Carbon|Aluminium|Aluminum|Alu\b|Stahl|Steel)|(Carbon|Aluminium|Aluminum|Alu\b|Stahl|Steel)[- ]?Rahmen/i);
  if (mat) { const m = (mat[1] ?? mat[2]).toLowerCase(); set('material', m.startsWith('carbon') ? 'carbon' : m.startsWith('alu') ? 'aluminium' : 'steel'); }
  if (/Tiefeinsteiger|Low[- ]?step/i.test(text)) set('frameShape', 'lowstep'); else if (/Trapez/i.test(text)) set('frameShape', 'trapeze'); else if (/Diamantrahmen|Herrenrahmen/i.test(text)) set('frameShape', 'diamond');

  const feat = { rack: /Gepäckträger/i, fenders: /Schutzblech/i, lights: /StVZO|Beleuchtung|Lichtanlage/i, kickstand: /Seitenständer|Fahrradständer/i, luggageMounts: /Schraubösen|Taschenhalter|Gepäckträgeraufnahme/i, tubeless: /Tubeless/i, ergoGrips: /ergonomische\w* Griffe/i };
  for (const [k, re] of Object.entries(feat)) if (re.test(text)) set(`features.${k}`, true);

  const sz = text.match(/(?:Rahmengr[öo]ß?e[n]?|Rahmenhöhe|Größen?|Sizes?)[^A-Za-z0-9]{0,6}((?:\b(?:XXS|XS|S|M|L|XL|XXL)\b[ ,/·|-]*){1,8})/);
  if (sz) set('frameSizes', uniq(sz[1].match(/\b(?:XXS|XS|S|M|L|XL|XXL)\b/g)));
  return { specs: out, extracted: got };
}
