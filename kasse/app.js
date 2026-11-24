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

// --- Schnelles Tippen: Verkauf zählt schon beim Aufsetzen des Fingers (pointerdown), nicht erst beim Loslassen.
// Es gibt bewusst keine Sperre für schnelle Doppeltipps; touch-action:manipulation verhindert den Zoom.
const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} };
document.addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  const t = e.target.closest('[data-add]'); if (!t) return;
  add(t.dataset.add, 1); buzz();
  const b = t.querySelector('.badge'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
});

document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.add) { if (e.detail === 0) add(t.dataset.add, 1); } // nur Tastatur/Bedienhilfe, Touch läuft über pointerdown
  else if (t.dataset.sub) add(t.dataset.sub, -1);
  else if (t.dataset.stand) { state.stand = t.dataset.stand; save(); history.replaceState(null, '', '#' + state.stand); build(); }
  else if (t.id === 'undo') { const h = state.history[state.stand] || []; if (h.length) add(h[h.length - 1], -1); }
  else if (t.id === 'save') exportFile();
  else if (t.id === 'admin-close') $('#admin').close();
  else if (t.id === 'restore') { restore(); $('#admin').close(); }
  else if (t.id === 'reset') {
    $('#admin').close();
    $('#confirm-text').textContent = `Alle Zähler und Einnahmen von „${stand().label}“ (${$('#total').textContent}) werden auf 0 gesetzt. Die Zahlen werden vorher intern gesichert.`;
    $('#confirm').showModal();
  }
});

// --- Versteckte Verwaltung: Titel oben links 2 Sekunden gedrückt halten
let hold = null;
const cancelHold = () => { clearTimeout(hold); hold = null; };
$('#title').addEventListener('pointerdown', () => { cancelHold(); hold = setTimeout(openAdmin, 1500); });
// Alternative, falls das Gedrückthalten nicht klappt: 5× schnell auf den Titel tippen
let taps = [];
$('#title').addEventListener('pointerdown', () => { const n = Date.now(); taps = taps.filter(t => n - t < 2500); taps.push(n); if (taps.length >= 5) { taps = []; cancelHold(); openAdmin(); } });
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => $('#title').addEventListener(ev, cancelHold));
$('#title').addEventListener('contextmenu', e => e.preventDefault());

function openAdmin() {
  hold = null; buzz();
  $('#admin-text').textContent = `${stand().label}: ${$('#total').textContent}, ${$('#total-count').textContent}`;
  $('#restore').hidden = !state.backup;
  $('#admin').showModal();
}

$('#confirm').addEventListener('close', () => {
  if ($('#confirm').returnValue !== 'ok') return;
  state.backup = { stand: state.stand, counts: { ...state.counts }, history: (state.history[state.stand] || []).slice(), at: Date.now() };
  items(stand()).forEach(it => delete state.counts[it.id]);
  state.history[state.stand] = []; save(); update();
});

function restore() {
  const b = state.backup; if (!b) return;
  items(STANDS.find(s => s.id === b.stand)).forEach(it => { if (b.counts[it.id]) state.counts[it.id] = b.counts[it.id]; else delete state.counts[it.id]; });
  state.history[b.stand] = b.history; state.stand = b.stand; delete state.backup; save(); build();
}

// --- Speichern: CSV-Datei (iPad: „In Dateien sichern“ / Teilen-Menü, Android: Download)
async function exportFile() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  const q = v => `"${String(v).replace(/"/g, '""')}"`, num = c => (c / 100).toFixed(2).replace('.', ',');
  const rows = [['Stand', 'Produkt', 'Einzelpreis (€)', 'Anzahl', 'Umsatz (€)'].map(q).join(';')];
  let all = 0;
  for (const s of STANDS) {
    let sum = 0;
    for (const it of items(s)) { const c = count(it.id); sum += c * it.price;
      rows.push([s.label, it.name + (it.sub ? ` (${it.sub})` : ''), num(it.price), c, num(c * it.price)].map(q).join(';')); }
    rows.push([s.label, 'SUMME', '', '', num(sum)].map(q).join(';')); all += sum;
  }
  rows.push(['', 'GESAMT (dieses Gerät)', '', '', num(all)].map(q).join(';'), ['Stand der Daten', stamp].map(q).join(';'));
  const name = `kasse-${stamp.replace(' ', '-').replace(':', '')}.csv`;
  const file = new File(['﻿' + rows.join('\r\n')], name, { type: 'text/csv' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Kasse' }); return; }
  } catch (err) { if (err.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

build();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
  // Neue Version sofort übernehmen: einmal neu laden, sobald ein neuer Service Worker die Kontrolle bekommt
  let had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) location.reload(); had = true; });
}
