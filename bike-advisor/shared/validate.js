import { allFields, fieldOptions } from './questionnaire.js';
import { getPath, setPath, isNum } from './util.js';

const MAX_BRANDS = 30;
const cleanStr = (s, n = 60) => String(s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

/**
 * Validiert und bereinigt Nutzereingaben anhand des Fragebogen-Schemas.
 * Unbekannte Felder werden verworfen. Gibt { ok, answers, errors } zurück.
 */
export function validateAnswers(raw) {
  const errors = [];
  const out = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, answers: {}, errors: ['Antworten müssen ein Objekt sein'] };

  // Reihenfolge: erst alle Felder lesen (Optionen können von category abhängen)
  const base = { category: raw.category, undecided: raw.undecided, ...raw };
  for (const f of allFields()) {
    if (f.type === 'insight') continue;
    const v = getPath(raw, f.id);
    if (v === undefined || v === null) continue;
    const err = (m) => errors.push(`${f.id}: ${m}`);
    const options = f.options ? (Array.isArray(f.options) || typeof f.options === 'function' ? fieldOptions(f, base) : null) : null;
    const values = Array.isArray(options) ? options.map((o) => (typeof o === 'string' ? o : o.value)) : null;
    switch (f.type) {
      case 'single':
        if (typeof v === 'string' && values?.includes(v)) setPath(out, f.id, v); else err('ungültiger Wert');
        break;
      case 'multi':
        if (Array.isArray(v) && v.every((x) => typeof x === 'string' && values?.includes(x))) setPath(out, f.id, [...new Set(v)]); else err('ungültige Auswahl');
        break;
      case 'brands':
        if (Array.isArray(v) && v.length <= MAX_BRANDS && v.every((x) => typeof x === 'string')) setPath(out, f.id, [...new Set(v.map((x) => cleanStr(x, 40)).filter(Boolean))]); else err('ungültige Herstellerliste');
        break;
      case 'weighted': {
        // veraltete Optionen (z. B. nach Wechsel der Antriebsart) werden verworfen statt abgelehnt
        if (typeof v !== 'object' || Array.isArray(v)) { err('ungültige Gewichtung'); break; }
        const kept = Object.entries(v).filter(([k]) => values?.includes(k));
        if (kept.every(([, w]) => Number.isInteger(w) && w >= 1 && w <= 5)) setPath(out, f.id, Object.fromEntries(kept)); else err('ungültige Gewichtung');
        break;
      }
      case 'must': {
        const ok = typeof v === 'object' && !Array.isArray(v) && Object.entries(v).every(([k, w]) => values?.includes(k) && (w === 'must' || w === 'nice'));
        if (ok) setPath(out, f.id, v); else err('ungültige Muss/Wunsch-Angabe');
        break;
      }
      case 'number': case 'range':
        if (isNum(v) && v >= f.min && v <= f.max) setPath(out, f.id, v); else err(`Zahl zwischen ${f.min} und ${f.max} erwartet`);
        break;
      case 'bool':
        if (typeof v === 'boolean') setPath(out, f.id, v); else err('Ja/Nein erwartet');
        break;
      case 'text':
        if (typeof v === 'string') setPath(out, f.id, cleanStr(v, f.maxLength ?? 300)); else err('Text erwartet');
        break;
    }
  }
  return { ok: errors.length === 0, answers: out, errors };
}
