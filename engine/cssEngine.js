// Expose engine functions on a shared namespace so they can be injected
window.__locatorEngines = window.__locatorEngines || {};
window.__locatorEngines.findByCss = function findByCss(selector) {
  try {
    const elements = Array.from(document.querySelectorAll(selector));
    return elements;
  } catch (error) {
    return {
      error: `Invalid CSS selector: ${error.message}`,
    };
  }
};

console.log(
  "[CSS Engine] Loaded - window.__locatorEngines.findByCss available:",
  typeof window.__locatorEngines.findByCss
);
