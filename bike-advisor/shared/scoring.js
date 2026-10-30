// Matching-Algorithmus: gewichtete Kriterien (0..1) + harte Muss-Prüfung.
// Unbekannte Daten werden nie als erfüllt gewertet: neutral (0.5) bewertet, markiert und bei Muss-Kriterien gedeckelt.
import { affinity, typicalWeight, TYPE_POSITION, FEATURES } from './taxonomy.js';
import { buildSpec } from './spec.js';
import { estimateRange } from './range.js';
import { sizeFit } from './sizing.js';
import { clamp, isNum } from './util.js';

export const WEIGHTS = { use: 20, budget: 15, motor: 10, range: 8, components: 12, features: 10, geometry: 10, weight: 5, value: 6, prefs: 4 };
export const CRITERION_LABEL = {
  use: 'Einsatzzweck', budget: 'Preis & Budget', motor: 'Motor & Akku', range: 'Reichweite', components: 'Komponenten',
  features: 'Ausstattung', geometry: 'Geometrie & Ergonomie', weight: 'Gewicht', value: 'Preis-Leistung', prefs: 'Persönliche Wünsche',
};
const TOLERANCE = 1.05; // 5 % über Budget gelten noch als „knapp“
const FEATURE_LABEL = Object.fromEntries(FEATURES.map((f) => [f.value, f.label]));

const NA = (key) => ({ key, na: true });
const crit = (key, score, notes = []) => ({ key, score, notes });
const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
/** Gewichteter Mittelwert; unbekannte Teile (null) werden ausgelassen. */
const wavg = (pairs) => {
  const k = pairs.filter(([s]) => s != null);
  const w = k.reduce((s, [, x]) => s + x, 0);
  return w ? k.reduce((s, [v, x]) => s + v * x, 0) / w : null;
};

function scoreUse(b, spec, ctx) {
  const total = spec.uses.reduce((s, u) => s + u.weight, 0);
  if (!total) return NA('use');
  const s = spec.uses.reduce((acc, u) => acc + u.weight * affinity(u.type, b.type), 0) / total;
  const best = spec.uses.slice().sort((x, y) => y.weight - x.weight)[0];
  const aff = affinity(best.type, b.type);
  const notes = [aff >= 0.99 ? 'Typ entspricht deinem Hauptzweck' : aff >= 0.5 ? 'Typ passt teilweise zum Hauptzweck' : 'Typ weicht vom Hauptzweck ab'];
  if (spec.driveStrict && spec.drive && b.drive && b.drive !== spec.drive) {
    ctx.fail('use', `Antriebsart ${b.drive} statt gewünscht ${spec.drive}`);
  }
  if (s < 0.3) ctx.fail('use', 'Fahrradtyp passt kaum zum Einsatzzweck');
  return crit('use', s, notes);
}

function scoreBudget(b, spec, ctx, opts) {
  const { min, max } = spec.budget;
  if (opts.ignoreBudget || (max == null && min == null)) return NA('budget');
  const p = b.price?.amount;
  if (!isNum(p)) { ctx.unknown('budget', 'Preis nicht verifiziert'); return crit('budget', null, ['Preis unbekannt']); }
  if (max != null && p > max * TOLERANCE) {
    ctx.fail('budget', `Preis ${Math.round(p)} € liegt über dem Budget (${max} €)`);
    return crit('budget', clamp(1 - (p - max) / max, 0, 0.4), [`${Math.round(p - max)} € über Budget`]);
  }
  if (max != null && p > max) return crit('budget', 0.6, ['Knapp über Budget (< 5 %)']);
  if (min != null && p < min * 0.6) return crit('budget', 0.85, ['Deutlich unter Budget – Qualitätsniveau prüfen']);
  return crit('budget', 1, ['Im Budget']);
}

