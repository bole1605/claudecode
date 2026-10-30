import { CatalogProvider } from './catalogProvider.js';
import { ClaudeWebProvider } from './claudeWebProvider.js';

/** Provider-Registry. Neue Datenquellen (Händler-API, Affiliate-Feed, Scraper) implementieren:
 *  { id, label, isAvailable(): Promise<{ok, reason?}>, search(spec, {signal, onProgress}): Promise<{bikes, notes}> } */
export function createProviders(config, brandsPool, fetchImpl) {
  return [new CatalogProvider(config), new ClaudeWebProvider(config, brandsPool, fetchImpl)];
}
