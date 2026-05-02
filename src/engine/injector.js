window.__locatorEngines = window.__locatorEngines || {};

console.log(
  "[Injector] Loading - engines available:",
  Object.keys(window.__locatorEngines || {})
);

function expectEngine(name) {
  if (!window.__locatorEngines || !window.__locatorEngines[name]) {
    console.error(
      `[Injector] Engine not found: ${name}. Available:`,
      Object.keys(window.__locatorEngines || {})
    );
    throw new Error(`Engine function not available: ${name}`);
  }
  return window.__locatorEngines[name];
}

function findByCss(selector) {
  return expectEngine("findByCss")(selector);
}

function findByXPath(xpath) {
  return expectEngine("findByXPath")(xpath);
}

function findByPlaywright(selector) {
  return expectEngine("findByPlaywright")(selector);
}

function findBySmartLocator(locator) {
  return expectEngine("findBySmartLocator")(locator);
}

function clearOverlays() {
  const container = document.getElementById(
    "locator-inspector-overlay-container"
  );
  if (container) {
    if (container._cleanup) container._cleanup();
    container.remove();
  }
  const styles = document.getElementById("locator-inspector-styles");
  if (styles) styles.remove();
}

window.__locatorInspect = function (locator, type, requestId) {
  try {
    const lastId =
      window.__locatorInspect && window.__locatorInspect.__lastRequestId;
    if (requestId !== undefined && lastId !== requestId) {
      return { count: 0, details: "", error: null };
    }

    if (!locator || !locator.trim()) {
      clearOverlays();
      return { count: 0, details: "", error: null };
    }

    clearOverlays();

    const createOverlays = requestId === undefined || lastId === requestId;

    let elements = [];

    switch (type) {
      case "css": {
        const css = findByCss(locator);
        if (css && css.error) return { error: css.error };
        css.forEach((el) => elements.push(el));
        break;
      }

      case "xpath": {
        const xpath = findByXPath(locator);
        if (xpath && xpath.error) return { error: xpath.error };
        xpath.forEach((el) => elements.push(el));
        break;
      }

      case "playwright": {
        const pw = findByPlaywright(locator);
        if (pw && pw.error) return { error: pw.error };
        pw.forEach((el) => elements.push(el));
        break;
      }

      case "smart": {
        const smart = findBySmartLocator(locator);
        if (smart && smart.error) return { error: smart.error };
        smart.forEach((el) => elements.push(el));
        break;
      }

      default:
        return { error: "Unknown locator type" };
    }

    elements = [...new Set(elements)];
    window.__lastMatchedElements = elements;

    let overlayContainer = null;
    const highlightData = [];

    if (createOverlays) {
      overlayContainer = document.createElement("div");
      overlayContainer.id = "locator-inspector-overlay-container";
      overlayContainer.className = "locator-inspector-container";
      overlayContainer.style.cssText = [
        "position: fixed;",
        "top: 0;",
        "left: 0;",
        "width: 100%;",
        "height: 100%;",
        "pointer-events: none;",
        "z-index: 2147483646;",
        "font-family: Arial, sans-serif;",
        "margin: 0;",
        "padding: 0;",
      ].join("\n");
      document.body.appendChild(overlayContainer);
    }

    // Helper function to calculate position relative to viewport
    function getAbsoluteElementRect(element) {
      return element.getBoundingClientRect();
    }

    elements.forEach((element, index) => {
      if (!element) return;

      const highlight = document.createElement("div");
      highlight.className = "locator-inspector-highlight";
      highlight.style.cssText = [
        "position: fixed;",
        "border: 3px solid #ff6b6b;",
        "background: rgba(255, 107, 107, 0.1);",
        "pointer-events: none;",
        "z-index: 2147483647;",
        "box-sizing: border-box;",
        "animation: locatorPulse 2s infinite;",
        "margin: 0;",
        "padding: 0;",
        "transition: opacity 0.2s ease;",
      ].join("\n");

      const badge = document.createElement("div");
      badge.textContent = index + 1;
      badge.className = "locator-inspector-badge";
      badge.style.cssText = [
        "position: absolute;",
        "top: -12px;",
        "right: -12px;",
        "background: #ff6b6b;",
        "color: white;",
        "width: 24px;",
        "height: 24px;",
        "border-radius: 50%;",
        "display: flex;",
        "align-items: center;",
        "justify-content: center;",
        "font-size: 12px;",
        "font-weight: bold;",
        "border: 2px solid white;",
        "box-shadow: 0 2px 4px rgba(0,0,0,0.3);",
        "margin: 0;",
        "padding: 0;",
      ].join("\n");

      highlight.appendChild(badge);
      if (createOverlays && overlayContainer)
        overlayContainer.appendChild(highlight);

      highlightData.push({ element, highlight, index });
    });

    function updateHighlightPositions() {
      if (!highlightData || highlightData.length === 0) return;
      highlightData.forEach((data) => {
        if (
          data.element &&
          data.highlight &&
          data.element.isConnected
        ) {
          const rect = getAbsoluteElementRect(data.element);
          data.highlight.style.top = rect.top + "px";
          data.highlight.style.left = rect.left + "px";
          data.highlight.style.width = rect.width + "px";
          data.highlight.style.height = rect.height + "px";
        }
      });
    }

    let scrollHandler = null;
    let scrollTimeout = null;
    if (createOverlays && overlayContainer) {
      updateHighlightPositions();
      scrollHandler = () => {
        if (scrollTimeout) return;
        scrollTimeout = requestAnimationFrame(() => {
          updateHighlightPositions();
          scrollTimeout = null;
        });
      };
      window.addEventListener("scroll", scrollHandler, { passive: true });
      overlayContainer._cleanup = () => {
        window.removeEventListener("scroll", scrollHandler);
        if (scrollTimeout) cancelAnimationFrame(scrollTimeout);
      };

      if (!document.getElementById("locator-inspector-styles")) {
        const style = document.createElement("style");
        style.id = "locator-inspector-styles";
        style.textContent = `@keyframes locatorPulse { 0% { opacity: 1; } 50% { opacity: 0.7; } 100% { opacity: 1; } }`;
        document.head.appendChild(style);
      }

      setTimeout(() => {
        const container = document.getElementById(
          "locator-inspector-overlay-container"
        );
        if (container) {
          if (container._cleanup) container._cleanup();
          container.remove();
        }
        const styles = document.getElementById("locator-inspector-styles");
        if (styles) styles.remove();
      }, 5000);
    }

    const limit = 100;
    const elementsInfo = elements.slice(0, limit).map((el) => {
      const tagName = el.tagName ? el.tagName.toLowerCase() : "";
      const className = typeof el.className === "string" ? el.className : (el.getAttribute && el.getAttribute("class")) || "";
      const id = el.id ? el.id : "";

      let text = el.textContent ? el.textContent.trim() : "";
      if (text.length > 60) text = text.substring(0, 60) + "...";

      const attributes = {};
      const importantAttrs = [
        "name", "type", "href", "src", "role", "aria-label",
        "data-testid", "data-test", "placeholder", "title", "alt"
      ];

      if (el.hasAttributes()) {
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          if (importantAttrs.includes(attr.name) || attr.name.startsWith("data-")) {
            let val = attr.value;
            if (val.length > 50) val = val.substring(0, 50) + "...";
            attributes[attr.name] = val;
          }
        }
      }

      let domDepth = 0;
      let depthNode = el;
      while (depthNode && depthNode !== document.body) {
        domDepth++;
        depthNode = depthNode.parentElement;
      }

      return {
        tagName,
        id,
        className,
        text,
        attributes,
        domDepth,
      };
    });


    // Expose highlight function
    window.__locatorHighlight = function (index) {
      if (!highlightData) return;

      let container = document.getElementById("locator-inspector-overlay-container");
      if (!container && overlayContainer) {
        // Revive container if it was removed
        document.body.appendChild(overlayContainer);
        container = overlayContainer;

        // Re-append all highlights to the invoked container
        highlightData.forEach(d => {
          if (d.highlight) container.appendChild(d.highlight);
        });

        // Re-attach scroll listener since it was cleaned up
        window.removeEventListener("scroll", scrollHandler); // Prevent duplicates
        window.addEventListener("scroll", scrollHandler, { passive: true });

        container._cleanup = () => {
          window.removeEventListener("scroll", scrollHandler);
          if (scrollTimeout) cancelAnimationFrame(scrollTimeout);
        };
      }

      highlightData.forEach((data) => {
        if (data.index === index) {
          data.highlight.style.opacity = "1";
          data.highlight.style.borderWidth = "5px";
          data.highlight.style.zIndex = "2147483647";
          if (data.element && data.element.scrollIntoView) {
            data.element.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "center"
            });
          }
        } else {
          data.highlight.style.opacity = "0.1";
          data.highlight.style.borderWidth = "3px";
          data.highlight.style.zIndex = "2147483646";
        }
      });

      // Force update positions to ensure they are correct immediately and during scroll
      updateHighlightPositions();
    };

    return { count: elements.length, elementsInfo, error: null };
  } catch (error) {
    return {
      count: 0,
      error: error && error.message ? error.message : String(error),
    };
  }
};

