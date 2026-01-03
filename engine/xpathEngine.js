window.__locatorEngines = window.__locatorEngines || {};
window.__locatorEngines.findByXPath = function findByXPath(xpath) {
  const results = [];
  const query = document.evaluate(
    xpath,
    document,
    null,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );
  for (let i = 0; i < query.snapshotLength; i++) {
    results.push(query.snapshotItem(i));
  }
  return results;
};

console.log(
  "[XPath Engine] Loaded - window.__locatorEngines.findByXPath available:",
  typeof window.__locatorEngines.findByXPath
);
