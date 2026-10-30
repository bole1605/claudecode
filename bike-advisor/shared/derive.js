// Abgeleitete Größen aus den Antworten (gemeinsam genutzt von Fragebogen, Spezifikation und Scoring).
import { getPath, isNum } from './util.js';
import { recommendBattery } from './range.js';
import { recommendFrameSize } from './sizing.js';
import { TYPE_LABEL } from './taxonomy.js';

const E_REASONS = new Set(['hills', 'distance', 'sweat', 'load']);

export function undecidedSuggestion(a) {
  const r = getPath(a, 'undecided.reasons') ?? [];
  if (!r.length) return null;
  let drive = 'classic';
  if (r.includes('speed') && r.filter((x) => E_REASONS.has(x)).length >= 1) drive = 'speed';
  else if (r.filter((x) => E_REASONS.has(x)).length >= 2 || (r.includes('hills') && r.includes('sweat'))) drive = 'ebike';
  else if (r.includes('load') || r.includes('hills')) drive = 'ebike';
  const text = {
    ebike: 'Empfehlung: E-Bike. Du profitierst von Motorunterstützung bei Steigungen, Distanz oder Gepäck.',
    speed: 'Empfehlung: S-Pedelec. Für dauerhaft hohes Tempo – beachte Versicherungskennzeichen, Helm- und Führerscheinpflicht (AM).',
    classic: 'Empfehlung: Klassisches Fahrrad. Leicht, wartungsarm und für Sport/Training ideal.',
  }[drive];
  return { title: 'Unsere Einschätzung', text, drive };
}

/** Effektive Antriebsart: 'ebike' | 'classic' | 'speed' | null (noch offen). */
export function effectiveDrive(a) {
  const c = a?.category;
  if (c === 'ebike' || c === 'classic' || c === 'speed') return c;
  if (c === 'undecided') {
    const choice = a.undecided?.choice;
    if (choice && choice !== 'auto') return choice;
    return undecidedSuggestion(a)?.drive ?? null;
  }
  return null;
}
export const isElectric = (a) => ['ebike', 'speed'].includes(effectiveDrive(a));

export const CLIMB_M100 = { flat: 300, rolling: 800, hilly: 1500, mountain: 2500 };

/** Dominanter Einsatzzweck nach Gewichtung */
export function primaryUse(a) {
  const u = Object.entries(a.uses ?? {}).sort((x, y) => y[1] - x[1])[0];
  return u?.[0] ?? 'allround';
}

export function rangeProfile(a, bikeKg = 24) {
  const terrain = a.usage?.terrain ?? [];
  const t = ['technical', 'forest', 'gravel', 'city', 'road'].find((x) => terrain.includes(x)) ?? 'road';
  return {
    riderKg: a.ergo?.weight ?? 80, bikeKg, luggageKg: a.ergo?.luggageKg ?? 0,
    assist: a.battery?.assist ?? 'tour', climbM100: CLIMB_M100[a.usage?.climbing] ?? 800,
    terrain: t, tempC: a.usage?.allWeather ? 3 : 15,
  };
}

export function batteryAdvice(a) {
  const target = a.battery?.rangeKm;
  if (!isNum(target)) return null;
  const adv = recommendBattery({ targetKm: target, ...rangeProfile(a) });
  const cold = a.usage?.allWeather ? ' Für Wintertemperaturen (≈ 3 °C) ist die Reserve eingerechnet.' : '';
  return {
    title: `Empfohlene Akkukapazität: ca. ${adv.marketWh} Wh`,
    text: `Für ${target} km bei Unterstützung „${a.battery?.assist ?? 'tour'}“, ${a.ergo?.weight ?? 80} kg Fahrergewicht und deinem Höhenprofil rechnen wir mit ≈ ${adv.whPerKm} Wh/km (inkl. 15 % Reserve → ${adv.wh} Wh).${cold} Schätzung – reale Werte schwanken.`,
    adv,
  };
}

export function frameAdvice(a) {
  const rec = recommendFrameSize({ heightCm: a.ergo?.height, inseamCm: a.ergo?.inseam || undefined, type: primaryUse(a), position: a.ergo?.position });
  if (!rec) return null;
  return {
    title: `Empfohlene Rahmengröße: ${rec.letter}${rec.cm ? ` (≈ ${rec.cm} cm${rec.inch ? ` / ${rec.inch}"` : ''})` : ''}`,
    text: `${rec.geometry} Basis: ${rec.basis}. Herstellertabellen weichen ab – im Zweifel Probefahrt.`,
    rec,
  };
}

export const typeLabel = (t) => TYPE_LABEL[t] ?? t;
