import { clearOverlays, renderOverlays } from '../page/overlay.js';
import {
  findByCss,
  findByXPath,
  findByPlaywright,
  findBySmartLocator,
} from './locator-finders.js';
import { buildInspectResult } from '../page/inspect-result-builder.js';

// eslint-disable-next-line no-unused-vars
function inspectLocator(locator, type) {
  clearOverlays();

  let elements = [];
  if (type === 'css') elements = findByCss(locator);
  if (type === 'xpath') elements = findByXPath(locator);
  if (type === 'playwright') elements = findByPlaywright(locator);
  if (type === 'smart') elements = findBySmartLocator(locator);

  elements = [...new Set(elements)];

  renderOverlays(elements);

  return buildInspectResult(elements);
}
