window.__locatorEngines = window.__locatorEngines || {};
window.__locatorEngines.findByCss = function findByCss(selector, context) {
  if (!selector || selector.trim().length === 0) return [];

  try {
    // Use context if provided, otherwise use document
    const searchRoot = context || document;
    const elements = Array.from(searchRoot.querySelectorAll(selector));
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