function scoreMotor(b, spec, ctx) {
  if (!spec.electric) return NA('motor');
  const m = spec.motor, bat = spec.battery;
  if (b.drive === 'classic') return crit('motor', 0, ['Kein Motor']);
  const parts = [], notes = [];
  if (m.brands.length) {
    if (!b.motor?.brand) parts.push([null, 2]);
    else {
      const ok = m.brands.some((x) => b.motor.brand.toLowerCase().includes(x.toLowerCase()));
      parts.push([ok ? 1 : 0.35, 2]);
      notes.push(ok ? `Motor ${b.motor.brand} wie gewünscht` : `Motor ${b.motor.brand} (nicht bevorzugt)`);
    }
  }
  if (m.concept !== 'any') {
    if (!b.motor?.concept) parts.push([null, 1]);
    else { const ok = b.motor.concept === m.concept; parts.push([ok ? 1 : 0.3, 1]); if (!ok) notes.push('Anderes Antriebskonzept'); }
  }
  const implied = { low: 40, normal: 55, strong: 75 }[m.steep];
  const needNm = Math.max(m.torqueMin, spec.climbM100 >= 1500 ? implied : 0);
  if (needNm) {
    if (!isNum(b.motor?.torqueNm)) parts.push([null, 2]);
    else { parts.push([clamp(b.motor.torqueNm / needNm, 0, 1), 2]); notes.push(`${b.motor.torqueNm} Nm (Ziel ≥ ${needNm} Nm)`); }
  }
  if (m.feel !== 'any' && isNum(b.motor?.torqueNm)) {
    const t = b.motor.torqueNm;
    parts.push([m.feel === 'powerful' ? clamp((t - 55) / 30, 0.2, 1) : clamp(1.2 - Math.max(0, t - 65) / 40, 0.4, 1), 1]);
  }
  if (bat.whMin) {
    if (!isNum(b.battery?.wh)) { parts.push([null, 3]); ctx.unknown('motor', 'Akkukapazität nicht verifiziert'); }
    else {
      const r = b.battery.wh / bat.whMin;
      parts.push([clamp(r, 0, 1), 3]);
      notes.push(`${b.battery.wh} Wh (Empfehlung ≈ ${bat.whMin} Wh)`);
      if (r < 0.7) ctx.fail('motor', `Akku zu klein: ${b.battery.wh} Wh statt ≈ ${bat.whMin} Wh`);
    }
  }
  if (bat.removable !== 'any' && b.battery?.removable != null) {
    const ok = (bat.removable === 'removable') === b.battery.removable;
    parts.push([ok ? 1 : 0.3, 1]);
    if (!ok) notes.push(`Akku ${b.battery.removable ? 'herausnehmbar' : 'integriert'}`);
  }
  if (bat.extender) parts.push([b.battery?.extenderSupport == null ? null : b.battery.extenderSupport ? 1 : 0.3, 1]);
  if (bat.chargeMaxH && isNum(b.battery?.chargeHours)) parts.push([b.battery.chargeHours <= bat.chargeMaxH ? 1 : 0.4, 1]);
  const s = wavg(parts);
  return crit('motor', s, notes.length ? notes : s == null ? ['Motor-/Akku-Daten fehlen'] : ['Motor und Akku passen']);
}

export function bikeRange(b, spec) {
  if (!spec.electric || !isNum(b.battery?.wh)) return null;
  return estimateRange({ wh: b.battery.wh, ...spec.rangeProfile, bikeKg: b.weightKg ?? spec.rangeProfile.bikeKg });
}

function scoreRange(b, spec, ctx) {
  if (!spec.electric || !spec.battery.rangeKm) return NA('range');
  const r = bikeRange(b, spec);
  if (r == null) return crit('range', null, ['Reichweite nicht berechenbar (Akku unbekannt)']);
  const t = spec.battery.rangeKm;
  if (r < t * 0.75) ctx.fail('range', `Geschätzte Reichweite ${r} km < gewünscht ${t} km`);
  return crit('range', r >= t ? 1 : Math.pow(r / t, 1.2), [`≈ ${r} km geschätzt (Wunsch ${t} km)`]);
}

