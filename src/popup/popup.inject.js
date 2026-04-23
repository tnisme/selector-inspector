import { nextRequestId, getCurrentRequestId } from "./popup.state.js";
import { showLoading, showResult, hideResult } from "./popup.ui.js";
import {
  getActiveContextId,
  getActiveContextLabel,
  getFrameIdFromContextId,
  resetToTopDocument,
} from "./popup.context.js";

let inspectionTimeout;
let typeSelect, locatorInput;
let _executionToken = 0; // NEW: Concurrency control

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
    } else if (r.count === 0) {
      showResult(`No elements found\n\nContext: ${contextLabel}`, "error");
    } else {
      showResult(r.elementsInfo, "success");
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

export {
  initPopupInspection,
  debounceInspection,
  triggerInspection,
  clearPageOverlays,
  setInjectionGlobals,
  triggerHighlight,
};
