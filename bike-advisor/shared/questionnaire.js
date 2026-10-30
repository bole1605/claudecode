// Schema-getriebener Fragebogen: Rendering (Client), Sichtbarkeit (dynamische Fragen) und Validierung (Server) nutzen dieselbe Quelle.
import { USES, FEATURES, BUDGET_RANGES, MOTOR_BRANDS, GEAR_BRANDS, MATERIALS, FRAME_LETTERS } from './taxonomy.js';
import { getPath } from './util.js';
import { effectiveDrive, isElectric, undecidedSuggestion, batteryAdvice, frameAdvice } from './derive.js';

const opt = (value, label, desc) => ({ value, label, ...(desc ? { desc } : {}) });

export const STEPS = [
  {
    id: 'type', title: 'Fahrradart', subtitle: 'Mit oder ohne Motor?',
    fields: [
      { id: 'category', type: 'single', label: 'Welche Art von Fahrrad suchst du?', required: true, options: [
        opt('ebike', 'E-Bike / Pedelec', 'Motorunterstützung bis 25 km/h'),
        opt('classic', 'Klassisches Fahrrad', 'Ohne Motor'),
        opt('speed', 'S-Pedelec', 'Unterstützung bis 45 km/h, Versicherungskennzeichen'),
        opt('undecided', 'Noch unentschlossen', 'Beratung gewünscht'),
      ] },
      { id: 'undecided.reasons', type: 'multi', label: 'Was trifft auf dich zu?', help: 'Daraus leiten wir eine Empfehlung ab.',
        visible: (a) => a.category === 'undecided', options: [
          opt('hills', 'Ich fahre viel bergauf'), opt('distance', 'Meine Strecken sind lang (> 25 km)'),
          opt('sweat', 'Ich will ohne Schwitzen ankommen'), opt('load', 'Ich transportiere Lasten oder Kinder'),
          opt('fitness', 'Ich will Sport/Training machen'), opt('weight', 'Ich will ein leichtes, einfaches Rad'),
          opt('speed', 'Ich will dauerhaft schnell (> 25 km/h) pendeln'),
        ] },
      { id: '_ins_undecided', type: 'insight', visible: (a) => a.category === 'undecided', compute: undecidedSuggestion },
      { id: 'undecided.choice', type: 'single', label: 'Deine Entscheidung', visible: (a) => a.category === 'undecided', default: 'auto', options: [
        opt('auto', 'Der Empfehlung folgen'), opt('ebike', 'E-Bike'), opt('classic', 'Ohne Motor'), opt('speed', 'S-Pedelec'),
      ] },
    ],
  },
  {
    id: 'use', title: 'Einsatzzweck', subtitle: 'Wofür brauchst du das Rad?',
    fields: [
      { id: 'uses', type: 'weighted', required: true, label: 'Hauptsächlicher Einsatzzweck', help: 'Mehrfachauswahl möglich – gewichte, wie wichtig jeder Zweck ist (1 = nebensächlich, 5 = Hauptzweck).',
        options: (a) => USES.filter((u) => u.drives.includes(effectiveDrive(a) ?? 'classic') || effectiveDrive(a) == null).map((u) => opt(u.value, u.label)) },
    ],
  },
  {
    id: 'profile', title: 'Fahrprofil', subtitle: 'Wie und wo du fährst',
    fields: [
      { id: 'usage.frequency', type: 'single', label: 'Wie häufig nutzt du das Rad?', options: [
        opt('daily', 'Täglich'), opt('weekly', 'Mehrmals pro Woche'), opt('occasional', 'Etwa wöchentlich'), opt('rare', 'Gelegentlich') ] },
      { id: 'usage.kmPerTrip', type: 'number', label: 'Ø Kilometer pro Fahrt', min: 1, max: 300, step: 1, unit: 'km', default: 15 },
      { id: 'usage.kmPerWeek', type: 'number', label: 'Kilometer pro Woche', min: 1, max: 1500, step: 5, unit: 'km', default: 80 },
      { id: 'usage.terrain', type: 'multi', label: 'Wo fährst du überwiegend?', options: [
        opt('city', 'Stadt'), opt('road', 'Landstraße'), opt('forest', 'Waldwege'), opt('gravel', 'Schotter'), opt('technical', 'Anspruchsvolles Gelände') ] },
      { id: 'usage.climbing', type: 'single', label: 'Steigungen und Berge', options: [
        opt('flat', 'Flach', '≈ 300 hm / 100 km'), opt('rolling', 'Wellig', '≈ 800 hm / 100 km'),
        opt('hilly', 'Hügelig', '≈ 1.500 hm / 100 km'), opt('mountain', 'Bergig / Alpen', '≈ 2.500+ hm / 100 km') ] },
      { id: 'usage.commute', type: 'bool', label: 'Nutzt du das Rad für den Arbeitsweg?' },
      { id: 'usage.commuteKm', type: 'number', label: 'Länge des Arbeitswegs (einfach)', min: 1, max: 100, step: 1, unit: 'km', default: 10, visible: (a) => a.usage?.commute === true },
      { id: 'usage.tours', type: 'bool', label: 'Sind längere Radtouren geplant?' },
      { id: 'usage.vacation', type: 'bool', label: 'Nutzt du das Rad auch auf Urlaubsreisen (mit Gepäck)?' },
      { id: 'usage.allWeather', type: 'bool', label: 'Fährst du bei jedem Wetter (auch Winter)?' },
      { id: 'usage.style', type: 'range', label: 'Sportlich oder komfortabel?', min: 0, max: 100, step: 5, default: 50, labels: ['Komfort', 'Sportlich'] },
    ],
  },
  {
    id: 'motor', title: 'Motor & Akku', subtitle: 'Antrieb und Reichweite',
    visible: (a) => isElectric(a),
    fields: [
      { id: 'motor.brands', type: 'brands', label: 'Bevorzugte Motorhersteller', options: MOTOR_BRANDS, help: 'Leer lassen = egal.' },
      { id: 'motor.concept', type: 'single', label: 'Antriebskonzept', default: 'any', options: [
        opt('any', 'Egal'), opt('mid', 'Mittelmotor'), opt('rear', 'Heckmotor (Nabe)'), opt('front', 'Frontmotor (Nabe)') ] },
      { id: 'motor.torqueMin', type: 'range', label: 'Mindest-Drehmoment', min: 0, max: 100, step: 5, unit: 'Nm', default: 0, labels: ['egal', '100 Nm'] },
      { id: 'motor.steep', type: 'single', label: 'Unterstützung an steilen Anstiegen', default: 'normal', options: [
        opt('low', 'Wenig nötig'), opt('normal', 'Normal'), opt('strong', 'Sehr stark (steile Rampen)') ] },
      { id: 'motor.feel', type: 'single', label: 'Fahrgefühl', default: 'any', options: [
        opt('natural', 'Natürlich, harmonisch'), opt('powerful', 'Besonders kraftvoll'), opt('any', 'Egal') ] },
      { id: 'battery.rangeKm', type: 'number', label: 'Gewünschte Reichweite', min: 20, max: 300, step: 5, unit: 'km', default: 60 },
      { id: 'battery.assist', type: 'single', label: 'Typische Unterstützungsstufe', default: 'tour', options: [
        opt('eco', 'Eco'), opt('tour', 'Tour'), opt('sport', 'Sport / eMTB'), opt('turbo', 'Turbo') ] },
      { id: '_ins_battery', type: 'insight', compute: batteryAdvice },
      { id: 'battery.wh', type: 'number', label: 'Mindest-Akkukapazität (0 = Empfehlung nutzen)', min: 0, max: 2000, step: 25, unit: 'Wh', default: 0 },
      { id: 'battery.removable', type: 'single', label: 'Akku', default: 'any', options: [
        opt('any', 'Egal'), opt('removable', 'Herausnehmbar'), opt('integrated', 'Integriert') ] },
      { id: 'battery.extender', type: 'bool', label: 'Range Extender (Zusatzakku) wichtig?' },
      { id: 'battery.chargeMaxH', type: 'number', label: 'Max. Ladezeit (0 = egal)', min: 0, max: 12, step: 1, unit: 'h', default: 0 },
    ],
  },
  {
    id: 'equipment', title: 'Ausstattung', subtitle: 'Technik und Muss-Merkmale',
    fields: [
      { id: 'equipment.drivetrain', type: 'single', label: 'Schaltung', default: 'any', options: [
        opt('any', 'Egal'), opt('chain', 'Kettenschaltung'), opt('hub', 'Nabenschaltung'), opt('electronic', 'Elektronische Schaltung') ] },
      { id: 'equipment.gears', type: 'single', label: 'Anzahl der Gänge', default: 'any', options: [
        opt('any', 'Egal'), opt('few', 'Wenige (bis 8)'), opt('many', 'Viele (10+)') ] },
      { id: 'equipment.gearBrands', type: 'brands', label: 'Bevorzugte Schaltungshersteller', options: GEAR_BRANDS },
      { id: 'equipment.brakes', type: 'single', label: 'Bremsen', default: 'any', options: [
        opt('any', 'Egal'), opt('hydraulic', 'Hydraulische Scheibenbremsen'), opt('mechanical', 'Mechanische Scheibenbremsen'), opt('rim', 'Felgenbremsen') ] },
      { id: 'equipment.suspension', type: 'single', label: 'Federung', default: 'any', options: [
        opt('any', 'Egal'), opt('none', 'Keine'), opt('fork', 'Federgabel'), opt('full', 'Vollfederung (Fully)') ] },
      { id: 'equipment.travel', type: 'single', label: 'Gewünschter Federweg', default: 'any', visible: (a) => ['fork', 'full'].includes(a.equipment?.suspension),
        options: [opt('any', 'Egal'), opt('xc', 'bis 100 mm'), opt('trail', '100–140 mm'), opt('enduro', '140–170 mm'), opt('dh', '170+ mm')] },
      { id: 'equipment.must', type: 'multi', label: 'Welche dieser Angaben sind Muss-Kriterien?', help: 'Alles andere zählt als Präferenz.', options: [
        opt('drivetrain', 'Schaltungsart'), opt('gears', 'Gangzahl'), opt('brakes', 'Bremsen'), opt('suspension', 'Federung') ] },
      { id: 'features', type: 'must', label: 'Weitere Ausstattung', help: 'Pro Merkmal: Muss, Wunsch oder egal.', options: FEATURES.map((f) => opt(f.value, f.label)) },
      { id: 'equipment.tireWidth', type: 'single', label: 'Reifenbreite', default: 'any', options: [
        opt('any', 'Egal'), opt('wide', 'Breit (≥ 50 mm / Komfort & Grip)'), opt('narrow', 'Schmal (≤ 35 mm / Tempo)') ] },
    ],
  },
  {
    id: 'ergo', title: 'Ergonomie', subtitle: 'Passform und Körperdaten',
    fields: [
      { id: 'ergo.height', type: 'number', required: true, label: 'Körpergröße', min: 130, max: 220, step: 1, unit: 'cm', default: 178 },
      { id: 'ergo.inseam', type: 'number', label: 'Schrittlänge (0 = unbekannt)', min: 0, max: 110, step: 1, unit: 'cm', default: 0 },
      { id: 'ergo.position', type: 'single', label: 'Bevorzugte Sitzposition', default: 'balanced', options: [
        opt('sporty', 'Sportlich'), opt('balanced', 'Ausgewogen'), opt('upright', 'Aufrecht') ] },
      { id: 'ergo.weight', type: 'number', label: 'Fahrergewicht', min: 35, max: 200, step: 1, unit: 'kg', default: 80 },
      { id: 'ergo.luggageKg', type: 'number', label: 'Typisches Zusatzgewicht (Gepäck/Kind)', min: 0, max: 100, step: 1, unit: 'kg', default: 0 },
      { id: 'ergo.maxSystemWeight', type: 'number', label: 'Benötigtes max. Systemgewicht (0 = automatisch)', min: 0, max: 300, step: 5, unit: 'kg', default: 0 },
      { id: '_ins_frame', type: 'insight', compute: frameAdvice },
      { id: 'ergo.frameSize', type: 'single', label: 'Bevorzugte Rahmengröße', default: 'auto', options: [opt('auto', 'Automatisch'), ...FRAME_LETTERS.map((l) => opt(l, l))] },
      { id: 'ergo.frameShape', type: 'single', label: 'Rahmenform', default: 'any', options: [
        opt('any', 'Egal'), opt('diamond', 'Diamant'), opt('trapeze', 'Trapez'), opt('lowstep', 'Tiefeinsteiger') ] },
      { id: 'ergo.material', type: 'multi', label: 'Bevorzugtes Material', options: MATERIALS.map((m) => opt(m.value, m.label)) },
      { id: 'ergo.notes', type: 'text', label: 'Besondere Anforderungen an Komfort/Ergonomie', maxLength: 300, placeholder: 'z. B. Rückenprobleme, kleine Hände, Knie …' },
    ],
  },
  {
    id: 'budget', title: 'Budget & Hersteller', subtitle: 'Rahmen und Vorlieben',
    fields: [
      { id: 'budget.range', type: 'single', required: true, label: 'Budget', options: BUDGET_RANGES.map((b) => opt(b.value, b.label)) },
      { id: 'budget.min', type: 'number', label: 'Budget von', min: 0, max: 50000, step: 100, unit: '€', default: 1000, visible: (a) => a.budget?.range === 'custom' },
      { id: 'budget.max', type: 'number', label: 'Budget bis', min: 100, max: 50000, step: 100, unit: '€', default: 3000, visible: (a) => a.budget?.range === 'custom' },
      { id: 'budget.condition', type: 'single', label: 'Neu oder gebraucht?', default: 'new', options: [opt('new', 'Neu'), opt('used', 'Gebraucht'), opt('any', 'Beides')] },
      { id: 'budget.deals', type: 'bool', label: 'Sind Angebote und Rabatte interessant?' },
      { id: 'budget.brandsPreferred', type: 'brands', label: 'Bevorzugte Hersteller', options: 'brands' },
      { id: 'budget.brandsExcluded', type: 'brands', label: 'Ausgeschlossene Hersteller', options: 'brands' },
      { id: 'budget.valueOverBrand', type: 'bool', label: 'Preis-Leistung wichtiger als eine bestimmte Marke?' },
    ],
  },
];

