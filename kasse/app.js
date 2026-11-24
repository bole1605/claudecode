'use strict';
// Preise in Cent, damit nie Rundungsfehler entstehen.
const STANDS = [
  { id: 'crepes', label: 'Crêpes & Spezi', groups: [
    { name: 'Crêpes', color: '#FF9F0A', items: [
      { id: 'c-zimt',   name: 'Zimt und Zucker', price: 300 },
      { id: 'c-apfel',  name: 'Apfelmus', price: 350 },
      { id: 'c-nutella', name: 'Nutella', price: 400 },
      { id: 'c-nutbana', name: 'Nutella Banane', price: 450 },
      { id: 'c-kaese',  name: 'Käse', price: 350 },
      { id: 'c-kraeuter', name: 'Käse mit Kräutern / Röstzwiebeln', price: 400 },
      { id: 'c-schinken', name: 'Käse mit Schinken', price: 450 },
    ]},
    { name: 'Getränke', color: '#30B0C7', items: [
      { id: 'g-spezi', name: 'Paulaner Spezi', sub: '0,5 l', price: 300 },
    ]},
  ]},
  { id: 'burger', label: 'Burger', groups: [
    { name: 'Maultaschenburger', color: '#34C759', items: [
      { id: 'b-maul', name: 'Maultaschen auf karamellisierten Zwiebeln', sub: 'Vegi- oder Fleischfüllung', price: 600 },
      { id: 'b-spezial', name: 'Glabbicher Weihnachtsmarkt Spezial-Maultaschenburger', price: 750 },
    ]},
  ]},
  { id: 'karten', label: 'Karten', groups: [
    { name: 'Handgemachte Weihnachtskarten', color: '#FF3B30', items: [
      { id: 'k-1', name: 'Eine Karte', price: 300 },
      { id: 'k-2', name: 'Zwei Karten', price: 500 },
    ]},
  ]},
];

const KEY = 'kasse-v1';
const $ = s => document.querySelector(s);
const euro = c => (c / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

let state = { counts: {}, history: {}, stand: STANDS[0].id };
try { Object.assign(state, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
// Link wie …/index.html#burger sperrt ein Tablet direkt auf einen Stand
const hash = location.hash.slice(1);
if (STANDS.some(s => s.id === hash)) state.stand = hash;
if (!STANDS.some(s => s.id === state.stand)) state.stand = STANDS[0].id;

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
const stand = () => STANDS.find(s => s.id === state.stand);
const items = s => s.groups.flatMap(g => g.items);
const count = id => state.counts[id] || 0;

function add(id, d) {
  const h = state.history[state.stand] = state.history[state.stand] || [];
  if (d > 0) { state.counts[id] = count(id) + 1; h.push(id); }
  else if (count(id) > 0) { state.counts[id] = count(id) - 1; const i = h.lastIndexOf(id); if (i >= 0) h.splice(i, 1); }
  save(); update();
}

function build() {
  $('#tabs').innerHTML = STANDS.map(s =>
    `<button role="tab" data-stand="${s.id}" aria-selected="${s.id === state.stand}">${s.label}</button>`).join('');
  const s = stand();
  $('#title').textContent = s.label;
  $('#main').innerHTML = s.groups.map(g => `
    <section class="group" style="--accent:${g.color}">
      <h2>${g.name}</h2>
      <div class="grid n${g.items.length}">${g.items.map(it => `
        <div class="tile-wrap">
          <button class="tile" data-add="${it.id}" aria-label="${it.name} verkaufen">
            <span class="badge" data-count="${it.id}">0</span>
            <span class="name">${it.name}</span>
            ${it.sub ? `<span class="sub">${it.sub}</span>` : ''}
            <span class="price">${euro(it.price)}</span>
            <span class="rev" data-rev="${it.id}"></span>
          </button>
          <button class="minus" data-sub="${it.id}" aria-label="${it.name} abziehen">−</button>
        </div>`).join('')}
      </div>
    </section>`).join('');
  update();
}

function update() {
  const s = stand();
  let sum = 0, n = 0;
  for (const it of items(s)) {
    const c = count(it.id); sum += c * it.price; n += c;
    const b = document.querySelector(`[data-count="${it.id}"]`);
    b.textContent = c; b.closest('.tile').classList.toggle('has', c > 0);
    document.querySelector(`[data-rev="${it.id}"]`).textContent = c ? euro(c * it.price) : '';
    document.querySelector(`[data-sub="${it.id}"]`).disabled = !c;
  }
  $('#total').textContent = euro(sum);
  $('#total-count').textContent = `${n} ${n === 1 ? 'Artikel' : 'Artikel'} verkauft`;
  $('#undo').disabled = !(state.history[state.stand] || []).length;
}

document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.add) add(t.dataset.add, 1);
  else if (t.dataset.sub) add(t.dataset.sub, -1);
  else if (t.dataset.stand) { state.stand = t.dataset.stand; save(); history.replaceState(null, '', '#' + state.stand); build(); }
  else if (t.id === 'undo') { const h = state.history[state.stand] || []; if (h.length) add(h[h.length - 1], -1); }
  else if (t.id === 'reset') {
    $('#confirm-text').textContent = `Alle Zähler und Einnahmen von „${stand().label}“ (${$('#total').textContent}) werden auf 0 gesetzt.`;
    $('#confirm').showModal();
  }
});
$('#confirm').addEventListener('close', () => {
  if ($('#confirm').returnValue !== 'ok') return;
  items(stand()).forEach(it => delete state.counts[it.id]);
  state.history[state.stand] = []; save(); update();
});
// Doppeltipp-Zoom verhindern (iPadOS)
let last = 0;
document.addEventListener('touchend', e => { const t = Date.now(); if (t - last < 300) e.preventDefault(); last = t; }, { passive: false });

build();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
