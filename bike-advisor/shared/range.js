import { clamp, isNum } from './util.js';

// Grundverbrauch (Wh/km) bei 100 kg Systemgewicht auf flacher Strecke, Motor liefert den Hauptteil
const BASE_WH_KM = { eco: 3.2, tour: 5, sport: 7, turbo: 9.5 };
// Anteil der Steigungsarbeit, den der Motor übernimmt
const CLIMB_SHARE = { eco: 0.25, tour: 0.5, sport: 0.7, turbo: 0.85 };
const TERRAIN = { city: 1.05, road: 0.9, gravel: 1.1, forest: 1.15, technical: 1.3 };

export const ASSIST_LABEL = { eco: 'Eco', tour: 'Tour', sport: 'Sport/eMTB', turbo: 'Turbo' };

/** Nutzbare Kapazität in Abhängigkeit der Temperatur (°C). */
export function tempFactor(tempC) {
  const pts = [[-10, 0.7], [0, 0.85], [10, 0.95], [20, 1]];
  if (tempC <= pts[0][0]) return pts[0][1];
  if (tempC >= 20) return 1;
  for (let i = 1; i < pts.length; i++) {
    if (tempC <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + ((tempC - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 1;
}

/**
 * Verbrauch in Wh/km.
 * @param {{riderKg:number,bikeKg:number,luggageKg:number,assist:string,climbM100:number,terrain:string,tempC:number}} p
 */
export function consumptionWhPerKm({ riderKg = 80, bikeKg = 24, luggageKg = 0, assist = 'tour', climbM100 = 800, terrain = 'road' }) {
  const system = riderKg + bikeKg + luggageKg;
  const weightFactor = 1 + (system - 100) / 250;
  const flat = (BASE_WH_KM[assist] ?? BASE_WH_KM.tour) * weightFactor * (TERRAIN[terrain] ?? 1);
  // Hubarbeit: m*g*h / 3600 / Wirkungsgrad
  const climbWhPerM = (system * 9.81) / 3600 / 0.75;
  // climbM100 = Höhenmeter pro 100 km -> pro km: climbM100 / 100
  const climbWhPerKm = (climbM100 / 100) * climbWhPerM * (CLIMB_SHARE[assist] ?? 0.5);
  return flat + climbWhPerKm;
}

export function estimateRange({ wh, tempC = 15, ...profile }) {
  if (!isNum(wh) || wh <= 0) return null;
  const c = consumptionWhPerKm(profile);
  return Math.round((wh * tempFactor(tempC)) / c);
}

/** Welche Akkukapazität (Wh) ist für die Zielreichweite sinnvoll? Inkl. 15 % Reserve. */
export function recommendBattery({ targetKm, tempC = 15, ...profile }) {
  const c = consumptionWhPerKm(profile);
  const raw = (targetKm * c) / tempFactor(tempC);
  const wh = Math.ceil((raw * 1.15) / 25) * 25;
  const steps = [250, 300, 400, 500, 625, 700, 750, 800, 900, 1000, 1250];
  const marketWh = steps.find((s) => s >= wh) ?? steps.at(-1);
  return { wh: clamp(wh, 150, 2000), marketWh, whPerKm: Math.round(c * 10) / 10 };
}