const BRAKE_Q = { hydraulic: 1, mechanical: 0.6, rim: 0.4 };
const NAMES = {
  drivetrain: { chain: 'Kettenschaltung', hub: 'Nabenschaltung', electronic: 'elektronische Schaltung' },
  brakes: { hydraulic: 'hydraulische Scheibenbremsen', mechanical: 'mechanische Scheibenbremsen', rim: 'Felgenbremsen' },
  suspension: { none: 'ungefedert', fork: 'Federgabel', full: 'Fully' },
};
function scoreComponents(b, spec, ctx) {
  const e = spec.equipment, parts = [], notes = [];
  const check = (key, label, score, weight, want, have) => {
    if (score == null) { parts.push([null, weight]); if (e.must.has(key)) ctx.unknown('components', `${label} nicht verifiziert`); return; }
    parts.push([score, weight]);
    if (score < 0.5) {
      notes.push(`${label}: ${have}`);
      if (e.must.has(key)) ctx.fail('components', `${label}: ${have} statt ${want}`);
    }
  };
  const dt = b.drivetrain?.type;
  if (e.drivetrain !== 'any') {
    const s = dt ? (dt === e.drivetrain ? 1 : e.drivetrain === 'chain' && dt === 'electronic' ? 0.8 : 0.2) : null;
    check('drivetrain', 'Schaltung', s, 2, NAMES.drivetrain[e.drivetrain], NAMES.drivetrain[dt] ?? dt);
  }
  if (e.gears !== 'any') {
    const g = b.drivetrain?.gears;
    const s = isNum(g) ? (e.gears === 'few' ? (g <= 8 ? 1 : 0.3) : g >= 10 ? 1 : 0.3) : null;
    check('gears', 'Gangzahl', s, 1, e.gears === 'few' ? 'bis 8 Gänge' : '10+ Gänge', `${g} Gänge`);
  }
  if (e.gearBrands.length && b.drivetrain?.brand) {
    const ok = e.gearBrands.some((x) => b.drivetrain.brand.toLowerCase().includes(x.toLowerCase()));
    parts.push([ok ? 1 : 0.4, 1]);
    if (ok) notes.push(`Schaltung von ${b.drivetrain.brand}`);
  }
  const br = b.brakes?.type;
  if (e.brakes === 'any') parts.push([br ? BRAKE_Q[br] ?? 0.5 : null, 1]);
  else {
    const s = br ? (br === e.brakes ? 1 : e.brakes === 'mechanical' && br === 'hydraulic' ? 0.85 : e.brakes === 'rim' ? 0.7 : 0.2) : null;
    check('brakes', 'Bremsen', s, 2, NAMES.brakes[e.brakes], NAMES.brakes[br] ?? br);
  }
  const su = b.suspension?.type;
  if (e.suspension !== 'any') {
    const m = { none: { none: 1, fork: 0.5, full: 0.3 }, fork: { none: 0.2, fork: 1, full: 0.6 }, full: { none: 0.1, fork: 0.3, full: 1 } };
    check('suspension', 'Federung', su ? m[e.suspension][su] : null, 2, NAMES.suspension[e.suspension], NAMES.suspension[su] ?? su);
    if (['fork', 'full'].includes(e.suspension) && e.travel !== 'any' && su && su !== 'none') {
      const t = Math.max(b.suspension.travelFrontMm ?? 0, b.suspension.travelRearMm ?? 0);
      const [lo, hi] = { xc: [0, 100], trail: [100, 140], enduro: [140, 170], dh: [170, 300] }[e.travel];
      if (t) { const ok = t >= lo - 10 && t <= hi + 10; parts.push([ok ? 1 : 0.4, 1]); if (!ok) notes.push(`Federweg ${t} mm`); }
      else parts.push([null, 1]);
    }
  } else if (spec.terrain.includes('technical')) {
    parts.push([su ? (su === 'none' ? 0.3 : 1) : null, 1]);
    if (su === 'none') notes.push('Ungefedert, aber technisches Gelände gewünscht');
  }
  const s = wavg(parts);
  return crit('components', s, notes.length ? notes : ['Komponenten passen']);
}

const featureLabel = (k) => FEATURE_LABEL[k] ?? k;
function scoreFeatures(b, spec, ctx) {
  const entries = Object.entries(spec.features);
  const tw = spec.equipment.tireWidth;
  if (!entries.length && tw === 'any') return NA('features');
  const parts = [], notes = [];
  for (const [k, level] of entries) {
    const has = b.features?.[k];
    const w = level === 'must' ? 2 : 1;
    if (has === undefined || has === null) {
      parts.push([null, w]);
      if (level === 'must') ctx.unknown('features', `${featureLabel(k)} nicht verifiziert`);
    } else {
      parts.push([has ? 1 : level === 'must' ? 0 : 0.3, w]);
      if (!has) {
        notes.push(`${featureLabel(k)} fehlt`);
        if (level === 'must') ctx.fail('features', `Muss-Ausstattung fehlt: ${featureLabel(k)}`);
      }
    }
  }
  if (tw !== 'any') {
    const w = b.tires?.widthMm;
    if (!isNum(w)) parts.push([null, 1]);
    else { const ok = tw === 'wide' ? w >= 50 : w <= 35; parts.push([ok ? 1 : 0.4, 1]); if (!ok) notes.push(`Reifenbreite ${w} mm`); }
  }
  const ok = entries.filter(([k]) => b.features?.[k]).length;
  return crit('features', wavg(parts), notes.length ? notes : [`${ok}/${entries.length} gewünschte Merkmale vorhanden`]);
}

