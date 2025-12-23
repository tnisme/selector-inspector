document.addEventListener("DOMContentLoaded", function () {
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

      // Inject content script and execute inspection
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: inspectLocator,
        args: [locator, type],
      });

      const result = results[0].result;

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
        elements = Array.from(document.querySelectorAll(locator));
        break;

      case "xpath":
        const xpathResult = document.evaluate(
          locator,
          document,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        );
        for (let i = 0; i < xpathResult.snapshotLength; i++) {
          elements.push(xpathResult.snapshotItem(i));
        }
        break;

      case "playwright":
        // For playwright, we'll provide basic support for common methods
        if (locator.includes("getByRole")) {
          const roleMatch = locator.match(/getByRole\(['"]([^'"]+)['"]\)/);
          if (roleMatch) {
            const role = roleMatch[1];
            elements = Array.from(
              document.querySelectorAll(`[role="${role}"]`)
            );
            // Also check for implicit roles
            if (role === "button") {
              elements.push(
                ...Array.from(
                  document.querySelectorAll(
                    'button, input[type="button"], input[type="submit"]'
                  )
                )
              );
            } else if (role === "textbox") {
              elements.push(
                ...Array.from(
                  document.querySelectorAll(
                    'input[type="text"], input[type="email"], input[type="password"], textarea'
                  )
                )
              );
            }
          }
        } else if (locator.includes("getByText")) {
          const textMatch = locator.match(/getByText\(['"]([^'"]+)['"]\)/);
          if (textMatch) {
            const text = textMatch[1];
            elements = Array.from(document.querySelectorAll("*")).filter(
              (el) => {
                const textContent = el.textContent && el.textContent.trim();
                const hasChildren =
                  el.children.length === 0 ||
                  Array.from(el.children).every(
                    (child) =>
                      !child.textContent ||
                      !child.textContent.trim().includes(text)
                  );
                return textContent && textContent.includes(text) && hasChildren;
              }
            );
          }
        } else if (locator.includes("getByTestId")) {
          const testIdMatch = locator.match(/getByTestId\(['"]([^'"]+)['"]\)/);
          if (testIdMatch) {
            const testId = testIdMatch[1];
            elements = Array.from(
              document.querySelectorAll(
                `[data-testid="${testId}"], [data-test-id="${testId}"], [data-cy="${testId}"]`
              )
            );
          }
        } else {
          return {
            error:
              "Unsupported Playwright locator format. Supported: getByRole(), getByText(), getByTestId()",
          };
        }
        break;

      case "smart":
        // Parse smart locator with pseudo-selectors
        try {
          elements = parseSmartLocator(locator);
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

    // Function to parse smart locators with custom pseudo-selectors
    function parseSmartLocator(locator) {
      let elements = [];

      // Handle :has() pseudo-selector with nested conditions
      if (locator.includes(":has(")) {
        // More robust parsing for :has() with complex base selectors
        const hasIndex = locator.indexOf(":has(");
        const baseSelector = locator.substring(0, hasIndex);

        // Find the matching closing parenthesis
        let depth = 0;
        let hasEndIndex = -1;
        for (let i = hasIndex + 5; i < locator.length; i++) {
          if (locator[i] === "(") depth++;
          else if (locator[i] === ")") {
            if (depth === 0) {
              hasEndIndex = i;
              break;
            }
            depth--;
          }
        }

        if (hasEndIndex === -1) {
          throw new Error(
            "Invalid :has() syntax - missing closing parenthesis"
          );
        }

        const hasContent = locator.substring(hasIndex + 5, hasEndIndex);
        const afterSelector = locator.substring(hasEndIndex + 1);

        // Get base elements - handle CSS combinators properly
        let baseElements;
        try {
          baseElements = baseSelector
            ? Array.from(document.querySelectorAll(baseSelector))
            : Array.from(document.querySelectorAll("*"));
        } catch (error) {
          throw new Error(`Invalid base selector: ${baseSelector}`);
        }

        elements = baseElements.filter((el) => {
          // Parse the content inside :has()
          if (hasContent.includes(":has-text(")) {
            // Handle nested :has-text() inside :has()
            const hasTextMatch = hasContent.match(
              /^([^:]*):has-text\(['"]([^'"]+)['"]\)(.*)$/
            );
            if (hasTextMatch) {
              const [, innerSelector, text, innerAfter] = hasTextMatch;
              let innerElements;
              try {
                innerElements = innerSelector
                  ? Array.from(el.querySelectorAll(innerSelector))
                  : Array.from(el.querySelectorAll("*"));
              } catch (error) {
                return false;
              }

              return innerElements.some((innerEl) => {
                const textContent =
                  innerEl.textContent && innerEl.textContent.trim();
                let matchesText = textContent && textContent.includes(text);

                // Apply additional conditions after :has-text()
                if (matchesText && innerAfter && innerAfter.trim()) {
                  try {
                    matchesText = innerEl.matches(innerAfter.trim());
                  } catch {
                    matchesText = false;
                  }
                }
                return matchesText;
              });
            }
          } else if (hasContent.includes(":text-is(")) {
            // Handle nested :text-is() inside :has()
            const textIsMatch = hasContent.match(
              /^([^:]*):text-is\(['"]([^'"]+)['"]\)(.*)$/
            );
            if (textIsMatch) {
              const [, innerSelector, text, innerAfter] = textIsMatch;
              let innerElements;
              try {
                innerElements = innerSelector
                  ? Array.from(el.querySelectorAll(innerSelector))
                  : Array.from(el.querySelectorAll("*"));
              } catch (error) {
                return false;
              }

              return innerElements.some((innerEl) => {
                const textContent =
                  innerEl.textContent && innerEl.textContent.trim();
                let matchesText = textContent === text;

                // Apply additional conditions after :text-is()
                if (matchesText && innerAfter && innerAfter.trim()) {
                  try {
                    matchesText = innerEl.matches(innerAfter.trim());
                  } catch {
                    matchesText = false;
                  }
                }
                return matchesText;
              });
            }
          } else if (hasContent.includes(":visible")) {
            // Handle :visible inside :has()
            const visibleMatch = hasContent.match(/^([^:]*):visible(.*)$/);
            if (visibleMatch) {
              const [, innerSelector, innerAfter] = visibleMatch;
              let innerElements;
              try {
                innerElements = innerSelector
                  ? Array.from(el.querySelectorAll(innerSelector))
                  : Array.from(el.querySelectorAll("*"));
              } catch (error) {
                return false;
              }

              return innerElements.some((innerEl) => {
                const style = window.getComputedStyle(innerEl);
                let isVisible =
                  style.display !== "none" &&
                  style.visibility !== "hidden" &&
                  style.opacity !== "0" &&
                  innerEl.offsetHeight > 0 &&
                  innerEl.offsetWidth > 0;

                // Apply additional conditions after :visible
                if (isVisible && innerAfter && innerAfter.trim()) {
                  try {
                    isVisible = innerEl.matches(innerAfter.trim());
                  } catch {
                    isVisible = false;
                  }
                }
                return isVisible;
              });
            }
          } else {
            // Handle regular CSS selector inside :has() - including combinators
            try {
              return el.querySelector(hasContent) !== null;
            } catch (error) {
              return false;
            }
          }
          return false;
        });

        // Apply additional selectors after :has()
        if (afterSelector && afterSelector.trim()) {
          elements = elements.filter((el) => {
            try {
              return el.matches(afterSelector.trim());
            } catch {
              return false;
            }
          });
        }
      }
      // Handle :text-is() pseudo-selector for exact text matching
      else if (locator.includes(":text-is(")) {
        const textIsMatch = locator.match(
          /^([^:]*):text-is\(['"']([^'"']+)['"']\)(.*)$/
        );
        if (textIsMatch) {
          const [, baseSelector, text, afterSelector] = textIsMatch;
          let baseElements;
          try {
            baseElements = baseSelector
              ? Array.from(document.querySelectorAll(baseSelector))
              : Array.from(document.querySelectorAll("*"));
          } catch (error) {
            throw new Error(`Invalid base selector: ${baseSelector}`);
          }

          elements = baseElements.filter((el) => {
            const textContent = el.textContent && el.textContent.trim();
            return textContent === text;
          });

          // Apply additional selectors after :text-is()
          if (afterSelector && afterSelector.trim()) {
            elements = elements.filter((el) => {
              try {
                return el.matches(afterSelector.trim());
              } catch {
                return false;
              }
            });
          }
        }
      }
      // Handle :has-text() pseudo-selector
      else if (locator.includes(":has-text(")) {
        const hasTextMatch = locator.match(
          /^([^:]*):has-text\(['"]([^'"]+)['"]\)(.*)$/
        );
        if (hasTextMatch) {
          const [, baseSelector, text, afterSelector] = hasTextMatch;
          let baseElements;
          try {
            baseElements = baseSelector
              ? Array.from(document.querySelectorAll(baseSelector))
              : Array.from(document.querySelectorAll("*"));
          } catch (error) {
            throw new Error(`Invalid base selector: ${baseSelector}`);
          }

          elements = baseElements.filter((el) => {
            const textContent = el.textContent && el.textContent.trim();
            return textContent && textContent.includes(text);
          });

          // Apply additional selectors after :has-text()
          if (afterSelector && afterSelector.trim()) {
            elements = elements.filter((el) => {
              try {
                return el.matches(afterSelector.trim());
              } catch {
                return false;
              }
            });
          }
        }
      }
      // Handle :visible pseudo-selector
      else if (locator.includes(":visible")) {
        const visibleMatch = locator.match(/^([^:]*):visible(.*)$/);
        if (visibleMatch) {
          const [, baseSelector, afterSelector] = visibleMatch;
          let baseElements;
          try {
            baseElements = baseSelector
              ? Array.from(document.querySelectorAll(baseSelector))
              : Array.from(document.querySelectorAll("*"));
          } catch (error) {
            throw new Error(`Invalid base selector: ${baseSelector}`);
          }

          elements = baseElements.filter((el) => {
            const style = window.getComputedStyle(el);
            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              style.opacity !== "0" &&
              el.offsetHeight > 0 &&
              el.offsetWidth > 0
            );
          });

          // Apply additional selectors after :visible
          if (afterSelector && afterSelector.trim()) {
            elements = elements.filter((el) => {
              try {
                return el.matches(afterSelector.trim());
              } catch {
                return false;
              }
            });
          }
        }
      }
      // Handle :contains() pseudo-selector (alias for :has-text())
      else if (locator.includes(":contains(")) {
        const containsMatch = locator.match(
          /^([^:]*):contains\(['"]([^'"]+)['"]\)(.*)$/
        );
        if (containsMatch) {
          const [, baseSelector, text, afterSelector] = containsMatch;
          let baseElements;
          try {
            baseElements = baseSelector
              ? Array.from(document.querySelectorAll(baseSelector))
              : Array.from(document.querySelectorAll("*"));
          } catch (error) {
            throw new Error(`Invalid base selector: ${baseSelector}`);
          }

          elements = baseElements.filter((el) => {
            const textContent = el.textContent && el.textContent.trim();
            return textContent && textContent.includes(text);
          });

          // Apply additional selectors after :contains()
          if (afterSelector && afterSelector.trim()) {
            elements = elements.filter((el) => {
              try {
                return el.matches(afterSelector.trim());
              } catch {
                return false;
              }
            });
          }
        }
      }
      // Handle regular CSS selectors with combinators or fallback
      else {
        // Try to parse as regular CSS first - this handles all CSS combinators
        try {
          elements = Array.from(document.querySelectorAll(locator));
        } catch (error) {
          throw new Error(
            `Invalid CSS selector: ${locator}. Error: ${error.message}`
          );
        }
      }

      return elements;
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
