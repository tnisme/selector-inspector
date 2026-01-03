// Regex engine: find elements whose text matches a RegExp. Exposed on window.__locatorEngines
window.__locatorEngines = window.__locatorEngines || {};
window.__locatorEngines.findByRegex = function findByRegex(input) {
  let pattern = input;
  let flags = "";

  // If user provided regex literal like /foo/i
  const literal = input.match(/^\/(.*)\/([gimsuy]*)$/);
  if (literal) {
    pattern = literal[1];
    flags = literal[2] || "";
  }

  let re;
  try {
    re = new RegExp(pattern, flags);
  } catch (err) {
    throw new Error(`Invalid regex: ${err.message}`);
  }

  const all = Array.from(document.querySelectorAll("*"));
  const results = all.filter((el) => {
    // Skip script/style and elements without text
    const tag = el.tagName && el.tagName.toLowerCase();
    if (tag === "script" || tag === "style" || tag === "noscript") return false;
    const text = el.textContent && el.textContent.trim();
    if (!text) return false;
    return re.test(text);
  });

  return results;
};
