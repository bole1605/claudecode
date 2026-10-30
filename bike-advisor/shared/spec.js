// Übersetzt Fragebogen-Antworten in eine maschinenlesbare Suchspezifikation.
import { BUDGET_RANGES } from './taxonomy.js';
import { effectiveDrive, isElectric, primaryUse, rangeProfile, CLIMB_M100 } from './derive.js';
import { recommendBattery } from './range.js';
import { recommendFrameSize } from './sizing.js';

export function buildSpec(a) {
  const drive = effectiveDrive(a);
  const uses = Object.entries(a.uses ?? {}).map(([type, weight]) => ({ type, weight }));
  const r = BUDGET_RANGES.find((b) => b.value === a.budget?.range);
  let budget = { min: null, max: null };
  if (r?.value === 'custom') budget = { min: a.budget.min ?? 0, max: a.budget.max ?? null };
  else if (r) budget = { min: r.min, max: r.max };

  const electric = isElectric(a);
  const profile = rangeProfile(a);
  const wantRange = electric ? a.battery?.rangeKm ?? null : null;
  const recBattery = electric && wantRange ? recommendBattery({ targetKm: wantRange, ...profile }) : null;
  const must = new Set(a.equipment?.must ?? []);

  return {
    drive,
    driveStrict: a.category !== 'undecided',
    uses,
    primaryUse: primaryUse(a),
    budget,
    condition: a.budget?.condition ?? 'new',
    deals: !!a.budget?.deals,
    valueOverBrand: !!a.budget?.valueOverBrand,
    brandsPreferred: a.budget?.brandsPreferred ?? [],
    brandsExcluded: a.budget?.brandsExcluded ?? [],
    electric,
    motor: electric ? {
      brands: a.motor?.brands ?? [], concept: a.motor?.concept ?? 'any', torqueMin: a.motor?.torqueMin || 0,
      steep: a.motor?.steep ?? 'normal', feel: a.motor?.feel ?? 'any',
    } : null,
    battery: electric ? {
      rangeKm: wantRange, whMin: a.battery?.wh || recBattery?.marketWh || null, whRecommended: recBattery?.marketWh ?? null,
      removable: a.battery?.removable ?? 'any', extender: !!a.battery?.extender, chargeMaxH: a.battery?.chargeMaxH || null,
    } : null,
    rangeProfile: profile,
    equipment: {
      drivetrain: a.equipment?.drivetrain ?? 'any', gears: a.equipment?.gears ?? 'any', gearBrands: a.equipment?.gearBrands ?? [],
      brakes: a.equipment?.brakes ?? 'any', suspension: a.equipment?.suspension ?? 'any', travel: a.equipment?.travel ?? 'any',
      tireWidth: a.equipment?.tireWidth ?? 'any', must,
    },
    features: { ...(a.features ?? {}) },
    terrain: a.usage?.terrain ?? [],
    climbM100: CLIMB_M100[a.usage?.climbing] ?? null,
    style: a.usage?.style ?? 50,
    ergo: {
      heightCm: a.ergo?.height ?? null, position: a.ergo?.position ?? 'balanced', weightKg: a.ergo?.weight ?? null,
      luggageKg: a.ergo?.luggageKg ?? 0, maxSystemWeight: a.ergo?.maxSystemWeight || null,
      frameShape: a.ergo?.frameShape ?? 'any', material: a.ergo?.material ?? [],
      frame: recommendFrameSize({ heightCm: a.ergo?.height, inseamCm: a.ergo?.inseam || undefined, type: primaryUse(a), position: a.ergo?.position }),
      frameOverride: a.ergo?.frameSize && a.ergo.frameSize !== 'auto' ? a.ergo.frameSize : null,
    },
  };
}