window.__enableElementSelection = function (onSelect) {
  if (typeof window.__disableElementSelection === "function") {
    window.__disableElementSelection();
  }

  // Full-page capture overlay (sits below highlight so pointer events still reach it)
  const pickOverlay = document.createElement("div");
  pickOverlay.id = "locator-inspector-pick-overlay";
  pickOverlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483644;cursor:crosshair;background:transparent;";
  document.body.appendChild(pickOverlay);

  // Blue highlight box
  const hlBox = document.createElement("div");
  hlBox.style.cssText = [
    "position:fixed",
    "pointer-events:none",
    "z-index:2147483645",
    "background:rgba(59,130,246,0.12)",
    "border:2px solid rgba(59,130,246,0.9)",
    "box-sizing:border-box",
    "border-radius:2px",
    "display:none",
  ].join(";");
  document.body.appendChild(hlBox);

  // Info label (tag + id/class + dimensions)
  const hlLabel = document.createElement("div");
  hlLabel.style.cssText = [
    "position:fixed",
    "pointer-events:none",
    "z-index:2147483646",
    "background:#1e2533",
    "color:#e2e8f0",
    "font:12px/1.5 'JetBrains Mono',monospace",
    "padding:3px 8px",
    "border-radius:3px",
    "white-space:nowrap",
    "display:none",
    "max-width:360px",
    "overflow:hidden",
    "text-overflow:ellipsis",
    "box-shadow:0 2px 8px rgba(0,0,0,0.4)",
  ].join(";");
  document.body.appendChild(hlLabel);

  let currentEl = null;

  function getElementUnder(x, y) {
    pickOverlay.style.display = "none";
    const el = document.elementFromPoint(x, y);
    pickOverlay.style.display = "";
    return el;
  }

  function onMouseMove(e) {
    const el = getElementUnder(e.clientX, e.clientY);
    if (!el || el === document.body || el === document.documentElement) {
      hlBox.style.display = "none";
      hlLabel.style.display = "none";
      currentEl = null;
      return;
    }
    currentEl = el;

    const rect = el.getBoundingClientRect();
    hlBox.style.display = "block";
    hlBox.style.top    = rect.top    + "px";
    hlBox.style.left   = rect.left   + "px";
    hlBox.style.width  = rect.width  + "px";
    hlBox.style.height = rect.height + "px";

    // Label: tag + #id + .class + dimensions
    const tag = el.tagName.toLowerCase();
    const id  = el.id ? "#" + el.id : "";
    const rawCls = typeof el.className === "string" ? el.className.trim() : "";
    const cls = rawCls
      ? "." + rawCls.split(/\s+/).slice(0, 2).join(".")
      : "";
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);

    // Colour the tag part blue, rest grey — using two inline spans isn't possible
    // in a single textContent, so build via innerHTML (controlled values, no user data)
    hlLabel.innerHTML =
      `<span style="color:#93c5fd">${tag}</span>` +
      `<span style="color:#6ee7b7">${id}</span>` +
      `<span style="color:#fde68a">${cls}</span>` +
      `<span style="color:#94a3b8;margin-left:8px">${w} × ${h}</span>`;

    hlLabel.style.display = "block";

    // Position below element; flip above if it would go off-screen
    const gap = 6;
    let top  = rect.bottom + gap;
    if (top + 26 > window.innerHeight) top = rect.top - 26 - gap;
    let left = rect.left;
    const labelW = hlLabel.offsetWidth || 240;
    if (left + labelW > window.innerWidth - 8) left = window.innerWidth - labelW - 8;
    hlLabel.style.top  = Math.max(0, top)  + "px";
    hlLabel.style.left = Math.max(0, left) + "px";
  }

  function onMouseLeave() {
    hlBox.style.display   = "none";
    hlLabel.style.display = "none";
    currentEl = null;
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const el = currentEl || getElementUnder(e.clientX, e.clientY);
    cleanup();
    if (el) onSelect(el);
  }

  function cleanup() {
    pickOverlay.removeEventListener("mousemove",  onMouseMove);
    pickOverlay.removeEventListener("mouseleave", onMouseLeave);
    pickOverlay.removeEventListener("click",      onClick);
    pickOverlay.remove();
    hlBox.remove();
    hlLabel.remove();
    window.__disableElementSelection = null;
  }

  pickOverlay.addEventListener("mousemove",  onMouseMove);
  pickOverlay.addEventListener("mouseleave", onMouseLeave);
  pickOverlay.addEventListener("click",      onClick);

  window.__disableElementSelection = cleanup;
  return true;
};

