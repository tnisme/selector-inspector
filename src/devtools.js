import { scoreLive } from './scorer/locatorScorer.mjs';

// Connect to background for sidebar lifecycle (REINJECT on navigation)
const port = chrome.runtime.connect({ name: "devtools-sidebar" });
const tabId = chrome.devtools.inspectedWindow.tabId;
port.postMessage({ type: "INIT", tabId });

// Background can send SHOW_SIDEBAR back through this port (e.g. from context menu)
let sidebarRef = null;
port.onMessage.addListener((msg) => {
  if (msg.type === "SHOW_SIDEBAR" && sidebarRef) {
    sidebarRef.show();
  }
});

// Create the main DevTools panel (reuses popup.html as-is)
chrome.devtools.panels.create(
  "Locator Inspector",
  "icons/16.png",
  "popup.html",
  () => {}
);

// Analysis function — serialized and eval'd in the inspected page via $0
function _analyzeSelectedElement(el) {
  if (!el || el.nodeType !== 1) return null;

  const tag = el.tagName.toLowerCase();
  const suggestions = [];

  // 1. data-testid / data-cy
  const testId =
    el.getAttribute("data-testid") ||
    el.getAttribute("data-test-id") ||
    el.getAttribute("data-cy");
  if (testId) {
    const sel = '[data-testid="' + testId + '"]';
    suggestions.push({
      type: "Playwright",
      selector: 'getByTestId("' + testId + '")',
      quality: "high",
      score: 95,
      matchCount: document.querySelectorAll(sel).length,
      isUnique: document.querySelectorAll(sel).length === 1,
    });
  }

  // 2. Accessible role + name
  const roleMap = {
    BUTTON: "button", A: "link", INPUT: "textbox", SELECT: "combobox",
    TEXTAREA: "textbox", IMG: "img", NAV: "navigation", MAIN: "main",
    HEADER: "banner", FOOTER: "contentinfo", FORM: "form", TABLE: "table",
  };
  const role = el.getAttribute("role") || roleMap[el.tagName] || null;
  if (role) {
    const name =
      el.getAttribute("aria-label") ||
      (el.innerText ? el.innerText.trim().substring(0, 40) : "") ||
      "";
    const selectorText = name
      ? 'getByRole("' + role + '", { name: "' + name.replace(/"/g, '\\"') + '" })'
      : 'getByRole("' + role + '")';
    suggestions.push({
      type: "Playwright",
      selector: selectorText,
      quality: "high",
      score: 90,
      matchCount: -1,
      isUnique: null,
    });
  }

  // 3. ID
  if (el.id) {
    const sel = "#" + CSS.escape(el.id);
    suggestions.push({
      type: "CSS",
      selector: sel,
      quality: "high",
      score: 85,
      matchCount: document.querySelectorAll(sel).length,
      isUnique: document.querySelectorAll(sel).length === 1,
    });
  }

  // 4. aria-label
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) {
    const sel = '[aria-label="' + ariaLabel.replace(/"/g, '\\"') + '"]';
    suggestions.push({
      type: "CSS",
      selector: sel,
      quality: "medium",
      score: 70,
      matchCount: document.querySelectorAll(sel).length,
      isUnique: document.querySelectorAll(sel).length === 1,
    });
  }

  // 5. Text content (leaf elements only)
  const text = el.innerText ? el.innerText.trim() : "";
  if (text && text.length > 0 && text.length < 50 && el.children.length === 0) {
    suggestions.push({
      type: "Playwright",
      selector: 'getByText("' + text.replace(/"/g, '\\"') + '")',
      quality: "medium",
      score: 65,
      matchCount: -1,
      isUnique: null,
    });
  }

  // 6. Tag + classes
  const classes = Array.from(el.classList);
  if (classes.length > 0) {
    const sel = tag + "." + classes.map((c) => CSS.escape(c)).join(".");
    suggestions.push({
      type: "CSS",
      selector: sel,
      quality: "low",
      score: 40,
      matchCount: document.querySelectorAll(sel).length,
      isUnique: document.querySelectorAll(sel).length === 1,
    });
  }

  // 7. XPath absolute
  const parts = [];
  let current = el;
  while (current && current.nodeType === 1) {
    let index = 1;
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === current.tagName) index++;
      sibling = sibling.previousElementSibling;
    }
    parts.unshift(current.tagName.toLowerCase() + "[" + index + "]");
    current = current.parentElement;
  }
  suggestions.push({
    type: "XPath",
    selector: "/" + parts.join("/"),
    quality: "low",
    score: 15,
    matchCount: 1,
    isUnique: true,
  });

  suggestions.sort((a, b) => b.score - a.score);

  const attrNames = [
    "data-testid", "data-test-id", "data-cy", "role", "aria-label",
    "name", "type", "placeholder", "href", "title", "alt",
  ];
  const attributes = {};
  for (const attr of attrNames) {
    if (el.hasAttribute(attr)) attributes[attr] = el.getAttribute(attr);
  }

  return {
    tag,
    id: el.id || null,
    classes: Array.from(el.classList),
    attributes,
    suggestions,
  };
}

