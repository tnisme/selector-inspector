import {
  saveLocatorType,
  updatePlaceholder,
  saveLocatorValue,
} from "./popup.state.js";
import { debounceInspection, triggerInspection } from "./popup.inject.js";

let inspectBtn, resultDiv;
let typeSelect, locatorInput;

function initPopupUI() {
  inspectBtn = document.getElementById("inspectBtn");
  resultDiv = document.getElementById("result");

  typeSelect.addEventListener("change", () => {
    saveLocatorType(typeSelect.value);
    updatePlaceholder();
    if (locatorInput.value.trim()) triggerInspection();
  });

  locatorInput.addEventListener("input", () => {
    saveLocatorValue(locatorInput.value);
    debounceInspection();
  });

  inspectBtn.addEventListener("click", triggerInspection);

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      triggerInspection();
    }
  });
}

function showResult(message, type) {
  resultDiv.className = `result-${type}`;
  resultDiv.textContent = message;
  resultDiv.style.display = "block";
}

function showLoading(message) {
  resultDiv.className = "result-info";
  resultDiv.innerHTML = `<span class="loading"></span>${message}`;
  resultDiv.style.display = "block";
}

function hideResult() {
  resultDiv.style.display = "none";
}

export { initPopupUI, showResult, showLoading, hideResult };

export function setUIGlobals(ts, li) {
  typeSelect = ts;
  locatorInput = li;
}
