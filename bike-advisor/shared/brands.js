// Standard-Herstellerliste. Erweiterbar über data/brands.extra.json (Server) und eigene Marken im UI.
export const DEFAULT_BRANDS = [
  'Cube', 'Trek', 'Specialized', 'Canyon', 'Haibike', 'Scott', 'Giant', 'Orbea', 'Focus', 'Bulls', 'KTM',
  'Riese & Müller', 'Cannondale', 'Rose', 'Stevens', 'Merida', 'Ghost', 'Santa Cruz', 'Rotwild', 'Simplon',
];
export const mergeBrands = (...lists) => {
  const seen = new Map();
  for (const l of lists) for (const b of l ?? []) {
    const name = String(b).trim();
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()];
};