function scoreGeometry(b, spec, ctx) {
  const parts = [], notes = [];
  const rec = spec.ergo.frameOverride ? { ...(spec.ergo.frame ?? {}), letter: spec.ergo.frameOverride, cm: null } : spec.ergo.frame;
  if (rec) {
    const fit = sizeFit(rec, b.frameSizes);
    if (fit === 'unknown') parts.push([null, 3]);
    else {
      parts.push([fit === 'exact' ? 1 : fit === 'near' ? 0.6 : 0, 3]);
      notes.push(fit === 'exact' ? `Größe ${rec.letter} verfügbar` : fit === 'near' ? `Nur Nachbargröße zu ${rec.letter} verfügbar` : `Größe ${rec.letter} nicht verfügbar`);
      if (fit === 'none') ctx.fail('geometry', `Empfohlene Rahmengröße ${rec.letter} nicht verfügbar`);
    }
  }
  const pos = TYPE_POSITION[b.type];
  if (pos) {
    const order = ['sporty', 'balanced', 'upright'];
    parts.push([[1, 0.6, 0.2][Math.abs(order.indexOf(pos) - order.indexOf(spec.ergo.position))], 1.5]);
  }
  if (spec.ergo.frameShape !== 'any' && b.frameShape) {
    const ok = b.frameShape === spec.ergo.frameShape;
    parts.push([ok ? 1 : 0.4, 1]);
    if (!ok) notes.push('Andere Rahmenform');
  }
  const need = spec.ergo.maxSystemWeight ?? ((spec.ergo.weightKg ?? 0) + spec.ergo.luggageKg + (b.weightKg ?? 0));
  if (need && isNum(b.maxSystemWeightKg)) {
    const ok = b.maxSystemWeightKg >= need;
    parts.push([ok ? 1 : 0, 2]);
    if (!ok) ctx.fail('geometry', `Zul. Systemgewicht ${b.maxSystemWeightKg} kg < benötigt ${need} kg`);
  } else if (spec.ergo.maxSystemWeight) {
    parts.push([null, 1]);
    ctx.unknown('geometry', 'Zul. Systemgewicht nicht verifiziert');
  }
  return crit('geometry', wavg(parts), notes.length ? notes : ['Geometrie plausibel']);
}

function scoreWeight(b) {
  if (!isNum(b.weightKg)) return crit('weight', null, ['Gewicht unbekannt']);
  const [lo, hi] = typicalWeight(b.type, b.drive);
  const s = clamp(1 - (b.weightKg - lo) / (hi - lo), 0, 1);
  return crit('weight', 0.15 + 0.85 * s, [`${b.weightKg} kg (typisch ${lo}–${hi} kg)`]);
}

/** Preis-Leistung = technische Teilnoten im Verhältnis zum Preis (Heuristik, siehe docs/ARCHITECTURE.md). */
function scoreValue(b, spec, partial) {
  const p = b.price?.amount;
  const tech = avg(['components', 'motor', 'weight', 'features'].map((k) => partial[k]?.score).filter((x) => x != null));
  if (!isNum(p) || tech == null) return crit('value', null, ['Preis-Leistung nicht bewertbar']);
  const ref = spec.budget.max ?? spec.budget.min ?? p;
  // Preis am Budgetrand ≈ 0.75, halber Budgetpreis ≈ 1.0 (günstiger bei gleicher Technik = bessere Preis-Leistung)
  const priceFactor = clamp(1.25 - 0.5 * (p / (ref || p)), 0.3, 1.15);
  const disc = isNum(b.price.discountPct) ? clamp(b.price.discountPct / 100, 0, 0.4) : 0;
  return crit('value', clamp((tech * priceFactor) / 0.85 + disc * 0.5, 0, 1), [disc ? `${Math.round(disc * 100)} % Rabatt eingerechnet` : 'Ausstattung im Verhältnis zum Preis']);
}

