import {
  initPopupState,
  saveLocatorType,
  updatePlaceholder,
} from "./popup.state.js";
import {
  initPopupUI,
  setUIGlobals,
  showSuggestPrompt,
} from "./popup.ui.js";
import {
  initPopupInspection,
  setInjectionGlobals,
  triggerPickElement,
  triggerInspection,
} from "./popup.inject.js";
import {
  initContextUI,
} from "./popup.context.js";

let typeSelect, locatorInput;

// Detect if popup.html is running as a DevTools panel (vs side panel)
const isDevToolsPanel = typeof chrome.devtools !== "undefined";
let devtoolsPort = null;

if (isDevToolsPanel) {
  devtoolsPort = chrome.runtime.connect({ name: "devtools-panel" });
  const tabId = chrome.devtools.inspectedWindow.tabId;
  devtoolsPort.postMessage({ type: "INIT", tabId });

  devtoolsPort.onMessage.addListener((msg) => {
    if (msg.type === "ELEMENT_SUGGESTIONS") {
      applyElementSuggestions(msg.data);
    }
  });

  devtoolsPort.onDisconnect.addListener(() => {
    devtoolsPort = null;
  });
} else {
  // Side Panel mode — notify background of lifecycle events
  chrome.runtime.sendMessage({ type: "panel-opened" }).catch(() => {});
}

document.addEventListener("DOMContentLoaded", () => {
  initPopupState();

  typeSelect = document.getElementById("type");
  locatorInput = document.getElementById("locator");

  setUIGlobals(typeSelect, locatorInput);
  setInjectionGlobals(typeSelect, locatorInput);

  initPopupUI();
  initPopupInspection();
  initContextUI();

  const pickBtn = document.getElementById("pickBtn");
  if (pickBtn) pickBtn.addEventListener("click", triggerPickElement);
});

// Side Panel close — only send panel-closed when NOT in DevTools mode
window.addEventListener("beforeunload", () => {
  if (!isDevToolsPanel) {
    chrome.runtime.sendMessage({ type: "panel-closed" }).catch(() => {});
  }
});

// Visibility change applies only to side panel
document.addEventListener("visibilitychange", () => {
  if (isDevToolsPanel) return;
  if (document.hidden) {
    chrome.runtime.sendMessage({ type: "panel-closed" }).catch(() => {});
  } else {
    chrome.runtime.sendMessage({ type: "panel-opened" }).catch(() => {});
  }
});

// Apply element suggestions received from context menu or sidebar "Use in Panel"
function applyElementSuggestions(data) {
  if (!typeSelect || !locatorInput) return;

  const suggestions = data && data.suggestions;
  let selector, locatorType;

  if (suggestions && suggestions.length > 0) {
    const best = suggestions[0];
    selector = best.selector;
    // Map suggestion type names to select option values
    const typeMap = {
      playwright: "playwright",
      css: "css",
      xpath: "xpath",
      smart: "smart",
    };
    locatorType = typeMap[(best.type || "").toLowerCase()] || "css";
  } else if (data && data.selector) {
    // Plain {selector, type} from USE_IN_PANEL
    selector = data.selector;
    locatorType = (data.type || "css").toLowerCase();
    if (!["css", "xpath", "playwright", "smart"].includes(locatorType)) {
      locatorType = "css";
    }
  }

  if (!selector) return;

  typeSelect.value = locatorType;
  locatorInput.value = selector;
  saveLocatorType(locatorType);
  updatePlaceholder();

  // Show a brief notification
  showSuggestPrompt("Selector suggested — click Inspect to verify");

  // Trigger inspection after a tick so UI updates first
  setTimeout(() => triggerInspection(), 50);
}
