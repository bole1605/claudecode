import { h, mount } from './dom.js';
import { homeView } from './views/home.js';
import { configureView } from './views/configure.js';
import { resultsView } from './views/results.js';
import { compareView } from './views/compare.js';
import { wishlistView, savedView } from './views/lists.js';
import { initAdvisor } from './components/advisor.js';
import { subscribe, wishlist, compare } from './store.js';

const app = document.getElementById('app');
const nav = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };

async function route() {
  const [path, query = ''] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(query);
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', path.startsWith('/' + a.dataset.nav)));
  try {
    if (path === '/') homeView(app);
    else if (path === '/configure') await configureView(app, nav);
    else if (path === '/results') await resultsView(app, nav, params);
    else if (path === '/compare') compareView(app);
    else if (path === '/wishlist') wishlistView(app, nav);
    else if (path === '/saved') savedView(app, nav);
    else homeView(app);
  } catch (e) {
    console.error(e);
    mount(app, h('div', { class: 'container narrow' }, h('div', { class: 'callout bad', role: 'alert' }, 'Unerwarteter Fehler: ', e.message)));
  }
  window.scrollTo(0, 0);
}

function updateChrome() {
  const n = wishlist.list().length;
  const badge = document.getElementById('wl-count');
  badge.hidden = n === 0; badge.textContent = n;
  const ids = compare.list();
  const bar = document.getElementById('compare-bar');
  bar.hidden = ids.length === 0 || location.hash.startsWith('#/compare');
  if (ids.length) mount(bar, h('span', null, `${ids.length} zum Vergleich gewählt (max. 4)`),
    h('button', { class: 'btn primary small', type: 'button', disabled: ids.length < 2, onClick: () => nav('#/compare') }, 'Vergleichen'),
    h('button', { class: 'btn ghost small', type: 'button', onClick: () => compare.clear() }, 'Leeren'));
}
subscribe(updateChrome);
addEventListener('hashchange', () => { route(); updateChrome(); });
initAdvisor(document.getElementById('advisor-root'));
updateChrome();
route();
