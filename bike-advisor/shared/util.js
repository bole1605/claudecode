export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
export const clone = (o) => JSON.parse(JSON.stringify(o));

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) {
    if (typeof o[k] !== 'object' || o[k] === null) o[k] = {};
    o = o[k];
  }
  o[keys.at(-1)] = value;
  return obj;
}

export const slug = (s) =>
  String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const fmtEUR = (n) =>
  isNum(n) ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) : '–';