function scorePrefs(b, spec) {
  const parts = [], notes = [];
  if (spec.brandsPreferred.length) {
    const ok = spec.brandsPreferred.some((x) => x.toLowerCase() === b.brand.toLowerCase());
    parts.push([ok ? 1 : spec.valueOverBrand ? 0.8 : 0.4, 2]);
    if (ok) notes.push('Bevorzugter Hersteller');
  }
  if (spec.ergo.material.length && b.material) {
    const ok = spec.ergo.material.includes(b.material);
    parts.push([ok ? 1 : 0.4, 1]);
    if (!ok) notes.push('Anderes Rahmenmaterial');
  }
  if (spec.deals) parts.push([isNum(b.price?.discountPct) && b.price.discountPct > 0 ? 1 : 0.5, 1]);
  return parts.length ? crit('prefs', wavg(parts), notes) : NA('prefs');
}

function checkHard(b, spec, ctx) {
  if (spec.brandsExcluded.some((x) => x.toLowerCase() === b.brand.toLowerCase())) ctx.fail('prefs', `Hersteller ${b.brand} ist ausgeschlossen`);
  if (spec.condition !== 'any' && b.condition && b.condition !== spec.condition) ctx.fail('prefs', `Zustand: ${b.condition === 'used' ? 'gebraucht' : 'neu'}`);
}

/**
 * Bewertet ein Fahrrad (0..100). Muss-Verstöße deckeln den Score bei max. 64 %, unverifizierte Muss-Kriterien bei 85 %.
 * @returns {{score:number, rawScore:number, verdict:string, criteria:object[], fails:object[], unknowns:object[], confidence:number, estimatedRange:number|null}}
 */
export function scoreBike(bike, answersOrSpec, opts = {}) {
  const spec = Array.isArray(answersOrSpec.uses) ? answersOrSpec : buildSpec(answersOrSpec);
  const ctx = {
    fails: [], unknowns: [],
    fail(key, text) { this.fails.push({ key, text }); },
    unknown(key, text) { this.unknowns.push({ key, text }); },
  };
  const partial = {};
  partial.use = scoreUse(bike, spec, ctx);
  partial.budget = scoreBudget(bike, spec, ctx, opts);
  partial.motor = scoreMotor(bike, spec, ctx);
  partial.range = scoreRange(bike, spec, ctx);
  partial.components = scoreComponents(bike, spec, ctx);
  partial.features = scoreFeatures(bike, spec, ctx);
  partial.geometry = scoreGeometry(bike, spec, ctx);
  partial.weight = scoreWeight(bike);
  partial.value = scoreValue(bike, spec, partial);
  partial.prefs = scorePrefs(bike, spec);
  checkHard(bike, spec, ctx);

  const weights = { ...WEIGHTS, weight: WEIGHTS.weight + (spec.style / 100) * 5 };
  let sum = 0, wsum = 0, known = 0;
  const criteria = [];
  for (const [k, c] of Object.entries(partial)) {
    if (c.na) continue;
    const w = weights[k];
    sum += (c.score ?? 0.5) * w; wsum += w;
    if (c.score != null) known += w;
    criteria.push({ key: k, label: CRITERION_LABEL[k], weight: Math.round(w * 10) / 10, score: c.score == null ? null : Math.round(c.score * 100), notes: c.notes });
  }
  const raw = wsum ? (sum / wsum) * 100 : 0;
  let score = raw;
  if (ctx.fails.length) score = Math.max(15, Math.min(score, 64 - 6 * (ctx.fails.length - 1)));
  else if (ctx.unknowns.length) score = Math.min(score, 85);
  const verdict = ctx.fails.length ? 'mismatch' : ctx.unknowns.length ? 'unverified' : score >= 85 ? 'excellent' : score >= 70 ? 'good' : 'compromise';
  return {
    score: Math.round(score), rawScore: Math.round(raw), verdict, criteria, fails: ctx.fails, unknowns: ctx.unknowns,
    confidence: wsum ? Math.round((known / wsum) * 100) : 0, estimatedRange: bikeRange(bike, spec),
  };
}
