// Normalisiert und validiert Fahrraddaten aus beliebigen Quellen. Unplausible/fehlende Werte werden zu null – niemals geraten.
import { TYPES } from './taxonomy.js';
import { isNum, slug } from './util.js';

const str = (v, n = 200) => (typeof v === 'string' && v.trim() ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : null);
const num = (v, lo, hi) => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
  return isNum(n) && n >= lo && n <= hi ? n : null;
};
const oneOf = (v, list) => (list.includes(v) ? v : null);
const bool = (v) => (typeof v === 'boolean' ? v : null);

export function safeUrl(u) {
  try {
    const url = new URL(String(u));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch { return null; }
}

const KEY_FIELDS = ['price', 'weightKg', 'frameSizes', 'drivetrain', 'brakes', 'suspension'];

/**
 * @param {object} raw  Rohdaten eines Providers
 * @param {{provider:string, retrievedAt?:string}} source
 * @returns {{ok:boolean, bike?:object, errors:string[]}}
 */
export function normalizeBike(raw, source = { provider: 'unknown' }) {
  const errors = [];
  if (typeof raw !== 'object' || raw === null) return { ok: false, errors: ['kein Objekt'] };
  const brand = str(raw.brand, 60), model = str(raw.model, 120), url = safeUrl(raw.url);
  const type = oneOf(raw.type, TYPES);
  if (!brand) errors.push('brand fehlt');
  if (!model) errors.push('model fehlt');
  if (!url) errors.push('url fehlt/ungültig (Produktlink ist Pflicht)');
  if (!type) errors.push(`type ungültig (${raw.type})`);
  if (errors.length) return { ok: false, errors };

  const motorRaw = raw.motor ?? null;
  const motor = motorRaw ? {
    brand: str(motorRaw.brand, 40), name: str(motorRaw.name, 60), powerW: num(motorRaw.powerW, 100, 2000),
    torqueNm: num(motorRaw.torqueNm, 20, 200), concept: oneOf(motorRaw.concept, ['mid', 'rear', 'front']),
  } : null;
  const batRaw = raw.battery ?? null;
  const battery = batRaw ? {
    wh: num(batRaw.wh, 100, 2500), removable: bool(batRaw.removable), extenderSupport: bool(batRaw.extenderSupport), chargeHours: num(batRaw.chargeHours, 0.5, 24),
  } : null;
  const drive = oneOf(raw.drive, ['ebike', 'classic', 'speed']) ?? (motor || battery ? 'ebike' : 'classic');

  const featuresRaw = raw.features && typeof raw.features === 'object' && !Array.isArray(raw.features) ? raw.features : {};
  const features = {};
  for (const [k, v] of Object.entries(featuresRaw)) if (bool(v) !== null) features[k] = v;

  const priceAmount = num(raw.price?.amount ?? raw.price, 50, 100000);
  const year = num(raw.year, 2015, 2035);
  const bike = {
    id: slug(`${brand}-${model}-${year ?? ''}`),
    brand, model, year, type, drive,
    condition: oneOf(raw.condition, ['new', 'used']) ?? 'new',
    url, retailer: str(raw.retailer, 80), imageUrl: safeUrl(raw.imageUrl),
    price: {
      amount: priceAmount, currency: 'EUR',
      listPrice: num(raw.price?.listPrice, 50, 100000),
      discountPct: num(raw.price?.discountPct, 0, 90),
      asOf: str(raw.price?.asOf, 30), note: str(raw.price?.note, 120),
    },
    frameSizes: Array.isArray(raw.frameSizes) ? raw.frameSizes.map((s) => str(String(s), 12)).filter(Boolean).slice(0, 12) : null,
    weightKg: num(raw.weightKg, 5, 80),
    maxSystemWeightKg: num(raw.maxSystemWeightKg, 80, 400),
    material: oneOf(raw.material, ['aluminium', 'carbon', 'steel']),
    frameShape: oneOf(raw.frameShape, ['diamond', 'trapeze', 'lowstep']),
    motor: drive === 'classic' ? null : motor,
    battery: drive === 'classic' ? null : battery,
    drivetrain: raw.drivetrain ? { type: oneOf(raw.drivetrain.type, ['chain', 'hub', 'electronic']), gears: num(raw.drivetrain.gears, 1, 40), brand: str(raw.drivetrain.brand, 40), name: str(raw.drivetrain.name, 80) } : null,
    brakes: raw.brakes ? { type: oneOf(raw.brakes.type, ['hydraulic', 'mechanical', 'rim']), name: str(raw.brakes.name, 80) } : null,
    suspension: raw.suspension ? { type: oneOf(raw.suspension.type, ['none', 'fork', 'full']), travelFrontMm: num(raw.suspension.travelFrontMm, 20, 300), travelRearMm: num(raw.suspension.travelRearMm, 20, 300) } : null,
    tires: raw.tires ? { widthMm: num(raw.tires.widthMm, 20, 120), name: str(raw.tires.name, 80) } : null,
    features,
    highlights: Array.isArray(raw.highlights) ? raw.highlights.map((h) => str(h, 120)).filter(Boolean).slice(0, 8) : [],
    warranty: str(raw.warranty, 120),
    pros: Array.isArray(raw.pros) ? raw.pros.map((h) => str(h, 140)).filter(Boolean).slice(0, 5) : [],
    cons: Array.isArray(raw.cons) ? raw.cons.map((h) => str(h, 140)).filter(Boolean).slice(0, 5) : [],
    verification: null,
  };
  const sources = (Array.isArray(raw.sources) ? raw.sources : []).map((s) => safeUrl(typeof s === 'string' ? s : s?.url)).filter(Boolean).slice(0, 6);
  if (!sources.includes(url)) sources.unshift(url);
  const missing = KEY_FIELDS.filter((k) => {
    const v = bike[k];
    return k === 'price' ? v.amount == null : k === 'frameSizes' ? !v?.length : v == null || (typeof v === 'object' && !Object.values(v).some((x) => x != null));
  });
  if (bike.drive !== 'classic' && !bike.battery?.wh) missing.push('battery.wh');
  bike.verification = {
    status: 'unverified', // wird vom Provider angehoben, wenn die Quelle bestätigt ist
    provider: source.provider, retrievedAt: source.retrievedAt ?? new Date().toISOString(),
    sources, unverifiedFields: missing,
  };
  return { ok: true, bike, errors: [] };
}
