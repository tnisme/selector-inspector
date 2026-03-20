import {
  saveLocatorType,
  updatePlaceholder,
  saveLocatorValue,
} from "./popup.state.js";
import { debounceInspection, triggerInspection, triggerHighlight } from "./popup.inject.js";

let resultDiv;
let typeSelect, locatorInput;

function initPopupUI() {
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

  locatorInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const start = locatorInput.selectionStart;
        const end = locatorInput.selectionEnd;
        const value = locatorInput.value;
        locatorInput.value = value.substring(0, start) + "\n" + value.substring(end);
        locatorInput.selectionStart = locatorInput.selectionEnd = start + 1;
        locatorInput.dispatchEvent(new Event("input"));
      } else {
        e.preventDefault();
        triggerInspection();
      }
    }
  });
}

function showResult(data, type) {
  resultDiv.className = `result-${type}`;
  resultDiv.style.display = "block";

  if (typeof data === "string") {
    resultDiv.textContent = data;
    return;
  }

  // Handle detailed element list
  if (Array.isArray(data)) {
    resultDiv.innerHTML = "";

    // Header
    const countDiv = document.createElement("div");
    countDiv.style.marginBottom = "10px";
    countDiv.style.fontWeight = "bold";
    countDiv.textContent = `Found ${data.length} element(s)`;
    resultDiv.appendChild(countDiv);

    // List
    const list = document.createElement("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "8px";

    data.forEach((el, index) => {
      const item = document.createElement("div");
      item.style.fontFamily = "monospace";
      item.style.fontSize = "12px";
      item.style.borderBottom = "1px solid var(--border)";
      item.style.paddingBottom = "4px";

      // Clickable styles and event
      item.style.cursor = "pointer";
      item.style.transition = "background 0.2s";
      item.style.padding = "4px";
      item.style.borderRadius = "4px";

      item.addEventListener("mouseenter", () => {
        item.style.background = "rgba(0,0,0,0.05)";
      });
      item.addEventListener("mouseleave", () => {
        item.style.background = "transparent";
      });
      item.addEventListener("click", () => {
        triggerHighlight(index);
      });

      if (index === data.length - 1) item.style.borderBottom = "none";

      const tagSpan = document.createElement("span");
      tagSpan.style.color = "#800080"; // purple for tag
      tagSpan.style.fontWeight = "bold";
      tagSpan.textContent = el.tagName;

      const idSpan = document.createElement("span");
      idSpan.style.color = "#000080"; // navy for id
      if (el.id) idSpan.textContent = `#${el.id}`;

      const classSpan = document.createElement("span");
      classSpan.style.color = "#008080"; // teal for class
      if (el.className) classSpan.textContent = `.${el.className.split(" ").join(".")}`;

      item.appendChild(document.createTextNode(`${index + 1}. <`));
      item.appendChild(tagSpan);
      item.appendChild(idSpan);
      item.appendChild(classSpan);

      // Attributes
      Object.entries(el.attributes).forEach(([key, val]) => {
        if (key === "id" || key === "class") return;
        const attrSpan = document.createElement("span");
        attrSpan.style.color = "#A0522D"; // sienna for attr
        attrSpan.style.marginLeft = "4px";
        attrSpan.textContent = `${key}="${val}"`;
        item.appendChild(attrSpan);
      });

      item.appendChild(document.createTextNode(">"));

      // Text content preview
      if (el.text) {
        const textSpan = document.createElement("span");
        textSpan.style.color = "#333";
        textSpan.style.marginLeft = "8px";
        textSpan.style.fontStyle = "italic";
        const truncatedText = el.text.length > 50 ? el.text.substring(0, 50) + "..." : el.text;
        textSpan.textContent = truncatedText;
        item.appendChild(textSpan);
      }

      list.appendChild(item);
    });

    resultDiv.appendChild(list);
  }
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
