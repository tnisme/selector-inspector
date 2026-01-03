import {
  initPopupState,
  nextRequestId,
  getCurrentRequestId,
  saveLocatorType,
  saveLocatorValue,
  updatePlaceholder,
} from "./popup.state.js";
import {
  initPopupUI,
  showResult,
  showLoading,
  hideResult,
  setUIGlobals,
} from "./popup.ui.js";
import {
  initPopupInspection,
  debounceInspection,
  triggerInspection,
  clearPageOverlays,
  setInjectionGlobals,
} from "./popup.inject.js";

let typeSelect, locatorInput;

document.addEventListener("DOMContentLoaded", () => {
  initPopupState();

  typeSelect = document.getElementById("type");
  locatorInput = document.getElementById("locator");

  setUIGlobals(typeSelect, locatorInput);
  setInjectionGlobals(typeSelect, locatorInput);

  initPopupUI();
  initPopupInspection();
});
