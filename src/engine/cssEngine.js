window.__locatorEngines = window.__locatorEngines || {};
window.__locatorEngines.findByCss = function findByCss(selector) {
  if (!selector || selector.trim().length === 0) return [];

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
