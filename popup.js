document.addEventListener("DOMContentLoaded", function () {
  // Sequence id to track latest inspection request and ignore stale results
  let _locatorRequestSeq = 0;
  const typeSelect = document.getElementById("type");
  const locatorInput = document.getElementById("locator");
  const inspectBtn = document.getElementById("inspectBtn");
  const resultDiv = document.getElementById("result");
  const examplesDiv = document.getElementById("examples");

  // Load saved values
  chrome.storage.local.get(["locatorType", "locatorValue"], function (result) {
    if (result.locatorType) {
      typeSelect.value = result.locatorType;
    }
    if (result.locatorValue) {
      locatorInput.value = result.locatorValue;
    }
    updatePlaceholder();
  });

  // Save values on change
  typeSelect.addEventListener("change", function () {
    chrome.storage.local.set({ locatorType: typeSelect.value });
    updatePlaceholder();

    // Perform immediate inspection if there's a locator
    if (locatorInput.value.trim()) {
      performLiveInspection();
    }
  });

  locatorInput.addEventListener("input", function () {
    chrome.storage.local.set({ locatorValue: locatorInput.value });

    // Clear previous timeout
    if (window.inspectionTimeout) {
      clearTimeout(window.inspectionTimeout);
    }

    // Debounce live inspection (wait 500ms after user stops typing)
    window.inspectionTimeout = setTimeout(() => {
      performLiveInspection();
    }, 500);
  });

  // Also trigger on locator type change
  typeSelect.addEventListener("change", function () {
    chrome.storage.local.set({ locatorType: typeSelect.value });
    updatePlaceholder();

    // Perform immediate inspection if there's a locator
    if (locatorInput.value.trim()) {
      performLiveInspection();
    }
  });

  async function performLiveInspection() {
    const locator = locatorInput.value.trim();
    const type = typeSelect.value;

    // Clear previous results if locator is empty
    if (!locator) {
      hideResult();
      // Clear any existing overlays
      try {
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        const activeTab = tabs[0];
        if (activeTab) {
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: clearOverlays,
            world: "MAIN",
          });
        }
      } catch (error) {
        // Ignore errors when clearing
      }
      return;
    }

    try {
      showLoading("Live inspecting...");

      // Get the active tab
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const activeTab = tabs[0];

      if (!activeTab) {
        throw new Error("No active tab found");
      }

      // New request id for this invocation
      _locatorRequestSeq += 1;
      const thisRequestId = _locatorRequestSeq;

      // Set the request id in the page (engine and injector are preloaded as content scripts)
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: (id) => {
          if (typeof window.__locatorInspect === "function") {
            window.__locatorInspect.__lastRequestId = id;
          }
        },
        args: [thisRequestId],
        world: "MAIN",
      });

      // Call the injected inspector in the page context and pass the request id
      // Wrap the call in try/catch inside the page so we always get a structured result
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: (locator, type, reqId) => {
          try {
            const res = window.__locatorInspect(locator, type, reqId);
            return { ok: true, value: res };
          } catch (e) {
            return { ok: false, error: String(e), stack: e && e.stack };
          }
        },
        args: [locator, type, thisRequestId],
        world: "MAIN",
      });

      const pageResp = results && results[0] && results[0].result;

      // Ignore stale results: only act on the latest request
      if (thisRequestId !== _locatorRequestSeq) {
        // A newer request started — ignore this result
        return;
      }

      if (!pageResp) {
        showResult("No result from page", "error");
        return;
      }

      if (!pageResp.ok) {
        // Page-side function threw — surface the error
        console.error("Page inspector error:", pageResp.error, pageResp.stack);
        showResult(`Page error: ${pageResp.error}`, "error");
        return;
      }

      const result = pageResp.value;

      if (!result) {
        showResult("Inspector returned no data", "error");
        return;
      }

      if (result.error) {
        showResult(`Error: ${result.error}`, "error");
      } else if (result.count === 0) {
        showResult("No elements found", "error");
      } else {
        let message = `Found ${result.count} element${
          result.count > 1 ? "s" : ""
        } found`;
        if (result.details) {
          message += "\n\nElements:\n" + result.details;
        }
        showResult(message, "success");
      }
    } catch (error) {
      console.error("Live inspection error:", error);
      showResult(`Error: ${error.message}`, "error");
    }
  }

  function updatePlaceholder() {
    const type = typeSelect.value;

    switch (type) {
      case "css":
        locatorInput.placeholder =
          'Enter CSS selector (e.g., .button, #myId, [data-test="submit"])';
        break;
      case "xpath":
        locatorInput.placeholder =
          'Enter XPath expression (e.g., //div[@class="button"])';
        break;
      case "playwright":
        locatorInput.placeholder =
          'Enter Playwright locator (e.g., getByRole("button"))';
        break;
      case "smart":
        locatorInput.placeholder =
          'Enter smart locator (e.g., div + p, .item > span, div:has-text("contains"), span:text-is("exact"))';
        break;
    }
  }

  function showResult(message, type = "info") {
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

  inspectBtn.addEventListener("click", async function () {
    // Force immediate inspection (bypass debounce)
    await performLiveInspection();
  });

  // Handle keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      performLiveInspection();
    }
  });

  // Initialize placeholder and perform live inspection if locator exists
  updatePlaceholder();

  // Perform initial inspection if there's a saved locator
  if (locatorInput.value && locatorInput.value.trim()) {
    setTimeout(() => performLiveInspection(), 100);
  }
});

// Function to clear existing overlays
function clearOverlays() {
  const container = document.getElementById(
    "locator-inspector-overlay-container"
  );
  if (container) {
    // Clean up event listeners before removing
    if (container._cleanup) {
      container._cleanup();
    }
    container.remove();
  }
}

