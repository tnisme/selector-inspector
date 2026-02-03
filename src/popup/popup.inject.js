import { nextRequestId, getCurrentRequestId } from "./popup.state.js";
import { showLoading, showResult, hideResult } from "./popup.ui.js";

let inspectionTimeout;
let typeSelect, locatorInput;

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
    "locator-inspector-overlay-container"
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

  if (!locator) {
    hideResult();
    clearPageOverlays();
    return;
  }

  showLoading("Live inspecting...");

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab) return;

  let isLoaded = false;
  for (let i = 0; i < 3; i++) {
    const checkResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => typeof window.__locatorInspect,
      world: "MAIN",
    }).catch(() => null);

    if (checkResult?.[0]?.result === "function") {
      isLoaded = true;
      break;
    }

    if (i === 0) {
      chrome.runtime.sendMessage({ type: "panel-opened" }).catch(() => { });
      await new Promise((resolve) => setTimeout(resolve, 200));
    } else {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  if (!isLoaded) {
    return showResult(
      "Inspection function not loaded. Please refresh the page and try again.",
      "error"
    );
  }

  const requestId = nextRequestId();

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (id) => {
      if (window.__locatorInspect) window.__locatorInspect.__lastRequestId = id;
    },
    args: [requestId],
    world: "MAIN",
  });

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
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
      world: "MAIN",
    });

    if (requestId !== getCurrentRequestId()) return;

    const res = results?.[0]?.result;
    if (!res) return showResult("No result", "error");

    if (!res.ok) return showResult(res.error, "error");

    const r = res.value;
    if (r.error) showResult(r.error, "error");
    else if (r.count === 0) showResult("No elements found", "error");
    else showResult(r.elementsInfo, "success");
  } catch (err) {
    showResult(`Inspection failed: ${err.message}`, "error");
  }
}

async function clearPageOverlays() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab) return;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: clearOverlays,
    world: "MAIN",
  });
}


async function triggerHighlight(index) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab) return;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (idx) => {
      if (window.__locatorHighlight) window.__locatorHighlight(idx);
    },
    args: [index],
    world: "MAIN",
  }).catch(() => { });
}

export {
  initPopupInspection,
  debounceInspection,
  triggerInspection,
  clearPageOverlays,
  setInjectionGlobals,
  triggerHighlight,
};
