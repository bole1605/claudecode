import { h, mount } from '../dom.js';
import { api } from '../api.js';
import { draft } from '../store.js';

const SUGGESTIONS = [
  'Brauche ich wirklich einen 750-Wh-Akku?', 'Was ist der Unterschied zwischen Bosch CX und SX?', 'Lohnt sich ein Carbonrahmen?',
  'Welches Fahrrad eignet sich am besten für die Alpen?', 'Welche Ausstattung brauche ich für tägliche Fahrten zur Arbeit?',
];

export function initAdvisor(root) {
  const history = []; let open = false, busy = false;
  const log = h('div', { class: 'chat-log', 'aria-live': 'polite' });
  const input = h('input', { type: 'text', maxLength: 500, placeholder: 'Frage stellen …', 'aria-label': 'Frage an den Berater' });
  const panel = h('section', { class: 'advisor-panel', hidden: true, 'aria-label': 'KI-Fahrradberater' },
    h('header', null, h('strong', null, 'KI-Fahrradberater'), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Schließen', onClick: () => toggle(false) }, '×')),
    log,
    h('div', { class: 'chips small' }, SUGGESTIONS.map((s) => h('button', { type: 'button', class: 'chip', onClick: () => ask(s) }, s))),
    h('form', { onSubmit: (e) => { e.preventDefault(); ask(input.value); } }, input, h('button', { class: 'btn primary small', type: 'submit' }, 'Senden')));
  const fab = h('button', { class: 'fab', type: 'button', 'aria-expanded': 'false', onClick: () => toggle(!open) }, '💬 Berater fragen');
  mount(root, panel, fab);

  function msg(role, text, cls = '') { log.append(h('div', { class: `msg ${role} ${cls}` }, text)); log.scrollTop = log.scrollHeight; }
  function toggle(v) { open = v; panel.hidden = !v; fab.setAttribute('aria-expanded', String(v)); if (v) { if (!log.children.length) msg('bot', 'Hallo! Ich beantworte Fragen rund ums Fahrrad – auf Basis deiner bisherigen Angaben.'); input.focus(); } }
  async function ask(q) {
    q = q.trim(); if (q.length < 3 || busy) return;
    input.value = ''; busy = true; msg('user', q); msg('bot', 'Denke nach …', 'pending');
    try {
      const { answer } = await api.ask(q, draft.get().answers, history);
      history.push({ role: 'user', content: q }, { role: 'assistant', content: answer });
      log.lastChild.remove(); msg('bot', answer);
    } catch (e) { log.lastChild.remove(); msg('bot', e.message, 'error'); }
    busy = false;
  }
}
