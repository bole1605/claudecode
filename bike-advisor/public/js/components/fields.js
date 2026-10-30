import { h } from '../dom.js';
import { getPath } from '/shared/util.js';
import { fieldOptions, fieldVisible } from '/shared/questionnaire.js';
import { DEFAULT_BRANDS, mergeBrands } from '/shared/brands.js';
import { customBrands } from '../store.js';

// Jeder Renderer: (field, value, onChange, ctx) -> Node. ctx = { answers, brands }
const optLabel = (o) => (typeof o === 'string' ? o : o.label);
const optValue = (o) => (typeof o === 'string' ? o : o.value);

function card(o, selected, onClick, kind = 'radio') {
  return h('button', { type: 'button', class: `choice${selected ? ' selected' : ''}`, role: kind, 'aria-checked': String(selected), onClick },
    h('span', { class: 'choice-mark', 'aria-hidden': 'true' }),
    h('span', { class: 'choice-text' }, h('strong', null, o.label), o.desc ? h('small', null, o.desc) : null));
}

const renderers = {
  single: (f, v, set, ctx) => h('div', { class: 'choices', role: 'radiogroup' }, fieldOptions(f, ctx.answers).map((o) => card(o, v === o.value, () => set(o.value)))),
  multi: (f, v = [], set, ctx) => h('div', { class: 'choices', role: 'group' }, fieldOptions(f, ctx.answers).map((o) => {
    const on = v.includes(o.value);
    return card(o, on, () => set(on ? v.filter((x) => x !== o.value) : [...v, o.value]), 'checkbox');
  })),
  weighted: (f, v = {}, set, ctx) => h('div', { class: 'choices weighted' }, fieldOptions(f, ctx.answers).map((o) => {
    const on = o.value in v;
    return h('div', { class: `choice-row${on ? ' selected' : ''}` },
      card(o, on, () => { const n = { ...v }; if (on) delete n[o.value]; else n[o.value] = 3; set(n); }, 'checkbox'),
      on ? h('label', { class: 'weight' }, h('span', null, 'Gewichtung ', h('b', null, v[o.value])),
        h('input', { type: 'range', min: 1, max: 5, step: 1, value: v[o.value], 'aria-label': `Gewichtung ${o.label}`, onInput: (e) => { set({ ...v, [o.value]: Number(e.target.value) }, true); e.target.previousSibling.lastChild.textContent = e.target.value; } })) : null);
  })),
  must: (f, v = {}, set, ctx) => h('div', { class: 'must-list' }, fieldOptions(f, ctx.answers).map((o) => h('div', { class: 'must-row' },
    h('span', null, o.label),
    h('div', { class: 'seg', role: 'group', 'aria-label': o.label }, [['', 'Egal'], ['nice', 'Wunsch'], ['must', 'Muss']].map(([val, lab]) =>
      h('button', { type: 'button', class: `seg-btn${(v[o.value] ?? '') === val ? ' on ' + (val || 'none') : ''}`, 'aria-pressed': String((v[o.value] ?? '') === val), onClick: () => { const n = { ...v }; if (val) n[o.value] = val; else delete n[o.value]; set(n); } }, lab)))))),
  bool: (f, v, set) => h('div', { class: 'seg big', role: 'group' }, [[true, 'Ja'], [false, 'Nein']].map(([val, lab]) =>
    h('button', { type: 'button', class: `seg-btn${v === val ? ' on yes' : ''}`, 'aria-pressed': String(v === val), onClick: () => set(val) }, lab))),
  number: (f, v, set) => {
    const out = h('output', null, `${v ?? f.default ?? f.min} ${f.unit ?? ''}`);
    const range = h('input', { type: 'range', min: f.min, max: f.max, step: f.step, value: v ?? f.default ?? f.min, 'aria-label': f.label, onInput: (e) => { set(Number(e.target.value), true); num.value = e.target.value; out.textContent = `${e.target.value} ${f.unit ?? ''}`; } });
    const num = h('input', { type: 'number', class: 'num', min: f.min, max: f.max, step: f.step, value: v ?? f.default ?? f.min, 'aria-label': `${f.label} (Zahl)`, onChange: (e) => {
      const n = Math.min(f.max, Math.max(f.min, Number(e.target.value) || f.min)); e.target.value = n; range.value = n; out.textContent = `${n} ${f.unit ?? ''}`; set(n);
    } });
    return h('div', { class: 'number' }, range, h('div', { class: 'number-val' }, num, h('span', { class: 'unit' }, f.unit ?? '')), h('span', { class: 'sr-only' }, out));
  },
  range: (f, v, set) => h('div', { class: 'number' },
    h('input', { type: 'range', min: f.min, max: f.max, step: f.step, value: v ?? f.default ?? 0, 'aria-label': f.label, onInput: (e) => { set(Number(e.target.value), true); e.target.nextSibling.firstChild.textContent = `${e.target.value}${f.unit ? ' ' + f.unit : ''}`; } }),
    h('div', { class: 'range-labels' }, h('b', null, `${v ?? f.default ?? 0}${f.unit ? ' ' + f.unit : ''}`), f.labels ? h('span', null, `${f.labels[0]} ↔ ${f.labels[1]}`) : null)),
  text: (f, v = '', set) => h('textarea', { rows: 3, maxLength: f.maxLength, placeholder: f.placeholder ?? '', value: v, 'aria-label': f.label, onInput: (e) => set(e.target.value, true) }),
  brands: (f, v = [], set, ctx) => {
    const pool = f.options === 'brands' ? ctx.brands : f.options;
    const list = mergeBrands(pool, v);
    const input = h('input', { type: 'text', placeholder: 'Weitere Marke hinzufügen …', maxLength: 40, 'aria-label': 'Weitere Marke hinzufügen' });
    const add = () => { const n = input.value.trim(); if (!n) return; if (f.options === 'brands') customBrands.add(n); set(mergeBrands(v, [n])); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    return h('div', null,
      h('div', { class: 'chips' }, list.map((b) => h('button', { type: 'button', class: `chip${v.includes(b) ? ' on' : ''}`, 'aria-pressed': String(v.includes(b)), onClick: () => set(v.includes(b) ? v.filter((x) => x !== b) : [...v, b]) }, b))),
      h('div', { class: 'add-brand' }, input, h('button', { type: 'button', class: 'btn ghost small', onClick: add }, 'Hinzufügen')));
  },
  insight: (f, v, set, ctx) => {
    const r = f.compute(ctx.answers);
    return r ? h('aside', { class: 'insight', role: 'note' }, h('strong', null, r.title), h('p', null, r.text)) : h('span');
  },
};

export function renderField(f, answers, onChange, ctx) {
  const set = (value, silent) => onChange(f, value, silent);
  const body = renderers[f.type](f, getPath(answers, f.id), set, { ...ctx, answers });
  if (f.type === 'insight') return body;
  return h('fieldset', { class: 'field', dataset: { field: f.id } },
    h('legend', null, f.label, f.required ? h('span', { class: 'req', 'aria-label': 'Pflichtfeld' }, ' *') : null),
    f.help ? h('p', { class: 'help' }, f.help) : null,
    body);
}
export { fieldVisible, DEFAULT_BRANDS };
