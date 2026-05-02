window.__locatorEngines = window.__locatorEngines || {};

(function () {
  function isStableValue(value) {
    if (!value || typeof value !== "string") return false;
    const trimmed = value.trim();
    if (trimmed.length > 40) return false;
    if (trimmed.split(/\s+/).length > 5) return false;
    if (trimmed.includes(",") && trimmed.split(/\s+/).length > 3) return false;
    if (/^https?:\/\//.test(trimmed)) return false;
    if (/\d{4,}/.test(trimmed)) return false;
    return true;
  }

  function isDynamicClass(cls) {
    if (/^(css|sc|jss|emotion|makeStyles|mui)-/i.test(cls)) return true;
    if (/__[a-zA-Z0-9]{5,}/.test(cls)) return true;
    if (/[a-z]+\d+[a-z]+\d+/i.test(cls)) return true;
    if (/^[a-f0-9]{6,}$/.test(cls) && /\d/.test(cls)) return true;
    return false;
  }

  // Smart locator candidates (CSS + Playwright pseudos like :text-is, :visible)
  window.__locatorEngines.generateCandidates = function (attrs) {
    const candidates = [];
    const seen = new Set();
    function add(locator, strategy) {
      if (!seen.has(locator) && candidates.length < 12) {
        seen.add(locator);
        candidates.push({ locator, strategy });
      }
    }

    const {
      tag, id, rawClasses, testId, testIdAttr, dataAttrs,
      role, ariaLabel, ariaLabelledBy, name, type,
      placeholder, title, alt, text, isVisible,
    } = attrs;

    if (testId) {
      const attrName = testIdAttr || "data-testid";
      add(`[${attrName}="${testId}"]`, "css-testid");
      if (isVisible) add(`[${attrName}="${testId}"]:visible`, "css-testid-visible");
    }
    for (const attrName of ["data-cy", "data-test", "data-qa"]) {
      const val = dataAttrs[attrName];
      if (val && attrName !== testIdAttr) add(`[${attrName}="${val}"]`, "css-data");
    }

    const rawAccessibleName = ariaLabel || ariaLabelledBy || (text && text.length <= 30 ? text : null);
    const accessibleName = isStableValue(rawAccessibleName) ? rawAccessibleName : null;
    if (role && accessibleName) {
      add(`${tag}[role="${role}"][aria-label="${accessibleName}"]`, "css-role-name");
      if (ariaLabel && isStableValue(ariaLabel)) add(`[aria-label="${ariaLabel}"]`, "css-aria");
    } else if (role && !accessibleName) {
      const rareRoles = ["dialog", "alert", "navigation", "complementary", "banner", "alertdialog", "main"];
      if (rareRoles.includes(role)) add(`[role="${role}"]`, "css-role-only");
    }

    if (text && text.trim()) {
      const hasDigitRun = /\d{4,}/.test(text);
      const hasDate = /\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(text);
      if (!hasDigitRun && !hasDate) {
        if (text.length <= 20 && isStableValue(text)) add(`${tag}:text-is("${text}")`, "text-exact");
        if (text.length >= 6 && text.length <= 40) add(`${tag}:has-text("${text}")`, "has-text");
      }
    }

    if (ariaLabel && isVisible && isStableValue(ariaLabel)) add(`${tag}[aria-label="${ariaLabel}"]:visible`, "css-aria-visible");
    if (name) add(`${tag}[name="${name}"]`, "css-name");
    const stableTypes = ["submit", "reset", "button", "checkbox", "radio", "email", "password", "search", "tel", "url"];
    if (type && stableTypes.includes(type)) add(`${tag}[type="${type}"]`, "css-type");
    if (placeholder && isStableValue(placeholder)) add(`${tag}[placeholder="${placeholder}"]`, "css-placeholder");
    if (title && isStableValue(title)) add(`[title="${title}"]`, "css-title");
    if (alt && isStableValue(alt)) add(`${tag}[alt="${alt}"]`, "css-alt");

    const stableClasses = (rawClasses || []).filter((cls) => !isDynamicClass(cls));
    if (stableClasses.length > 0) {
      const topClasses = stableClasses.slice(0, 2);
      const classStr = topClasses.map((c) => `.${c}`).join("");
      add(`${tag}${classStr}`, "css-tag-class");
      if (isVisible) add(`${tag}${classStr}:visible`, "css-tag-class-visible");
    }

    if (id) add(`#${id}`, "css-id");

    return candidates;
  };

  // Pure CSS candidates (no Playwright pseudos)
  window.__locatorEngines.generateCssCandidates = function (attrs) {
    const candidates = [];
    const seen = new Set();
    function add(locator, strategy) {
      if (!seen.has(locator) && candidates.length < 12) {
        seen.add(locator);
        candidates.push({ locator, strategy });
      }
    }

    const {
      tag, id, rawClasses, testId, testIdAttr, dataAttrs,
      role, ariaLabel, ariaLabelledBy, name, type,
      placeholder, title, alt,
    } = attrs;

    if (testId) {
      const attrName = testIdAttr || "data-testid";
      add(`[${attrName}="${testId}"]`, "css-testid");
    }
    for (const attrName of ["data-cy", "data-test", "data-qa"]) {
      const val = dataAttrs[attrName];
      if (val && attrName !== testIdAttr) add(`[${attrName}="${val}"]`, "css-data");
    }

    const rawAccessibleName = ariaLabel || ariaLabelledBy || null;
    const accessibleName = isStableValue(rawAccessibleName) ? rawAccessibleName : null;
    if (role && accessibleName) {
      add(`${tag}[role="${role}"][aria-label="${accessibleName}"]`, "css-role-name");
      if (ariaLabel && isStableValue(ariaLabel)) add(`[aria-label="${ariaLabel}"]`, "css-aria");
    } else if (role && !accessibleName) {
      const rareRoles = ["dialog", "alert", "navigation", "complementary", "banner", "alertdialog", "main"];
      if (rareRoles.includes(role)) add(`[role="${role}"]`, "css-role-only");
    }

    if (ariaLabel && isStableValue(ariaLabel)) add(`${tag}[aria-label="${ariaLabel}"]`, "css-aria-label");
    if (name) add(`${tag}[name="${name}"]`, "css-name");
    const stableTypes = ["submit", "reset", "button", "checkbox", "radio", "email", "password", "search", "tel", "url"];
    if (type && stableTypes.includes(type)) add(`${tag}[type="${type}"]`, "css-type");
    if (placeholder && isStableValue(placeholder)) add(`${tag}[placeholder="${placeholder}"]`, "css-placeholder");
    if (title && isStableValue(title)) add(`[title="${title}"]`, "css-title");
    if (alt && isStableValue(alt)) add(`${tag}[alt="${alt}"]`, "css-alt");

    const stableClasses = (rawClasses || []).filter((cls) => !isDynamicClass(cls));
    if (stableClasses.length > 0) {
      const classStr = stableClasses.slice(0, 2).map((c) => `.${c}`).join("");
      add(`${tag}${classStr}`, "css-tag-class");
    }

    if (id) add(`#${id}`, "css-id");

    return candidates;
  };

  // XPath candidates
  window.__locatorEngines.generateXPathCandidates = function (attrs) {
    const candidates = [];
    const seen = new Set();
    function add(locator, strategy) {
      if (!seen.has(locator) && candidates.length < 12) {
        seen.add(locator);
        candidates.push({ locator, strategy });
      }
    }

    const {
      tag, id, rawClasses, testId, testIdAttr, dataAttrs,
      role, ariaLabel, name, type,
      placeholder, title, alt, text,
    } = attrs;

    if (testId) {
      const attrName = testIdAttr || "data-testid";
      add(`//*[@${attrName}="${testId}"]`, "xpath-testid");
    }
    for (const attrName of ["data-cy", "data-test", "data-qa"]) {
      const val = dataAttrs[attrName];
      if (val && attrName !== testIdAttr) add(`//*[@${attrName}="${val}"]`, "xpath-data");
    }

    if (role && ariaLabel && isStableValue(ariaLabel)) {
      add(`//${tag}[@role="${role}"][@aria-label="${ariaLabel}"]`, "xpath-role-name");
    }
    if (ariaLabel && isStableValue(ariaLabel)) add(`//*[@aria-label="${ariaLabel}"]`, "xpath-aria");

    if (text && text.trim()) {
      const hasDigitRun = /\d{4,}/.test(text);
      const hasDate = /\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(text);
      if (!hasDigitRun && !hasDate && isStableValue(text)) {
        if (text.length <= 20) add(`//${tag}[normalize-space()="${text}"]`, "xpath-text-exact");
        if (text.length >= 6 && text.length <= 40) add(`//${tag}[contains(text(),"${text}")]`, "xpath-text-contains");
      }
    }

    if (name) add(`//${tag}[@name="${name}"]`, "xpath-name");
    const stableTypes = ["submit", "reset", "button", "checkbox", "radio", "email", "password", "search", "tel", "url"];
    if (type && stableTypes.includes(type)) add(`//${tag}[@type="${type}"]`, "xpath-type");
    if (placeholder && isStableValue(placeholder)) add(`//${tag}[@placeholder="${placeholder}"]`, "xpath-placeholder");
    if (title && isStableValue(title)) add(`//*[@title="${title}"]`, "xpath-title");
    if (alt && isStableValue(alt)) add(`//${tag}[@alt="${alt}"]`, "xpath-alt");

    const stableClasses = (rawClasses || []).filter((cls) => !isDynamicClass(cls));
    if (stableClasses.length > 0) add(`//${tag}[contains(@class,"${stableClasses[0]}")]`, "xpath-class");

    if (id) add(`//${tag}[@id="${id}"]`, "xpath-id");

    return candidates;
  };

  // Playwright API candidates (only what the built-in engine can validate)
  window.__locatorEngines.generatePlaywrightCandidates = function (attrs) {
    const candidates = [];
    const seen = new Set();
    function add(locator, strategy) {
      if (!seen.has(locator) && candidates.length < 12) {
        seen.add(locator);
        candidates.push({ locator, strategy });
      }
    }

    const { testId, role, ariaLabel, ariaLabelledBy, text } = attrs;

    if (testId) add(`getByTestId("${testId}")`, "pw-testid");

    if (role) {
      const accName = ariaLabel || ariaLabelledBy || (text && text.length <= 20 ? text : null);
      if (accName && isStableValue(accName)) {
        add(`getByRole("${role}", { name: "${accName}" })`, "pw-role-name");
      }
      add(`getByRole("${role}")`, "pw-role");
    }

    if (text && text.trim()) {
      const hasDigitRun = /\d{4,}/.test(text);
      const hasDate = /\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(text);
      if (!hasDigitRun && !hasDate && isStableValue(text) && text.length <= 30) {
        add(`getByText("${text}")`, "pw-text");
      }
    }

    return candidates;
  };
})();

console.log("[Candidate Generator] Loaded");
