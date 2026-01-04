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
    let details = "";

    switch (type) {
      case "css":
        const css = findByCss(locator);
        if (css && css.error) return { error: css.error };
        css.forEach((el) => elements.push(el));
        break;

      case "xpath":
        const xpath = findByXPath(locator);
        if (xpath && xpath.error) return { error: xpath.error };
        xpath.forEach((el) => elements.push(el));
        break;

      case "playwright":
        const pw = findByPlaywright(locator);
        if (pw && pw.error) return { error: pw.error };
        pw.forEach((el) => elements.push(el));
        break;

      case "smart":
        const smart = findBySmartLocator(locator);
        if (smart && smart.error) return { error: smart.error };
        smart.forEach((el) => elements.push(el));
        break;

      default:
        return { error: "Unknown locator type" };
    }

    elements = [...new Set(elements)];

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
          document.body.contains(data.element)
        ) {
          const rect = data.element.getBoundingClientRect();
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

    if (elements.length > 0) {
      details = elements
        .slice(0, 5)
        .map((el, idx) => {
          const tagName = el.tagName ? el.tagName.toLowerCase() : "";
          const className = el.className
            ? ` class=\"${el.className.split(" ").slice(0, 2).join(" ")}\"`
            : "";
          const id = el.id ? ` id=\"${el.id}\"` : "";
          const text = el.textContent
            ? el.textContent.trim().substring(0, 40)
            : "";
          const attributes = [];
          ["type", "name", "value", "href", "src"].forEach((attr) => {
            if (el.hasAttribute && el.hasAttribute(attr)) {
              const value = el.getAttribute(attr).substring(0, 30);
              attributes.push(`${attr}=\"${value}\"`);
            }
          });

          let result = `${idx + 1}. <${tagName}${id}${className}`;
          if (attributes.length > 0)
            result += ` ${attributes.slice(0, 2).join(" ")}`;
          result += ">";
          if (text && text !== el.innerHTML.trim())
            result += `\n   Text: \"${text}${text.length >= 40 ? "..." : ""}\"`;
          return result;
        })
        .join("\n\n");

      if (elements.length > 5)
        details += `\n\n... and ${elements.length - 5} more elements`;
    }

    return { count: elements.length, details, error: null };
  } catch (error) {
    return {
      count: 0,
      error: error && error.message ? error.message : String(error),
    };
  }
};

console.log(
  "[Injector] window.__locatorInspect defined:",
  typeof window.__locatorInspect
);
