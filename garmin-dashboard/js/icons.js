/* Symbole im Stil der SF Symbols: einheitliche Linienstärke, runde Enden, 24er Raster */
'use strict';
const SYM = {
  moon: '<path d="M20 14.5A8 8 0 1 1 9.500 4a6.500 6.500 0 0 0 10.500 10.500z"/>',
  wave: '<path d="M3 12h4l2.500-6 4 12 2.500-6H21"/>',
  heart: '<path d="M12 20s-7.500-4.600-7.500-10.200A4.300 4.300 0 0 1 12 7.500a4.300 4.300 0 0 1 7.500 2.300C19.500 15.400 12 20 12 20z"/>',
  battery: '<rect x="2.500" y="7" width="17" height="10" rx="2.800"/><path d="M22 10.500v3M11.500 9.500l-2 3h3l-1 2.500"/>',
  gauge: '<path d="M4.500 17a8 8 0 1 1 15 0"/><path d="M12 14l3.500-4.500"/>',
  steps: '<path d="M8 3.500c2 0 3 2 3 4.500s-1 3.500-3 3.500S5 10.500 5 8s1-4.500 3-4.500zM16 11.500c2 0 3 2 3 4.500s-1 4.500-3 4.500-3-2-3-4.500 1-4.500 3-4.500z"/>',
  wind: '<path d="M3 8h10a2.500 2.500 0 1 0-2.500-2.500M3 12h15a3 3 0 1 1-3 3M3 16h7"/>',
  chart: '<path d="M4 19V5M4 19h16M8 15l4-5 3 3 5-7"/>',
  hourglass: '<path d="M7 3h10M7 21h10M8 3c0 5 4 5 4 9s-4 4-4 9M16 3c0 5-4 5-4 9s4 4 4 9"/>',
  run: '<circle cx="15" cy="4.800" r="1.800"/><path d="M12.500 21l-2-4.500 2.500-2.500-1.500-3.500 3-1.500 2 3 3 .5M9.500 10.500L6.500 12M13 14l3.500 3.500.5 3.500"/>',
  bike: '<circle cx="6" cy="16" r="3.500"/><circle cx="18" cy="16" r="3.500"/><path d="M6 16l4-8h5l3 8M10 8L9 5.500H7M15 8l-2.500 8"/>',
  walk: '<circle cx="12.500" cy="4.500" r="1.800"/><path d="M12.500 8.500v5.500l-2 6.500M12.500 14l3 6.500M9 11l3.500-2.500 3 2.500"/>',
  dumbbell: '<path d="M6.500 6.500v11M17.500 6.500v11M3.500 9.500v5M20.500 9.500v5M6.500 12h11"/>',
  bolt: '<path d="M13 3L5 13.500h6L10 21l8-10.500h-6z"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  calendar: '<rect x="3.500" y="5" width="17" height="15.500" rx="3.500"/><path d="M3.500 10h17M8 3v4M16 3v4"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  mountain: '<path d="M2.500 19l6-10 4 6 2-3 7 7z"/>',
  flame: '<path d="M12 21c4 0 6-2.500 6-5.500 0-3-2-4.500-3-7-2 1.500-2.500 3-2.500 4.500-1.500-1-2-2.500-1.500-5C8 9 6 12 6 15.500 6 18.500 8 21 12 21z"/>',
  warn: '<path d="M12 4l9 16H3zM12 10v4M12 17v.1"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.500l3 3 5-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.1"/>',
  sliders: '<path d="M4 7h9M19 7h1M4 12h3M13 12h7M4 17h11"/><circle cx="16" cy="7" r="2.500"/><circle cx="10" cy="12" r="2.500"/><circle cx="18" cy="17" r="2.500"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.300 5.700M20 5v6h-6"/>',
  pin: '<path d="M12 21s-6-5.500-6-11a6 6 0 0 1 12 0c0 5.500-6 11-6 11z"/><circle cx="12" cy="10" r="2.200"/>',
  locate: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4M6 12H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1"/>',
  download: '<path d="M12 4v11M8 11l4 4 4-4M5 20h14"/>',
  bookmark: '<path d="M7 3.500h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.500a1 1 0 0 1 1-1z"/>',
  search: '<circle cx="11" cy="11" r="6.500"/><path d="M16 16l4.500 4.500"/>',
  today: '<path d="M3 12h4l2.500-6 4 12 2.500-6H21"/>',
  review: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  train: '<path d="M12 21s-6-5.500-6-11a6 6 0 0 1 12 0c0 5.500-6 11-6 11z"/><circle cx="12" cy="10" r="2.200"/>'
};
const sym = (n, cls = '') => `<svg class="sym ${cls}" viewBox="0 0 24 24" aria-hidden="true">${SYM[n] || ''}</svg>`;
/** Farbiges Symbol-Kästchen wie in der Health-App */
const badge = (n, color) => `<span class="ico ic-${color}">${sym(n)}</span>`;
