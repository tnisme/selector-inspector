function inspectLocator(locator, type) {
  clearOverlays();

  let elements = [];
  if (type === "css") elements = findByCss(locator);
  if (type === "xpath") elements = findByXPath(locator);
  if (type === "playwright") elements = findByPlaywright(locator);
  if (type === "smart") elements = findBySmartLocator(locator);

  elements = [...new Set(elements)];

  renderOverlays(elements);

  return buildInspectResult(elements);
}