export const visibleSteps = (answers) => STEPS.filter((s) => !s.visible || s.visible(answers));
export const fieldVisible = (f, answers) => !f.visible || f.visible(answers);
export const fieldOptions = (f, answers) => (typeof f.options === 'function' ? f.options(answers) : f.options);
export const allFields = () => STEPS.flatMap((s) => s.fields);

export function defaultAnswers() {
  const a = {};
  for (const f of allFields()) {
    if (f.type === 'insight' || f.default === undefined) continue;
    const keys = f.id.split('.');
    let o = a;
    for (const k of keys.slice(0, -1)) o = o[k] ??= {};
    o[keys.at(-1)] = f.default;
  }
  a.uses = {}; a.features = {};
  return a;
}

const present = (f, answers) => {
  const v = getPath(answers, f.id);
  if (f.type === 'weighted') return v && Object.keys(v).length > 0;
  if (f.type === 'multi' || f.type === 'brands') return Array.isArray(v) && v.length > 0;
  return v !== undefined && v !== null && v !== '';
};

/** Fehlende Pflichtangaben eines Schritts. */
export function stepErrors(step, answers) {
  return step.fields.filter((f) => f.required && fieldVisible(f, answers) && !present(f, answers)).map((f) => ({ field: f.id, message: `${f.label}: Bitte auswählen` }));
}

export function progress(answers, stepIndex) {
  const steps = visibleSteps(answers);
  return { current: stepIndex + 1, total: steps.length, pct: Math.round((stepIndex / steps.length) * 100) };
}
