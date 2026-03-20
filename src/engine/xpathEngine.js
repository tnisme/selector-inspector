window.__locatorEngines = window.__locatorEngines || {};
window.__locatorEngines.findByXPath = function findByXPath(xpath, context) {
  try {
    const results = [];
    // Use context if provided, otherwise use document
    const searchRoot = context || document;
    const query = document.evaluate(
      xpath,
      searchRoot,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    for (let i = 0; i < query.snapshotLength; i++) {
      results.push(query.snapshotItem(i));
    }
    return results;
  } catch (error) {
    return {
      error: `Invalid XPath: ${error.message}`,
    };
  }
};

console.log(
  "[XPath Engine] Loaded - window.__locatorEngines.findByXPath available:",
  typeof window.__locatorEngines.findByXPath
);