// This function will be injected into the page
function inspectLocator(locator, type) {
  try {
    // Clear any existing overlays first
    const existingContainer = document.getElementById(
      "locator-inspector-overlay-container"
    );
    if (existingContainer) {
      existingContainer.remove();
    }

    let elements = [];
    let details = "";

    switch (type) {
      case "css":
        findByCss(locator).forEach((el) => elements.push(el));
        break;

      case "xpath":
        findByXPath(locator).forEach((el) => elements.push(el));
        break;

      case "playwright":
        // For playwright, we'll provide basic support for common methods
        findByPlaywright(locator).forEach((el) => elements.push(el));
        break;

      case "smart":
        // Parse smart locator with pseudo-selectors
        try {
          findBySmartLocator(locator).forEach((el) => elements.push(el));
        } catch (error) {
          return { error: `Smart locator error: ${error.message}` };
        }
        break;

      default:
        return { error: "Unknown locator type" };
    }

    // Remove duplicates
    elements = [...new Set(elements)];

    // Create overlay masks with dynamic positioning
    const overlayContainer = document.createElement("div");
    overlayContainer.id = "locator-inspector-overlay-container";
    overlayContainer.className = "locator-inspector-container";
    overlayContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2147483646;
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
    `;
    document.body.appendChild(overlayContainer);

    // Store element references for dynamic positioning
    const highlightData = [];

    elements.forEach((element, index) => {
      if (element) {
        // Create highlight overlay
        const highlight = document.createElement("div");
        highlight.className = "locator-inspector-highlight";
        highlight.style.cssText = `
          position: fixed;
          border: 3px solid #ff6b6b;
          background: rgba(255, 107, 107, 0.1);
          pointer-events: none;
          z-index: 2147483647;
          box-sizing: border-box;
          animation: locatorPulse 2s infinite;
          margin: 0;
          padding: 0;
          transition: opacity 0.2s ease;
        `;

        // Create numbered badge
        const badge = document.createElement("div");
        badge.textContent = index + 1;
        badge.className = "locator-inspector-badge";
        badge.style.cssText = `
          position: absolute;
          top: -12px;
          right: -12px;
          background: #ff6b6b;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          margin: 0;
          padding: 0;
        `;

        highlight.appendChild(badge);
        overlayContainer.appendChild(highlight);

        // Store reference for dynamic updates
        highlightData.push({
          element: element,
          highlight: highlight,
          index: index,
        });
      }
    });

    // Simple function to update highlight positions on browser scroll only
    function updateHighlightPositions() {
      if (!highlightData || highlightData.length === 0) return;

      highlightData.forEach((data, index) => {
        if (
          data.element &&
          data.highlight &&
          document.body.contains(data.element)
        ) {
          const rect = data.element.getBoundingClientRect();

          // Use fixed positioning relative to viewport (no scroll offsets needed)
          data.highlight.style.top = rect.top + "px";
          data.highlight.style.left = rect.left + "px";
          data.highlight.style.width = rect.width + "px";
          data.highlight.style.height = rect.height + "px";
        }
      });
    }

    // Initial positioning
    updateHighlightPositions();

    // Add simple browser scroll listener only (no complex scrollable element detection)
    const scrollHandler = () => updateHighlightPositions();
    window.addEventListener("scroll", scrollHandler, { passive: true });

    // Update cleanup to remove scroll listener
    overlayContainer._cleanup = () => {
      window.removeEventListener("scroll", scrollHandler);
    };

    // Add CSS animation for pulse effect
    if (!document.getElementById("locator-inspector-styles")) {
      const style = document.createElement("style");
      style.id = "locator-inspector-styles";
      style.textContent = `
        @keyframes locatorPulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    // Remove overlays after 5 seconds
    setTimeout(() => {
      const container = document.getElementById(
        "locator-inspector-overlay-container"
      );
      if (container) {
        // Clean up event listeners
        if (container._cleanup) {
          container._cleanup();
        }
        container.remove();
      }
      const styles = document.getElementById("locator-inspector-styles");
      if (styles) {
        styles.remove();
      }
    }, 5000);

    // Generate detailed information about found elements
    if (elements.length > 0) {
      details = elements
        .slice(0, 5)
        .map((el, index) => {
          const tagName = el.tagName.toLowerCase();
          const className = el.className
            ? ` class="${el.className.split(" ").slice(0, 2).join(" ")}"`
            : "";
          const id = el.id ? ` id="${el.id}"` : "";
          const text = el.textContent
            ? el.textContent.trim().substring(0, 40)
            : "";
          const attributes = [];

          // Get some useful attributes
          ["type", "name", "value", "href", "src"].forEach((attr) => {
            if (el.hasAttribute(attr)) {
              const value = el.getAttribute(attr).substring(0, 30);
              attributes.push(`${attr}="${value}"`);
            }
          });

          let result = `${index + 1}. <${tagName}${id}${className}`;
          if (attributes.length > 0) {
            result += ` ${attributes.slice(0, 2).join(" ")}`;
          }
          result += ">";

          if (text && text !== el.innerHTML.trim()) {
            result += `\n   Text: "${text}${text.length >= 40 ? "..." : ""}"`;
          }

          return result;
        })
        .join("\n\n");

      if (elements.length > 5) {
        details += `\n\n... and ${elements.length - 5} more elements`;
      }
    }

    return {
      count: elements.length,
      details: details,
      error: null,
    };
  } catch (error) {
    return {
      count: 0,
      error: error.message,
    };
  }
}
