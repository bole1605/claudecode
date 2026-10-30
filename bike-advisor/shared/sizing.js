import { FRAME_LETTERS, TYPE_LABEL } from './taxonomy.js';
import { isNum } from './util.js';

const letterForHeight = (h) => (h < 158 ? 'XS' : h < 167 ? 'S' : h < 176 ? 'M' : h < 185 ? 'L' : h < 194 ? 'XL' : 'XXL');

// Faktoren Schrittlänge -> Rahmenhöhe (cm), gängige Faustformeln je Einsatzgebiet
const INSEAM_FACTOR = { road: 0.665, gravel: 0.65, fitness: 0.65, cross: 0.64, trekking: 0.63, etrekking: 0.63, touring: 0.64,
  commute: 0.63, allround: 0.62, city: 0.6, ecity: 0.6, cargo: 0.6, mtb: 0.57, emtb: 0.57 };

/**
 * Empfiehlt Rahmengröße und Geometrie-Tendenz.
 * @returns {{letter:string, cm:number|null, inch:number|null, geometry:string, basis:string}|null}
 */
export function recommendFrameSize({ heightCm, inseamCm, type = 'allround', position = 'balanced' }) {
  if (!isNum(heightCm)) return null;
  const letter = letterForHeight(heightCm);
  let cm = null, inch = null, basis = 'Körpergröße';
  if (isNum(inseamCm)) {
    cm = Math.round(inseamCm * (INSEAM_FACTOR[type] ?? 0.62));
    basis = 'Schrittlänge und Körpergröße';
  } else {
    cm = Math.round(heightCm * 0.31 + (type === 'mtb' || type === 'emtb' ? -3 : 1));
  }
  if (type === 'mtb' || type === 'emtb') inch = Math.round((cm / 2.54) * 2) / 2;
  const ratio = isNum(inseamCm) ? inseamCm / heightCm : 0.45;
  const legs = ratio > 0.47 ? 'lange Beine → eher kürzerer Oberrohr/Reach, höherer Stack möglich' : ratio < 0.43 ? 'kürzere Beine → niedrige Überstandshöhe wichtig, längerer Reach passt' : 'Durchschnittsproportionen';
  const pos = { sporty: 'sportlich gestreckt (langer Reach, niedriger Stack)', balanced: 'ausgewogen (mittlerer Reach/Stack)', upright: 'aufrecht (kürzerer Reach, hoher Stack, hoher Lenker)' }[position];
  return {
    letter, cm, inch,
    geometry: `Sitzposition ${pos}; ${legs}.`,
    basis: `${TYPE_LABEL[type] ?? type}, Basis: ${basis}`,
  };
}

/** Normalisiert Größenangaben ("M", "54", "17\"") in { letter?, cm? } */
export function parseSize(s) {
  const t = String(s).trim().toUpperCase().replace(/[“”″]/g, '"');
  if (FRAME_LETTERS.includes(t)) return { letter: t };
  const m = t.match(/^(\d{2}(?:[.,]\d)?)\s*("|IN|ZOLL)?$/);
  if (m) {
    const n = parseFloat(m[1].replace(',', '.'));
    if (m[2] || n <= 30) return { cm: n * 2.54 };
    return { cm: n };
  }
  return null;
}

/** Passt die empfohlene Größe zu den verfügbaren Rahmengrößen? 'exact' | 'near' | 'none' | 'unknown' */
export function sizeFit(rec, available) {
  if (!rec || !available?.length) return 'unknown';
  const parsed = available.map(parseSize).filter(Boolean);
  if (!parsed.length) return 'unknown';
  const li = FRAME_LETTERS.indexOf(rec.letter);
  let best = 'none';
  for (const p of parsed) {
    if (p.letter) {
      const d = Math.abs(FRAME_LETTERS.indexOf(p.letter) - li);
      if (d === 0) return 'exact';
      if (d === 1) best = 'near';
    } else if (isNum(rec.cm)) {
      const d = Math.abs(p.cm - rec.cm);
      if (d <= 1.5) return 'exact';
      if (d <= 3.5) best = 'near';
    }
  }
  return best;
}
