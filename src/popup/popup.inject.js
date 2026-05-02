import { nextRequestId, getCurrentRequestId } from "./popup.state.js";
import { showLoading, showResult, hideResult, showScore, hideScore, showSuggestions, hideSuggestions, showSuggestPrompt } from "./popup.ui.js";
import { scoreLive } from "../scorer/locatorScorer.mjs";
import {
  getActiveContextId,
  getActiveContextLabel,
  getFrameIdFromContextId,
  resetToTopDocument,
} from "./popup.context.js";

let inspectionTimeout;
let typeSelect, locatorInput;
let _executionToken = 0; // NEW: Concurrency control
let _awaitingElementSelection = false;

function initPopupInspection() {
  if (typeSelect && locatorInput && locatorInput.value.trim()) {
    setTimeout(() => {
      triggerInspection();
    }, 100);
  }
}

function setInjectionGlobals(ts, li) {
  typeSelect = ts;
  locatorInput = li;
}

function clearOverlays() {
  const container = document.getElementById(
    "locator-inspector-overlay-container",
  );
  if (container) {
    if (container._cleanup) container._cleanup();
    container.remove();
  }
  const styles = document.getElementById("locator-inspector-styles");
  if (styles) styles.remove();
}

function debounceInspection() {
  clearTimeout(inspectionTimeout);
  inspectionTimeout = setTimeout(triggerInspection, 300);
}

async function triggerInspection() {
  const locator = locatorInput.value.trim();
  const type = typeSelect.value;
  const contextId = getActiveContextId(); // NEW: Get active context
  const frameId = getFrameIdFromContextId(contextId); // NEW: Convert to frame ID

  if (!locator) {
    hideResult();
    hideScore();
    hideSuggestions();
    clearPageOverlays();
    return;
  }

  // Clear existing overlays across all frames before running new inspection
  await clearPageOverlays();

  showLoading("Live inspecting...");

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab) return;

  // NEW: Validate context still exists
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
    const frameExists = frames.some((f) => f.frameId === frameId);

    if (!frameExists) {
      await resetToTopDocument();
      return showResult(
        "The selected iframe no longer exists. Reset to top document.",
        "error",
      );
    }
  } catch (error) {
    return showResult(`Failed to validate context: ${error.message}`, "error");
  }

  // NEW: Check if engines are loaded in target frame
  let isLoaded = false;
  let lastError = null;
  for (let i = 0; i < 3; i++) {
    const checkResult = await chrome.scripting
      .executeScript({
        target: { tabId: tab.id, frameIds: [frameId] }, // NEW: Use frameIds
        func: () => typeof window.__locatorInspect,
        world: "ISOLATED",
      })
      .catch((e) => {
        lastError = e.message;
        return null;
      });

    if (checkResult?.[0]?.result === "function") {
      isLoaded = true;
      break;
    }

    if (i === 0) {
      chrome.runtime.sendMessage({ type: "panel-opened" }).catch(() => {});
      await chrome.scripting
        .executeScript({
          target: { tabId: tab.id, frameIds: [frameId] },
          files: [
            "engine/cssEngine.js",
            "engine/xpathEngine.js",
            "engine/playwrightEngine.js",
            "engine/smartLocatorEngine.js",
            "engine/candidateGenerator.js",
            "engine/injector.js",
          ],
          world: "ISOLATED",
        })
        .catch((e) => {
          lastError = e.message;
        });
      await new Promise((resolve) => setTimeout(resolve, 200));
    } else {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  if (!isLoaded) {
    let msg = "Inspection function not loaded in selected context";
    if (lastError) msg += `: ${lastError}`;
    msg +=
      " Please refreshing the page or re-selecting the context from the dropdown.";
    return showResult(msg, "error");
  }

  const requestId = nextRequestId();
  const executionToken = ++_executionToken; // NEW: Track this execution
  _awaitingElementSelection = false; // cancel any pending element-click selection

  await chrome.scripting.executeScript({
    target: { tabId: tab.id, frameIds: [frameId] }, // NEW: Use frameIds
    func: (id) => {
      if (window.__locatorInspect) window.__locatorInspect.__lastRequestId = id;
    },
    args: [requestId],
    world: "ISOLATED",
  });

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [frameId] }, // NEW: Use frameIds
      func: (locator, type, reqId) => {
        try {
          if (typeof window.__locatorInspect !== "function") {
            return {
              ok: false,
              error:
                "Inspection function not loaded. Please refresh the page and try again.",
            };
          }
          return {
            ok: true,
            value: window.__locatorInspect(locator, type, reqId),
          };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      },
      args: [locator, type, requestId],
      world: "ISOLATED",
    });

    // NEW: Check if user switched context during execution
    if (executionToken !== _executionToken) {
      console.log("[Execution] Discarded stale results from context switch");
      return;
    }

    if (requestId !== getCurrentRequestId()) return;

    const res = results?.[0]?.result;
    if (!res) return showResult("No result", "error");

    if (!res.ok) return showResult(res.error, "error");

    const r = res.value;
    const contextLabel = getActiveContextLabel(); // NEW: Get context label for errors

    if (r.error) {
      showResult(`${r.error}\n\nContext: ${contextLabel}`, "error");
      hideSuggestions();
    } else if (r.count === 0) {
      showResult(`No elements found\n\nContext: ${contextLabel}`, "error");
      showScore(scoreLive(locator, type, 0, []));
      hideSuggestions();
    } else {
      showResult(r.elementsInfo, "success");
      const liveResult = scoreLive(locator, type, r.count, r.elementsInfo);
      showScore(liveResult);
      if (liveResult.score < 80) {
        if (r.count === 1) {
          triggerSuggest(tab.id, frameId, 0, type);
        } else {
          showSuggestPrompt(`${r.count} elements matched — use "Pick Element" to inspect a specific one`);
        }
      } else {
        hideSuggestions();
      }
    }
  } catch (err) {
    showResult(`Inspection failed: ${err.message}`, "error");
  }
}

