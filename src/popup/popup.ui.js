import {
  saveLocatorType,
  updatePlaceholder,
  saveLocatorValue,
} from "./popup.state.js";
import { debounceInspection, triggerInspection, triggerHighlight } from "./popup.inject.js";
import { scoreStatic } from "../scorer/locatorScorer.mjs";

let resultWrap, resultBox, resultTitle, resultDiv;
let typeSelect, locatorInput;
let _scoreToggleInit = false;

function initPopupUI() {
  resultWrap  = document.getElementById("resultWrap");
  resultBox   = document.getElementById("resultBox");
  resultTitle = document.getElementById("resultTitle");
  resultDiv   = document.getElementById("result");

  typeSelect.addEventListener("change", () => {
    saveLocatorType(typeSelect.value);
    updatePlaceholder();
    const locator = locatorInput.value.trim();
    if (locator) {
      showScore(scoreStatic(locator, typeSelect.value));
      triggerInspection();
    }
  });

  locatorInput.addEventListener("input", () => {
    saveLocatorValue(locatorInput.value);
    const locator = locatorInput.value.trim();
    if (locator) {
      showScore(scoreStatic(locator, typeSelect.value));
    } else {
      hideScore();
    }
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
  resultWrap.style.display = "block";
  resultBox.className = `result-box result-${type}`;
  resultDiv.className = "";

  if (typeof data === "string") {
    resultTitle.textContent = type === "error" ? "Error" : type === "success" ? "Match" : "Info";
    resultDiv.textContent = data;
    return;
  }

  // Handle detailed element list
  if (Array.isArray(data)) {
    resultTitle.textContent = `${data.length} element(s) found`;
    resultDiv.innerHTML = "";

    // List

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
        item.style.background = "var(--item-hover)";
      });
      item.addEventListener("mouseleave", () => {
        item.style.background = "transparent";
      });
      item.addEventListener("click", () => {
        triggerHighlight(index);
      });

      if (index === data.length - 1) item.style.borderBottom = "none";

      const tagSpan = document.createElement("span");
      tagSpan.style.color = "var(--syntax-tag)";
      tagSpan.style.fontWeight = "bold";
      tagSpan.textContent = el.tagName;

      const idSpan = document.createElement("span");
      idSpan.style.color = "var(--syntax-id)";
      if (el.id) idSpan.textContent = `#${el.id}`;

      const classSpan = document.createElement("span");
      classSpan.style.color = "var(--syntax-class)";
      let classStr = typeof el.className === "string" ? el.className : "";
      if (classStr) classSpan.textContent = `.${classStr.split(" ").join(".")}`;

      item.appendChild(document.createTextNode(`${index + 1}. <`));
      item.appendChild(tagSpan);
      item.appendChild(idSpan);
      item.appendChild(classSpan);

      // Attributes
      Object.entries(el.attributes).forEach(([key, val]) => {
        if (key === "id" || key === "class") return;
        const attrSpan = document.createElement("span");
        attrSpan.style.color = "var(--syntax-attr)";
        attrSpan.style.marginLeft = "4px";
        attrSpan.textContent = `${key}="${val}"`;
        item.appendChild(attrSpan);
      });

      item.appendChild(document.createTextNode(">"));

      // Text content preview
      if (el.text) {
        const textSpan = document.createElement("span");
        textSpan.style.color = "var(--syntax-text)";
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
  resultWrap.style.display = "block";
  resultBox.className = "result-box result-info";
  resultTitle.textContent = "Inspecting…";
  resultDiv.className = "";
  resultDiv.innerHTML = `<span class="loading"></span>${message}`;
}

function hideResult() {
  resultWrap.style.display = "none";
}

export { initPopupUI, showResult, showLoading, hideResult };

export function setUIGlobals(ts, li) {
  typeSelect = ts;
  locatorInput = li;
}

export function showScore({ score, breakdown, suggestions, confidence }) {
  const panel = document.getElementById("score-panel");
  const valueEl = document.getElementById("score-value");

  if (!_scoreToggleInit) {
    _scoreToggleInit = true;
    const header = document.getElementById("score-header");
    const details = document.getElementById("score-details");
    header.addEventListener("click", () => {
      const open = details.classList.toggle("open");
      header.classList.toggle("open", open);
    });
  }
  const dotEl = document.getElementById("score-dot");
  const confidenceEl = document.getElementById("score-confidence");
  const breakdownEl = document.getElementById("score-breakdown");
  const suggestionsEl = document.getElementById("score-suggestions");

  const color =
    score >= 70 ? "var(--green)" : score >= 40 ? "var(--amber)" : "var(--red)";

  valueEl.textContent = score;
  valueEl.style.color = color;
  valueEl.style.opacity = confidence === "preview" ? "0.65" : "1";
  dotEl.style.background = color;

  confidenceEl.textContent =
    confidence === "verified" ? "Verified score" : "Preview score";

  breakdownEl.innerHTML = "";
  breakdown.forEach((item) => {
    const row = document.createElement("div");
    row.className = "score-row";

    const labelEl = document.createElement("span");
    labelEl.className = "score-row-label";
    const iconColor =
      item.delta > 0 ? "var(--green)" : item.delta < 0 ? "var(--red)" : "var(--text3)";
    const icon = item.delta > 0 ? "✓" : item.delta < 0 ? "✗" : "○";
    labelEl.innerHTML = `<span style="color:${iconColor};margin-right:5px">${icon}</span>${item.label}`;

    const deltaEl = document.createElement("span");
    deltaEl.className = "score-row-delta";
    deltaEl.textContent = item.delta > 0 ? `+${item.delta}` : `${item.delta}`;
    deltaEl.style.color = iconColor;

    row.appendChild(labelEl);
    row.appendChild(deltaEl);
    breakdownEl.appendChild(row);
  });

  suggestionsEl.innerHTML = "";
  if (suggestions && suggestions.length > 0) {
    const title = document.createElement("div");
    title.className = "score-suggestion-label";
    title.textContent = "💡 Suggestions";
    suggestionsEl.appendChild(title);
    suggestions.forEach((s) => {
      const item = document.createElement("div");
      item.className = "score-suggestion-item";
      item.textContent = `• ${s}`;
      suggestionsEl.appendChild(item);
    });
    suggestionsEl.style.display = "flex";
  } else {
    suggestionsEl.style.display = "none";
  }

  panel.style.display = "block";
}

export function hideScore() {
  const panel = document.getElementById("score-panel");
  if (panel) panel.style.display = "none";
}