// ─── Smart suggestions bridge ─────────────────────────────────────────────────
// document.__li_sel (set in main world by ANALYSIS_CODE) is a DOM node property,
// so it is readable from the isolated world where __suggestLocators lives.

let _smartReqCounter = 0;

function getSmartSuggestions(elementPath) {
  return new Promise((resolve) => {
    const requestId = ++_smartReqCounter;
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) { settled = true; port.onMessage.removeListener(listener); resolve([]); }
    }, 3000);

    function listener(msg) {
      if (msg.type === "SMART_SUGGESTIONS_RESULT" && msg.requestId === requestId) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          port.onMessage.removeListener(listener);
          resolve(msg.suggestions || []);
        }
      }
    }
    port.onMessage.addListener(listener);
    port.postMessage({ type: "GET_SMART_SUGGESTIONS", tabId, requestId, elementPath });
  });
}

// ANALYSIS_CODE returns basic element info and an absolute XPath path for the element.
// The XPath is passed to background so isolated-world scripting can re-locate the element
// via document.evaluate — expando properties are NOT shared between worlds, but XPath is.
const ANALYSIS_CODE =
  "(function(el){" +
  "function _elPath(e){" +
  "var p=[];var c=e;" +
  "while(c&&c.nodeType===1){" +
  "var i=1;var s=c.previousElementSibling;" +
  "while(s){if(s.tagName===c.tagName)i++;s=s.previousElementSibling;}" +
  "p.unshift(c.tagName.toLowerCase()+'['+i+']');" +
  "c=c.parentElement;}" +
  "return '/'+p.join('/');}\n" +
  _analyzeSelectedElement.toString() + "\n" +
  "var r=_analyzeSelectedElement(el);" +
  "if(r)r.elementPath=_elPath(el);" +
  "return r;" +
  "})($0)";

// Create the Elements sidebar pane
chrome.devtools.panels.elements.createSidebarPane("Locators", (sidebar) => {
  sidebarRef = sidebar; // expose to port listener above
  sidebar.setPage("sidebar.html");

  let _analysisGen = 0;

  async function analyzeAndUpdate() {
    const gen = ++_analysisGen;

    port.postMessage({ type: "SIDEBAR_LOADING", tabId });

    // Step 1: run in main world — sets document.__li_sel and returns element info
    const basicResult = await new Promise((resolve) => {
      chrome.devtools.inspectedWindow.eval(ANALYSIS_CODE, (result, exceptionInfo) => {
        if (exceptionInfo) console.error("Locator Inspector: eval error", exceptionInfo);
        resolve(exceptionInfo || !result ? null : result);
      });
    });

    if (gen !== _analysisGen) return; // superseded by a newer selection

    if (!basicResult) {
      port.postMessage({ type: "SIDEBAR_EMPTY", tabId });
      return;
    }

    // Step 2: fetch smart suggestions from isolated world (uses the real engine)
    const rawSmart = await getSmartSuggestions(basicResult.elementPath);

    if (gen !== _analysisGen) return; // superseded by a newer selection

    if (rawSmart.length > 0) {
      const existingSels = new Set(basicResult.suggestions.map((s) => s.selector));
      for (const s of rawSmart) {
        if (existingSels.has(s.locator)) continue;
        const mc = s.matchCount != null ? s.matchCount : 1;
        const { score } = scoreLive(s.locator, s.locatorType || "smart", mc, []);
        basicResult.suggestions.push({
          type: "Smart",
          selector: s.locator,
          quality: score >= 80 ? "high" : score >= 50 ? "medium" : "low",
          score,
          matchCount: mc,
          isUnique: s.unique || mc === 1,
        });
        existingSels.add(s.locator);
      }
      basicResult.suggestions.sort((a, b) => b.score - a.score);
    }

    port.postMessage({ type: "SIDEBAR_UPDATE", tabId, data: basicResult });
  }

  chrome.devtools.panels.elements.onSelectionChanged.addListener(
    analyzeAndUpdate
  );

  // Analyze whatever is already selected when the Locators tab is first opened
  analyzeAndUpdate();
});

// Re-inject content scripts when the user navigates in the inspected tab
chrome.devtools.network.onNavigated.addListener(() => {
  port.postMessage({ type: "REINJECT", tabId });
});