function findUsefulAncestors(element, maxLevels = 5) {
  const ancestors = [];
  let current = element.parentElement;
  let level = 0;

  while (current && level < maxLevels && current !== document.body && current !== document.documentElement) {
    const tag = current.tagName.toLowerCase();
    const id = current.id || null;
    const testId = current.getAttribute("data-testid") ||
                   current.getAttribute("data-test-id") ||
                   current.getAttribute("data-cy") ||
                   current.getAttribute("data-test") ||
                   current.getAttribute("data-qa") || null;
    const role = current.getAttribute("role") || null;
    const classes = (typeof current.className === "string" ? current.className : "")
      .split(/\s+/).filter(Boolean);

    const stableClasses = classes.filter((cls) => {
      if (/^(css|sc|jss|emotion|makeStyles|mui)-/i.test(cls)) return false;
      if (/__[a-zA-Z0-9]{5,}/.test(cls)) return false;
      if (/[a-z]+\d+[a-z]+\d+/i.test(cls)) return false;
      if (/^[a-f0-9]{6,}$/.test(cls) && /\d/.test(cls)) return false;
      return true;
    });

    const isDynamicId = id && (/\d{4,}/.test(id) || id.startsWith(":") || /^react/i.test(id) || /^ember/i.test(id));
    const usableId = id && !isDynamicId ? id : null;
    const usableRole = role && ["dialog", "alert", "navigation", "complementary", "banner", "main", "form"].includes(role) ? role : null;

    const hasUseful = usableId || testId || stableClasses.length > 0 || usableRole;

    if (hasUseful) {
      let selector = null;
      let quality = 0;

      if (testId) {
        selector = `[data-testid="${testId}"]`;
        quality = 100;
      } else if (usableId) {
        selector = `#${usableId}`;
        quality = 90;
      } else if (usableRole) {
        selector = `[role="${usableRole}"]`;
        quality = 60;
      } else if (stableClasses.length > 0) {
        selector = `${tag}.${stableClasses[0]}`;
        quality = 70;
      }

      if (selector) {
        ancestors.push({ element: current, selector, quality, level });
      }
    }

    current = current.parentElement;
    level++;
  }

  ancestors.sort((a, b) => b.quality - a.quality || a.level - b.level);
  return ancestors;
}

