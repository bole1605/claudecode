import { h } from '../dom.js';
export function stepper(steps, index, onJump, maxReached) {
  const pct = Math.round(((index + 1) / steps.length) * 100);
  return h('div', { class: 'stepper' },
    h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': 'Fortschritt' }, h('div', { class: 'bar', style: `width:${pct}%` })),
    h('ol', { class: 'steps' }, steps.map((s, i) => h('li', { class: i === index ? 'active' : i < index ? 'done' : '' },
      h('button', { type: 'button', disabled: i > maxReached, 'aria-current': i === index ? 'step' : null, onClick: () => onJump(i) },
        h('span', { class: 'dot' }, i < index ? '✓' : i + 1), h('span', { class: 'lbl' }, s.title))))),
    h('p', { class: 'step-meta' }, `Schritt ${index + 1} von ${steps.length} · ${pct} %`));
}
