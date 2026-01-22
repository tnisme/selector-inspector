import {
  saveLocatorType,
  updatePlaceholder,
  saveLocatorValue,
} from './popup.state.js';
import { debounceInspection, triggerInspection } from './popup.inject.js';

let resultDiv;
let typeSelect, locatorInput;

function initPopupUI() {
  resultDiv = document.getElementById('result');

  typeSelect.addEventListener('change', () => {
    saveLocatorType(typeSelect.value);
    updatePlaceholder();
    if (locatorInput.value.trim()) triggerInspection();
  });

  locatorInput.addEventListener('input', () => {
    saveLocatorValue(locatorInput.value);
    debounceInspection();
  });

  locatorInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) {
        // Cmd/Ctrl + Enter: allow new line (default behavior)
        return;
      } else {
        // Enter alone: trigger inspection
        e.preventDefault();
        triggerInspection();
      }
    }
  });
}

function showResult(message, type) {
  resultDiv.className = `result-${type}`;
  resultDiv.textContent = message;
  resultDiv.style.display = 'block';
}

function showLoading(message) {
  resultDiv.className = 'result-info';
  resultDiv.innerHTML = `<span class="loading"></span>${message}`;
  resultDiv.style.display = 'block';
}

function hideResult() {
  resultDiv.style.display = 'none';
}

export { initPopupUI, showResult, showLoading, hideResult };

export function setUIGlobals(ts, li) {
  typeSelect = ts;
  locatorInput = li;
}