async function clearPageOverlays() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab) return;

  chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: clearOverlays,
    world: "ISOLATED",
  });
}

async function triggerHighlight(index) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab) return;

  const contextId = getActiveContextId();
  const frameId = getFrameIdFromContextId(contextId);

  chrome.scripting
    .executeScript({
      target: { tabId: tab.id, frameIds: [frameId] }, // NEW: Use frameIds
      func: (idx) => {
        if (window.__locatorHighlight) window.__locatorHighlight(idx);
      },
      args: [index],
      world: "ISOLATED",
    })
    .catch(() => {});
}

async function triggerSuggest(tabId, frameId, elementIndex, locatorType) {
  const executionToken = _executionToken;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      func: (idx, type) => {
        const el = window.__lastMatchedElements?.[idx];
        if (!el) return { suggestions: [], message: "Element not found" };
        return window.__suggestLocators(el, type);
      },
      args: [elementIndex, locatorType || "smart"],
      world: "ISOLATED",
    });
    if (executionToken !== _executionToken) return;
    const data = results?.[0]?.result;
    if (!data) return;
    _applyFlatSuggestResult(data);
  } catch (err) {
    console.error("[triggerSuggest] Error:", err);
  }
}

function _applyFlatSuggestResult(data) {
  if (!data.suggestions || data.suggestions.length === 0) {
    showSuggestPrompt(data.message || "No better locator available — consider adding data-testid to this element");
    return;
  }
  const scored = data.suggestions.map((s) => ({
    ...s,
    ...scoreLive(s.locator, s.locatorType || "smart", s.matchCount, []),
  }));
  scored.sort((a, b) => b.score - a.score);
  showSuggestions(scored.slice(0, 3), data.message);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "locator-suggest-result" && _awaitingElementSelection) {
    _awaitingElementSelection = false;
    _resetPickModeUI();
    _applyFlatSuggestResult(message.data || {});
  }
});

function _resetPickModeUI() {
  const pickBtn = document.getElementById("pickBtn");
  const pickStatus = document.getElementById("pickStatus");
  const pickLabel = document.getElementById("pickLabel");
  if (pickBtn) pickBtn.classList.remove("active");
  if (pickStatus) pickStatus.classList.remove("visible");
  if (pickLabel) pickLabel.textContent = "Pick Element";
}

async function _cancelPickOnPage() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab) return;
  const frameId = getFrameIdFromContextId(getActiveContextId());
  chrome.scripting.executeScript({
    target: { tabId: tab.id, frameIds: [frameId] },
    func: () => {
      if (typeof window.__disableElementSelection === "function") {
        window.__disableElementSelection();
      }
    },
    world: "ISOLATED",
  }).catch(() => {});
}

export async function triggerPickElement() {
  const pickBtn = document.getElementById("pickBtn");
  if (!pickBtn) return;

  if (pickBtn.classList.contains("active")) {
    _awaitingElementSelection = false;
    _resetPickModeUI();
    await _cancelPickOnPage();
    return;
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab) return;

  const contextId = getActiveContextId();
  const frameId = getFrameIdFromContextId(contextId);

  // Ensure engines loaded
  let engineReady = false;
  for (let i = 0; i < 3; i++) {
    const check = await chrome.scripting
      .executeScript({
        target: { tabId: tab.id, frameIds: [frameId] },
        func: () => typeof window.__suggestLocators,
        world: "ISOLATED",
      })
      .catch(() => null);
    if (check?.[0]?.result === "function") { engineReady = true; break; }
    if (i === 0) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [frameId] },
        files: [
          "engine/cssEngine.js",
          "engine/xpathEngine.js",
          "engine/playwrightEngine.js",
          "engine/smartLocatorEngine.js",
          "engine/candidateGenerator.js",
          "engine/injector.js",
        ],
        world: "ISOLATED",
      }).catch(() => {});
      await new Promise((r) => setTimeout(r, 200));
    } else {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  if (!engineReady) {
    showSuggestPrompt("Could not load inspection engine. Try refreshing the page.");
    return;
  }

  // Activate pick mode UI
  const pickLabel = document.getElementById("pickLabel");
  const pickStatus = document.getElementById("pickStatus");
  pickBtn.classList.add("active");
  if (pickStatus) pickStatus.classList.add("visible");
  if (pickLabel) pickLabel.textContent = "Cancel Pick";
  _awaitingElementSelection = true;

  chrome.scripting.executeScript({
    target: { tabId: tab.id, frameIds: [frameId] },
    func: (locatorType) => {
      if (typeof window.__enableElementSelection !== "function") return;
      window.__enableElementSelection((el) => {
        const result = window.__suggestLocators(el, locatorType);
        chrome.runtime.sendMessage({ type: "locator-suggest-result", data: result }).catch(() => {});
      });
    },
    args: [typeSelect.value],
    world: "ISOLATED",
  }).catch(() => {});
}

export {
  initPopupInspection,
  debounceInspection,
  triggerInspection,
  clearPageOverlays,
  setInjectionGlobals,
  triggerHighlight,
  triggerSuggest,
};
