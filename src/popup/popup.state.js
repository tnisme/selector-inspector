let _locatorRequestSeq = 0;
let typeSelect, locatorInput;

function initPopupState() {
  typeSelect = document.getElementById("type");
  locatorInput = document.getElementById("locator");

  loadSavedValues(typeSelect, locatorInput, updatePlaceholder);
}

function nextRequestId() {
  _locatorRequestSeq += 1;
  return _locatorRequestSeq;
}

function getCurrentRequestId() {
  return _locatorRequestSeq;
}

function loadSavedValues(typeSelect, locatorInput, updatePlaceholder) {
  chrome.storage.local.get(["locatorType", "locatorValue"], (result) => {
    if (result.locatorType) typeSelect.value = result.locatorType;
    if (result.locatorValue) locatorInput.value = result.locatorValue;
    updatePlaceholder();
  });
}

function saveLocatorType(value) {
  chrome.storage.local.set({ locatorType: value });
}

function saveLocatorValue(value) {
  chrome.storage.local.set({ locatorValue: value });
}

function updatePlaceholder() {
  const map = {
    css: "Enter CSS selector (e.g., .button, #myId)",
    xpath: "Enter XPath expression",
    playwright: "Enter Playwright locator",
    smart: "Enter smart locator",
  };
  locatorInput.placeholder = map[typeSelect.value];
}

export {
  initPopupState,
  nextRequestId,
  getCurrentRequestId,
  saveLocatorType,
  saveLocatorValue,
  updatePlaceholder,
};
