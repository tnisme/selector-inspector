window.__locatorEngines = window.__locatorEngines || {};

window.__locatorEngines.querySelectorAllDeep = window.__locatorEngines.querySelectorAllDeep || function (selector, root = document) {
  let results = [];
  try {
    if (root.querySelectorAll) {
      const elements = root.querySelectorAll(selector);
      if (elements && elements.length) {
        results = Array.from(elements);
      }
    }
  } catch (_err) {
    // Ignore invalid selector errors for intermediate roots
  }

  try {
    const allElements = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (const el of allElements) {
      if (el.shadowRoot) {
        results = results.concat(window.__locatorEngines.querySelectorAllDeep(selector, el.shadowRoot));
      }
    }
    if (root.shadowRoot) {
      results = results.concat(window.__locatorEngines.querySelectorAllDeep(selector, root.shadowRoot));
    }
  } catch (_err) { }

  return [...new Set(results)];
};

window.__locatorEngines.findByCss = function findByCss(selector, context) {
  if (!selector || selector.trim().length === 0) return [];

  try {
    // Use context if provided, otherwise use document
    const searchRoot = context || document;
    const elements = window.__locatorEngines.querySelectorAllDeep(selector, searchRoot);
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