function cssToXPath(cssSelector) {
  if (cssSelector.startsWith("#")) {
    return `//*[@id="${cssSelector.slice(1)}"]`;
  }
  const attrMatch = cssSelector.match(/^\[([^\]]+)\]$/);
  if (attrMatch) {
    return `//*[@${attrMatch[1]}]`;
  }
  const classMatch = cssSelector.match(/^(\w+)\.(.+)$/);
  if (classMatch) {
    return `//${classMatch[1]}[contains(@class,"${classMatch[2]}")]`;
  }
  return null;
}

function narrowWithAncestors(nonUniqueCandidates, targetElement, ancestors, locatorType, validateFn) {
  locatorType = locatorType || "smart";
  validateFn = validateFn || ((loc) => window.__locatorEngines.findBySmartLocator(loc));
  const narrowed = [];

  for (const ancestor of ancestors) {
    for (const candidate of nonUniqueCandidates) {
      let combined;
      if (locatorType === "xpath") {
        const ancestorXPath = cssToXPath(ancestor.selector);
        if (!ancestorXPath) continue;
        // candidate.locator starts with // — concatenate directly
        combined = ancestorXPath + candidate.locator;
      } else if (locatorType === "smart") {
        const hasCustomPseudo = /:text-is\(|:has-text\(|:visible|:has\(|:contains\(/.test(candidate.locator);
        combined = `${ancestor.selector}${hasCustomPseudo ? " >> " : " "}${candidate.locator}`;
      } else {
        // css (and playwright which skips narrowing)
        combined = `${ancestor.selector} ${candidate.locator}`;
      }
      if (combined.length > 120) continue;
      try {
        const m = validateFn(combined);
        if (!m || m.error || !Array.isArray(m) || m.length === 0) continue;
        if (!m.some((el) => el === targetElement)) continue;
        narrowed.push({ locator: combined, strategy: `narrowed-${candidate.strategy}`, matchCount: m.length, unique: m.length === 1, locatorType });
      } catch (_) {}
    }

    // Strategy B: ancestor + bare tag
    const targetTag = targetElement.tagName.toLowerCase();
    if (locatorType === "xpath") {
      const ancestorXPath = cssToXPath(ancestor.selector);
      if (ancestorXPath) {
        const direct = `${ancestorXPath}//${targetTag}`;
        if (direct.length <= 120) {
          try {
            const m = validateFn(direct);
            if (m && Array.isArray(m) && m.length > 0 && m.some((el) => el === targetElement)) {
              narrowed.push({ locator: direct, strategy: "xpath-narrowed-tag", matchCount: m.length, unique: m.length === 1, locatorType });
            }
          } catch (_) {}
        }
      }
    } else {
      const direct = `${ancestor.selector} ${targetTag}`;
      if (direct.length <= 120) {
        try {
          const m = validateFn(direct);
          if (m && Array.isArray(m) && m.length > 0 && m.some((el) => el === targetElement)) {
            narrowed.push({ locator: direct, strategy: "narrowed-ancestor-tag", matchCount: m.length, unique: m.length === 1, locatorType });
          }
        } catch (_) {}
      }
    }

    if (narrowed.some((r) => r.unique)) break;
  }

  return narrowed;
}

window.__suggestLocators = function (targetElement, locatorType) {
  locatorType = locatorType || "smart";
  try {
    const attrs = window.__extractAttributes(targetElement);
    if (!attrs) return { suggestions: [], message: "Could not extract element attributes" };

    let candidates;
    let validateFn;
    switch (locatorType) {
      case "css":
        candidates = (window.__locatorEngines.generateCssCandidates || window.__locatorEngines.generateCandidates)(attrs) || [];
        validateFn = (loc) => window.__locatorEngines.findByCss(loc);
        break;
      case "xpath":
        candidates = (window.__locatorEngines.generateXPathCandidates || window.__locatorEngines.generateCandidates)(attrs) || [];
        validateFn = (loc) => window.__locatorEngines.findByXPath(loc);
        break;
      case "playwright":
        candidates = (window.__locatorEngines.generatePlaywrightCandidates || window.__locatorEngines.generateCandidates)(attrs) || [];
        validateFn = (loc) => window.__locatorEngines.findByPlaywright(loc);
        break;
      default: // "smart"
        candidates = window.__locatorEngines.generateCandidates(attrs) || [];
        validateFn = (loc) => window.__locatorEngines.findBySmartLocator(loc);
    }

    const tag = attrs.tag || "";
    const narrowingPseudos = [];
    if (locatorType === "smart") {
      if (attrs.isVisible) narrowingPseudos.push(":visible");
      if (["input", "select", "textarea", "button"].includes(tag)) narrowingPseudos.push(":enabled");
      if (attrs.type === "checkbox" || attrs.type === "radio") narrowingPseudos.push(":checked");
    } else if (locatorType === "css") {
      if (["input", "select", "textarea", "button"].includes(tag)) narrowingPseudos.push(":enabled");
      if (attrs.type === "checkbox" || attrs.type === "radio") narrowingPseudos.push(":checked");
    }
    // xpath and playwright: no pseudo-suffix narrowing

    function tryPseudoNarrowing(baseLocator, baseMatchCount) {
      if (baseMatchCount === 1 || narrowingPseudos.length === 0) return { locator: baseLocator, matchCount: baseMatchCount };
      let best = { locator: baseLocator, matchCount: baseMatchCount };
      for (const pseudo of narrowingPseudos) {
        if (baseLocator.includes(pseudo)) continue;
        try {
          const narrowed = baseLocator + pseudo;
          const m = validateFn(narrowed);
          if (!m || m.error || !Array.isArray(m) || m.length === 0) continue;
          if (!m.some((el) => el === targetElement)) continue;
          if (m.length < best.matchCount) { best = { locator: narrowed, matchCount: m.length }; if (best.matchCount === 1) return best; }
        } catch (_) {}
      }
      if (best.matchCount > 1 && narrowingPseudos.length > 1) {
        for (let i = 0; i < narrowingPseudos.length; i++) {
          for (let j = i + 1; j < narrowingPseudos.length; j++) {
            const combo = narrowingPseudos[i] + narrowingPseudos[j];
            if (baseLocator.includes(narrowingPseudos[i]) || baseLocator.includes(narrowingPseudos[j])) continue;
            try {
              const narrowed = baseLocator + combo;
              const m = validateFn(narrowed);
              if (!m || m.error || !Array.isArray(m) || m.length === 0) continue;
              if (!m.some((el) => el === targetElement)) continue;
              if (m.length < best.matchCount) { best = { locator: narrowed, matchCount: m.length }; if (best.matchCount === 1) return best; }
            } catch (_) {}
          }
        }
      }
      return best;
    }

    const strategyPriority = {
      // smart / css
      "css-testid": 0, "css-testid-visible": 0, "css-testid-enabled": 0,
      "css-data": 1, "css-role-name": 2, "css-aria": 3, "css-aria-label": 3,
      "text-exact": 4, "has-text": 5, "css-aria-visible": 6, "css-name": 7,
      "css-type": 8, "css-placeholder": 9, "css-title": 10, "css-alt": 10,
      "css-tag-class": 11, "css-tag-class-visible": 11, "css-id": 12, "css-role-only": 13,
      "narrowed-css-testid": 1, "narrowed-css-data": 2,
      "narrowed-text-exact": 5, "narrowed-has-text": 6,
      "narrowed-css-tag-class": 12, "narrowed-css-tag-class-visible": 12,
      "narrowed-ancestor-tag": 8,
      // xpath
      "xpath-testid": 0, "xpath-data": 1, "xpath-role-name": 2, "xpath-aria": 3,
      "xpath-text-exact": 4, "xpath-text-contains": 5,
      "xpath-name": 6, "xpath-type": 7, "xpath-placeholder": 8,
      "xpath-title": 9, "xpath-alt": 10, "xpath-class": 11, "xpath-id": 12,
      "narrowed-xpath-testid": 1, "narrowed-xpath-aria": 3,
      "narrowed-xpath-text-exact": 4, "narrowed-xpath-text-contains": 5,
      "narrowed-xpath-class": 11, "xpath-narrowed-tag": 8,
      // playwright
      "pw-testid": 0, "pw-role-name": 1, "pw-role": 2,
      "pw-text": 3, "pw-label": 4,
      "narrowed-pw-testid": 1, "narrowed-pw-role-name": 2, "narrowed-pw-text": 3,
    };

    const validated = [];
    const nonUniqueForAncestor = [];

    for (const candidate of candidates) {
      try {
        const matched = validateFn(candidate.locator);
        if (!matched || matched.error || !Array.isArray(matched) || matched.length === 0) continue;
        if (!matched.some((el) => el === targetElement)) continue;
        const { locator: bestLocator, matchCount: bestCount } = tryPseudoNarrowing(candidate.locator, matched.length);
        validated.push({ locator: bestLocator, strategy: candidate.strategy, matchCount: bestCount, unique: bestCount === 1, locatorType });
        if (bestCount > 1) nonUniqueForAncestor.push({ locator: bestLocator, strategy: candidate.strategy });
      } catch (_) {}
    }

    const unique = validated.filter((v) => v.unique);

    let ancestorNarrowed = [];
    if (unique.length === 0 && locatorType !== "playwright") {
      const ancestors = findUsefulAncestors(targetElement);
      if (ancestors.length > 0) {
        ancestorNarrowed = narrowWithAncestors(nonUniqueForAncestor, targetElement, ancestors, locatorType, validateFn);
      }
    }

    const uniqueNarrowed = ancestorNarrowed.filter((n) => n.unique);
    const allResults = [
      ...unique,
      ...uniqueNarrowed,
      ...(unique.length === 0 && uniqueNarrowed.length === 0
        ? [...validated.slice(0, 2), ...ancestorNarrowed.slice(0, 2)]
        : []),
    ];

    const seen = new Set();
    const deduped = allResults.filter((r) => { if (seen.has(r.locator)) return false; seen.add(r.locator); return true; });

    deduped.sort((a, b) => {
      if (a.unique !== b.unique) return a.unique ? -1 : 1;
      return (strategyPriority[a.strategy] ?? 50) - (strategyPriority[b.strategy] ?? 50);
    });

    if (deduped.length === 0) {
      return { suggestions: [], message: "No better locator available — consider adding data-testid to this element" };
    }
    const hasUnique = deduped.some((r) => r.unique);
    return { suggestions: deduped.slice(0, 5), message: hasUnique ? null : "Could not find a unique locator for this element" };
  } catch (e) {
    return { suggestions: [], message: "Error generating suggestions: " + e.message };
  }
};

function getImplicitRole(tag, element) {
  const roleMap = {
    button: "button", a: "link", nav: "navigation", main: "main",
    header: "banner", footer: "contentinfo", aside: "complementary",
    dialog: "dialog", select: "combobox", textarea: "textbox",
  };
  if (tag === "input") {
    const t = (element.getAttribute("type") || "text").toLowerCase();
    if (t === "checkbox") return "checkbox";
    if (t === "radio") return "radio";
    if (t === "submit" || t === "button") return "button";
    return "textbox";
  }
  return roleMap[tag] || null;
}

function resolveAriaLabelledBy(element) {
  const val = element.getAttribute("aria-labelledby");
  if (!val) return null;
  const texts = val.split(/\s+/).map((id) => {
    const el = document.getElementById(id);
    return el ? el.textContent.trim() : "";
  }).filter(Boolean);
  return texts.length > 0 ? texts.join(" ") : null;
}

window.__lastMatchedElements = null;

window.__extractAttributes = function (element) {
  if (!element || !element.tagName) return null;

  function esc(v) {
    return v ? String(v).replace(/"/g, '\\"') : v;
  }

  const tag = element.tagName.toLowerCase();

  let id = element.id || null;
  if (id && (/\d{4,}/.test(id) || id.startsWith(":") || /^react/i.test(id) || /^ember/i.test(id))) {
    id = null;
  }

  const rawClassName = typeof element.className === "string"
    ? element.className
    : (element.getAttribute && element.getAttribute("class")) || "";
  const rawClasses = rawClassName.split(/\s+/).filter(Boolean);

  const testIdSources = ["data-testid", "data-test-id", "data-cy", "data-test", "data-qa"];
  let testId = null;
  let testIdAttr = "data-testid";
  for (const a of testIdSources) {
    const v = element.getAttribute(a);
    if (v) { testId = esc(v); testIdAttr = a; break; }
  }

  const skipPrefixes = ["data-reactid", "data-react", "data-v-", "data-rbd-"];
  const dataAttrs = {};
  if (element.hasAttributes()) {
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      if (attr.name.startsWith("data-")) {
        if (!skipPrefixes.some((p) => attr.name.startsWith(p))) {
          dataAttrs[attr.name] = esc(attr.value);
        }
      }
    }
  }

  const explicitRole = element.getAttribute("role");
  const role = explicitRole ? esc(explicitRole) : getImplicitRole(tag, element);

  const ariaLabelRaw = (element.getAttribute("aria-label") || "").trim();
  const ariaLabel = ariaLabelRaw ? esc(ariaLabelRaw) : null;
  const ariaLabelledByRaw = resolveAriaLabelledBy(element);
  const ariaLabelledBy = ariaLabelledByRaw ? esc(ariaLabelledByRaw) : null;

  const name = element.getAttribute("name") ? esc(element.getAttribute("name").trim()) : null;
  const type = element.getAttribute("type") || null;
  const placeholderRaw = (element.getAttribute("placeholder") || "").trim();
  const placeholder = placeholderRaw ? esc(placeholderRaw) : null;
  const titleRaw = (element.getAttribute("title") || "").trim();
  const title = titleRaw ? esc(titleRaw) : null;
  const altRaw = (element.getAttribute("alt") || "").trim();
  const alt = altRaw ? esc(altRaw) : null;

  let href = element.getAttribute("href") || null;
  if (href) {
    try {
      href = new URL(href, window.location.href).pathname;
    } catch (_) { /* keep as-is */ }
    href = esc(href);
  }

  let text = (element.textContent || "").trim()
    .replace(/\s+/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
  if (text.length > 50) text = text.substring(0, 50);
  text = esc(text) || "";

  const style = window.getComputedStyle(element);
  const isVisible = style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    element.offsetHeight > 0 &&
    element.offsetWidth > 0;

  return {
    tag, id, rawClasses, testId, testIdAttr, dataAttrs,
    role, ariaLabel, ariaLabelledBy, name, type,
    placeholder, title, alt, href, text, isVisible,
  };
};

console.log(
  "[Injector] window.__locatorInspect defined:",
  typeof window.__locatorInspect
);
