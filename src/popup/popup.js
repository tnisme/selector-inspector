import {
  initPopupState,
} from "./popup.state.js";
import {
  initPopupUI,
  setUIGlobals,
} from "./popup.ui.js";
import {
  initPopupInspection,
  setInjectionGlobals,
} from "./popup.inject.js";

let typeSelect, locatorInput;

// Notify background that panel is opening
chrome.runtime.sendMessage({ type: "panel-opened" }).catch(() => {
  // Ignore errors if background isn't ready
});

document.addEventListener("DOMContentLoaded", () => {
  initPopupState();

  typeSelect = document.getElementById("type");
  locatorInput = document.getElementById("locator");

  setUIGlobals(typeSelect, locatorInput);
  setInjectionGlobals(typeSelect, locatorInput);

  initPopupUI();
  initPopupInspection();
});

// Notify background when panel is closing
window.addEventListener("beforeunload", () => {
  chrome.runtime.sendMessage({ type: "panel-closed" }).catch(() => {
    // Ignore errors
  });
});

// Also handle visibility change (when user switches tabs/windows)
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    chrome.runtime.sendMessage({ type: "panel-closed" }).catch(() => {
      // Ignore errors
    });
  } else {
    chrome.runtime.sendMessage({ type: "panel-opened" }).catch(() => {
      // Ignore errors
    });
  }
});
