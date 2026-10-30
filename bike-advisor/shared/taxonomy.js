// Zentrale Begriffe. Neue Typen/Ausstattungen/Marken hier ergänzen – UI, Validierung und Scoring ziehen nach.

export const DRIVES = {
  ebike: 'E-Bike / Pedelec',
  classic: 'Klassisches Fahrrad',
  speed: 'S-Pedelec',
};

// drives: für welche Antriebsart die Option angeboten wird
export const USES = [
  { value: 'mtb', label: 'Mountainbike (MTB)', drives: ['classic'] },
  { value: 'emtb', label: 'E-Mountainbike (Fully/Hardtail)', drives: ['ebike'] },
  { value: 'trekking', label: 'Trekkingrad', drives: ['classic'] },
  { value: 'etrekking', label: 'E-Trekkingbike', drives: ['ebike', 'speed'] },
  { value: 'city', label: 'Citybike', drives: ['classic'] },
  { value: 'ecity', label: 'E-Citybike', drives: ['ebike', 'speed'] },
  { value: 'gravel', label: 'Gravelbike', drives: ['classic', 'ebike'] },
  { value: 'road', label: 'Rennrad', drives: ['classic', 'ebike'] },
  { value: 'cross', label: 'Crossbike', drives: ['classic', 'ebike'] },
  { value: 'fitness', label: 'Fitnessbike', drives: ['classic'] },
  { value: 'cargo', label: 'Lastenrad', drives: ['classic', 'ebike'] },
  { value: 'touring', label: 'Touren- und Reiserad', drives: ['classic', 'ebike', 'speed'] },
  { value: 'commute', label: 'Alltags- und Pendlerfahrrad', drives: ['classic', 'ebike', 'speed'] },
  { value: 'allround', label: 'Mehrzweckfahrrad', drives: ['classic', 'ebike', 'speed'] },
];
export const TYPE_LABEL = Object.fromEntries(USES.map((u) => [u.value, u.label]));
export const TYPES = USES.map((u) => u.value);

const PAIRS = [
  ['mtb', 'emtb', 0.6], ['mtb', 'cross', 0.35], ['mtb', 'gravel', 0.3], ['emtb', 'gravel', 0.2], ['emtb', 'etrekking', 0.3],
  ['trekking', 'etrekking', 0.85], ['trekking', 'touring', 0.8], ['etrekking', 'touring', 0.75], ['trekking', 'cross', 0.6],
  ['trekking', 'commute', 0.6], ['trekking', 'allround', 0.65], ['etrekking', 'allround', 0.65], ['etrekking', 'ecity', 0.6],
  ['etrekking', 'commute', 0.6], ['etrekking', 'cross', 0.5], ['city', 'ecity', 0.85], ['city', 'commute', 0.65], ['ecity', 'commute', 0.65],
  ['city', 'allround', 0.6], ['ecity', 'allround', 0.6], ['ecity', 'touring', 0.3], ['gravel', 'road', 0.45], ['gravel', 'cross', 0.6],
  ['gravel', 'touring', 0.55], ['gravel', 'allround', 0.4], ['gravel', 'commute', 0.4], ['road', 'fitness', 0.6], ['fitness', 'cross', 0.65],
  ['fitness', 'commute', 0.5], ['fitness', 'city', 0.35], ['cross', 'commute', 0.5], ['cross', 'allround', 0.5], ['cargo', 'ecity', 0.3],
  ['cargo', 'allround', 0.3], ['touring', 'allround', 0.5], ['touring', 'commute', 0.4], ['commute', 'allround', 0.6],
];
const AFF = new Map();
for (const [a, b, w] of PAIRS) { AFF.set(`${a}|${b}`, w); AFF.set(`${b}|${a}`, w); }
/** Wie gut passt ein Fahrradtyp zu einem gewünschten Einsatzzweck (0..1). */
export const affinity = (use, bikeType) => (use === bikeType ? 1 : AFF.get(`${use}|${bikeType}`) ?? 0);

// Typische Sitzposition je Typ (für Ergonomie-Score)
export const TYPE_POSITION = {
  road: 'sporty', mtb: 'balanced', emtb: 'balanced', gravel: 'balanced', fitness: 'sporty', cross: 'balanced',
  trekking: 'upright', etrekking: 'upright', city: 'upright', ecity: 'upright', cargo: 'upright', touring: 'balanced',
  commute: 'balanced', allround: 'upright',
};

// Typische Gewichtsspanne (leicht, schwer) in kg
export function typicalWeight(type, drive) {
  const classic = {
    mtb: [10.5, 15.5], trekking: [13.5, 18], city: [14, 19], gravel: [8.5, 12], road: [7, 10], cross: [10, 14],
    fitness: [9, 12.5], cargo: [28, 42], touring: [14, 18.5], commute: [11, 17], allround: [14, 18],
  };
  const ebikeNative = { emtb: [19, 25.5], etrekking: [23, 30], ecity: [22, 29.5] };
  if (ebikeNative[type]) return ebikeNative[type];
  const base = classic[type] ?? [12, 18];
  if (drive === 'classic') return base;
  const shift = type === 'road' || type === 'gravel' ? 4 : type === 'cargo' ? 8 : 10;
  return [base[0] + shift - 1, base[1] + shift + 1];
}

export const FEATURES = [
  { value: 'rack', label: 'Gepäckträger' },
  { value: 'fenders', label: 'Schutzbleche' },
  { value: 'lights', label: 'Beleuchtung (StVZO)' },
  { value: 'kickstand', label: 'Seitenständer' },
  { value: 'stand', label: 'Fahrradständer (Zweibein/Parkständer)' },
  { value: 'lock', label: 'Fahrradschloss (integriert)' },
  { value: 'luggageMounts', label: 'Gepäcktransport (Taschen-/Korbaufnahmen)' },
  { value: 'kidSeat', label: 'Kindersitz-Kompatibilität' },
  { value: 'trailer', label: 'Anhänger-Kompatibilität' },
  { value: 'tubeless', label: 'Tubeless-Reifen' },
  { value: 'comfortSaddle', label: 'Komfortsattel' },
  { value: 'ergoGrips', label: 'Ergonomische Griffe' },
];

export const BUDGET_RANGES = [
  { value: 'u1', label: 'Unter 1.000 €', min: 0, max: 1000 },
  { value: 'r1', label: '1.000–2.000 €', min: 1000, max: 2000 },
  { value: 'r2', label: '2.000–3.000 €', min: 2000, max: 3000 },
  { value: 'r3', label: '3.000–4.000 €', min: 3000, max: 4000 },
  { value: 'r4', label: '4.000–5.000 €', min: 4000, max: 5000 },
  { value: 'r5', label: '5.000–7.000 €', min: 5000, max: 7000 },
  { value: 'r7', label: '7.000–10.000 €', min: 7000, max: 10000 },
  { value: 'o10', label: 'Über 10.000 €', min: 10000, max: null },
  { value: 'custom', label: 'Individuelles Budget', min: null, max: null },
];

export const MOTOR_BRANDS = ['Bosch', 'Shimano', 'Yamaha', 'Brose', 'Specialized', 'Fazua', 'TQ', 'DJI Avinox', 'Bafang', 'Panasonic', 'Pinion MGU'];
export const GEAR_BRANDS = ['Shimano', 'SRAM', 'Rohloff', 'Pinion', 'Enviolo', 'Campagnolo'];
export const MATERIALS = [
  { value: 'aluminium', label: 'Aluminium' },
  { value: 'carbon', label: 'Carbon' },
  { value: 'steel', label: 'Stahl' },
];
export const FRAME_LETTERS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
