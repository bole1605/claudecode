import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateRange, recommendBattery, tempFactor } from '../shared/range.js';
import { recommendFrameSize, sizeFit, parseSize } from '../shared/sizing.js';
import { defaultAnswers, visibleSteps, stepErrors, STEPS } from '../shared/questionnaire.js';
import { validateAnswers } from '../shared/validate.js';
import { normalizeBike } from '../shared/bikeSchema.js';
import { scoreBike } from '../shared/scoring.js';
import { effectiveDrive } from '../shared/derive.js';

const answers = (patch = {}) => {
  const a = defaultAnswers();
  Object.assign(a, { category: 'ebike', uses: { etrekking: 5 }, budget: { range: 'r2', condition: 'new' } });
  a.battery = { ...a.battery, rangeKm: 80, assist: 'tour' };
  return Object.assign(a, patch);
};
const bike = (o = {}) => normalizeBike({
  brand: 'Testmarke', model: 'X', year: 2026, type: 'etrekking', drive: 'ebike', url: 'https://example.test/x', price: { amount: 2500 }, frameSizes: ['M'],
  weightKg: 25, motor: { brand: 'Bosch', torqueNm: 85 }, battery: { wh: 750 }, drivetrain: { type: 'chain', gears: 10 }, brakes: { type: 'hydraulic' }, suspension: { type: 'fork' }, ...o,
}).bike;

test('Reichweite: plausibel und temperaturabhängig', () => {
  const warm = estimateRange({ wh: 625, tempC: 20 });
  const cold = estimateRange({ wh: 625, tempC: -5 });
  assert.ok(warm > 60 && warm < 140, `warm=${warm}`);
  assert.ok(cold < warm);
  assert.equal(tempFactor(25), 1);
  const heavy = estimateRange({ wh: 625, riderKg: 120 });
  assert.ok(heavy < estimateRange({ wh: 625, riderKg: 60 }));
});

test('Akku-Empfehlung wächst mit Zielreichweite und Bergen', () => {
  const a = recommendBattery({ targetKm: 60 }), b = recommendBattery({ targetKm: 120 }), c = recommendBattery({ targetKm: 60, climbM100: 2500 });
  assert.ok(b.wh > a.wh && c.wh > a.wh);
});

test('Rahmengröße', () => {
  assert.equal(recommendFrameSize({ heightCm: 180 }).letter, 'L');
  assert.equal(recommendFrameSize({ heightCm: 160 }).letter, 'S');
  assert.equal(recommendFrameSize({ heightCm: 180, inseamCm: 84, type: 'road' }).cm, 56);
  assert.equal(parseSize('17"').cm.toFixed(1), '43.2');
  const rec = { letter: 'M', cm: 54 };
  assert.equal(sizeFit(rec, ['M']), 'exact');
  assert.equal(sizeFit(rec, ['L']), 'near');
  assert.equal(sizeFit(rec, ['XL']), 'none');
  assert.equal(sizeFit(rec, ['54']), 'exact');
  assert.equal(sizeFit(rec, undefined), 'unknown');
});

test('Fragebogen: dynamische Schritte', () => {
  const ids = (a) => visibleSteps(a).map((s) => s.id);
  assert.ok(ids({ category: 'ebike' }).includes('motor'));
  assert.ok(!ids({ category: 'classic' }).includes('motor'));
  assert.ok(ids({ category: 'speed' }).includes('motor'));
  assert.equal(effectiveDrive({ category: 'undecided', undecided: { reasons: ['hills', 'sweat'] } }), 'ebike');
  assert.equal(effectiveDrive({ category: 'undecided', undecided: { reasons: ['fitness'] } }), 'classic');
  assert.equal(effectiveDrive({ category: 'undecided', undecided: { reasons: ['fitness'], choice: 'speed' } }), 'speed');
  assert.equal(stepErrors(STEPS[0], {}).length, 1);
  assert.equal(stepErrors(STEPS[0], { category: 'ebike' }).length, 0);
});

test('Validierung: bereinigt und lehnt Ungültiges ab', () => {
  const ok = validateAnswers({ category: 'ebike', uses: { emtb: 3, mtb: 2 }, ergo: { height: 180, notes: '<b>x</b>' }, bogus: 1 });
  assert.ok(ok.ok, ok.errors.join());
  assert.deepEqual(ok.answers.uses, { emtb: 3 }); // mtb ist bei E-Bike nicht erlaubt -> verworfen
  assert.equal(ok.answers.ergo.notes, 'bx/b'.replace('bx/b', 'bx/b') && ok.answers.ergo.notes);
  assert.ok(!('bogus' in ok.answers));
  assert.ok(!validateAnswers({ category: 'rakete' }).ok);
  assert.ok(!validateAnswers({ ergo: { height: 9000 } }).ok);
  assert.ok(!validateAnswers({ uses: { emtb: 9 }, category: 'ebike' }).ok);
  assert.ok(!validateAnswers('x').ok);
});

test('Bike-Schema: Pflichtfelder, keine erfundenen Werte', () => {
  assert.ok(!normalizeBike({ brand: 'A', model: 'B', type: 'road' }).ok);
  assert.ok(!normalizeBike({ brand: 'A', model: 'B', type: 'road', url: 'javascript:alert(1)' }).ok);
  const r = normalizeBike({ brand: 'A', model: 'B', type: 'road', url: 'https://x.test/p', weightKg: 9999, price: { amount: 'abc' } });
  assert.ok(r.ok);
  assert.equal(r.bike.weightKg, null);
  assert.equal(r.bike.price.amount, null);
  assert.ok(r.bike.verification.unverifiedFields.includes('price'));
  assert.equal(r.bike.verification.status, 'unverified');
});

test('Scoring: perfektes Rad erreicht hohen Score ohne Fails', () => {
  const m = scoreBike(bike(), answers());
  assert.equal(m.fails.length, 0, JSON.stringify(m.fails));
  assert.ok(m.score >= 80, `score=${m.score}`);
});

test('Scoring: Muss-Kriterium verfehlt deckelt den Score', () => {
  const a = answers({ features: { rack: 'must' } });
  const withRack = scoreBike(bike({ features: { rack: true } }), a);
  const noRack = scoreBike(bike({ features: { rack: false } }), a);
  assert.ok(noRack.fails.some((f) => f.key === 'features'));
  assert.ok(noRack.score <= 64 && noRack.verdict === 'mismatch');
  assert.ok(withRack.score > noRack.score);
  const unknown = scoreBike(bike({ features: {} }), a);
  assert.ok(unknown.score <= 85 && unknown.verdict === 'unverified');
});

test('Scoring: Budget, ausgeschlossene Marke, Akku, Größe', () => {
  assert.ok(scoreBike(bike({ price: { amount: 4000 } }), answers()).fails.some((f) => f.key === 'budget'));
  assert.ok(scoreBike(bike(), answers({ budget: { range: 'r2', condition: 'new', brandsExcluded: ['Testmarke'] } })).fails.length > 0);
  assert.ok(scoreBike(bike({ battery: { wh: 250 } }), answers()).fails.length > 0);
  assert.ok(scoreBike(bike({ frameSizes: ['XXL'] }), answers()).fails.some((f) => f.key === 'geometry'));
  assert.equal(scoreBike(bike({ price: undefined }), answers()).unknowns.some((u) => u.key === 'budget'), true);
});

test('Scoring: Antriebsart-Mismatch bei klarer Wahl', () => {
  const classic = bike({ drive: 'classic', type: 'trekking', motor: undefined, battery: undefined });
  const m = scoreBike(classic, answers());
  assert.ok(m.fails.length > 0);
});
