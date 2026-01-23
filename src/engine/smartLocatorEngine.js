window.__locatorEngines = window.__locatorEngines || {};

/**
 * Detect locator type based on syntax patterns
 */
window.__locatorEngines.detectLocatorType = function detectLocatorType(
  locator
) {
  if (!locator || typeof locator !== "string") return "smart";

  const trimmed = locator.trim();

  // XPath detection: starts with / or // or contains valid XPath patterns
  if (trimmed.startsWith("/") || trimmed.startsWith("(")) {
    return "xpath";
  }

  // Playwright detection
  if (
    trimmed.includes("getByRole(") ||
    trimmed.includes("getByText(") ||
    trimmed.includes("getByTestId(")
  ) {
    return "playwright";
  }

  return "smart"; // Default to smart locator (handles CSS and custom syntax)
};

/**
 * Execute a locator of any type and return elements
 */
window.__locatorEngines.executeLocator = function executeLocator(
  locator,
  context
) {
  try {
    const type = window.__locatorEngines.detectLocatorType(locator);

    switch (type) {
      case "xpath":
        if (!window.__locatorEngines.findByXPath) {
          return { error: "XPath engine not loaded" };
        }
        return window.__locatorEngines.findByXPath(locator, context);
      case "playwright":
        if (!window.__locatorEngines.findByPlaywright) {
          return { error: "Playwright engine not loaded" };
        }
        return window.__locatorEngines.findByPlaywright(locator, context);
      case "smart":
        if (!window.__locatorEngines.findBySmartLocator) {
          return { error: "Smart locator engine not loaded" };
        }
        return window.__locatorEngines.findBySmartLocator(locator, context);
      default:
        if (!window.__locatorEngines.findBySmartLocator) {
          return { error: "Smart locator engine not loaded" };
        }
        return window.__locatorEngines.findBySmartLocator(locator, context);
    }
  } catch (err) {
    return { error: `executeLocator error: ${err.message}` };
  }
};

window.__locatorEngines.findBySmartLocator = function findBySmartLocator(
  locator,
  context
) {
  if (!locator || !locator.trim()) return [];
  if (locator.match(/[\s>+~]$/)) return [];

  if (locator.includes(">>")) {
    let lastOperatorIndex = -1;
    let depth = 0;
    let inQuotes = false;
    let quoteChar = null;

    for (let i = 0; i < locator.length - 1; i++) {
      const char = locator[i];
      const nextChar = locator[i + 1];
      const prevChar = locator[i - 1];

      if ((char === '"' || char === "'") && prevChar !== "\\") {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = null;
        }
      }

      if (!inQuotes) {
        if (char === "(") depth++;
        else if (char === ")") depth--;
      }

      if (!inQuotes && depth === 0 && char === ">" && nextChar === ">") {
        lastOperatorIndex = i;
      }
    }

    if (lastOperatorIndex >= 0) {
      let beforeOperator = locator.substring(0, lastOperatorIndex).trim();
      let afterOperator = locator.substring(lastOperatorIndex + 2).trim();

      beforeOperator = beforeOperator.replace(/\s+$/, "");
      afterOperator = afterOperator.replace(/^\s+/, "");

      if (beforeOperator && afterOperator) {
        // Execute the before locator (supports any type)
        let baseElements;
        try {
          baseElements = window.__locatorEngines.executeLocator(
            beforeOperator,
            context
          );
        } catch (err) {
          // If executeLocator throws, wrap it in an error object
          return {
            error: `Failed to execute '${beforeOperator}': ${err.message}`,
          };
        }

        if (baseElements && baseElements.error) {
          return baseElements;
        }

        if (!Array.isArray(baseElements) || baseElements.length === 0) {
          return [];
        }

        const finalElements = [];
        baseElements.forEach((baseEl, idx) => {
          try {
            // Execute the after locator (supports any type)
            let matched;
            try {
              matched = window.__locatorEngines.executeLocator(
                afterOperator,
                baseEl
              );
            } catch (err) {
              // If executeLocator throws for individual elements, skip it
              return;
            }
            if (matched && !matched.error && Array.isArray(matched)) {
              finalElements.push(...matched);
            }
          } catch (err) {
            // Skip errors for individual elements
          }
        });

        return [...new Set(finalElements)];
      } else {
        return [];
      }
    } else {
      return [];
    }
  }

  let searchRoot = document;
  if (context) {
    if (
      context.nodeType === Node.DOCUMENT_NODE ||
      context.nodeType === Node.ELEMENT_NODE
    ) {
      searchRoot = context;
    } else if (context.querySelectorAll) {
      searchRoot = context;
    }
  }

  try {
    let elements = [];

    const hasCustomPseudo =
      locator.includes(":has(") ||
      locator.includes(":text-is(") ||
      locator.includes(":has-text(") ||
      locator.includes(":visible") ||
      locator.includes(":contains(") ||
      locator.includes(":nth-match(") ||
      locator.includes(":active") ||
      locator.includes(":focus") ||
      locator.includes(":checked") ||
      locator.includes(":disabled") ||
      locator.includes(":enabled") ||
      locator.includes(":first-child") ||
      locator.includes(":last-child") ||
      locator.includes(":only-child") ||
      locator.includes(":nth-child(") ||
      locator.includes(":nth-last-child(") ||
      locator.includes(":not(") ||
      locator.includes(":is(") ||
      locator.includes(":where(");

    if (!hasCustomPseudo) {
      try {
        return Array.from(searchRoot.querySelectorAll(locator));
      } catch (error) {
        throw new Error(
          `Invalid CSS selector: ${locator}. Error: ${error.message}`
        );
      }
    }

    if (locator.includes(":has(")) {
      const hasIndex = locator.indexOf(":has(");
      const baseSelector = locator.substring(0, hasIndex);

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
        throw new Error("Invalid :has() syntax - missing closing parenthesis");
      }

      const hasContent = locator.substring(hasIndex + 5, hasEndIndex);
      const afterSelector = locator.substring(hasEndIndex + 1);

      let baseElements;
      try {
        baseElements = baseSelector
          ? Array.from(searchRoot.querySelectorAll(baseSelector))
          : Array.from(searchRoot.querySelectorAll("*"));
      } catch (error) {
        throw new Error(`Invalid base selector: ${baseSelector}`);
      }

      elements = baseElements.filter((el) => {
        try {
          const matched = window.__locatorEngines.findBySmartLocator(
            hasContent,
            el
          );
          if (matched && matched.error) {
            return false;
          }
          return matched && matched.length > 0;
        } catch (error) {
          try {
            return el.querySelector(hasContent) !== null;
          } catch (err) {
            return false;
          }
        }
      });

      if (afterSelector && afterSelector.trim()) {
        elements = elements.filter((el) => {
          try {
            return el.matches(afterSelector.trim());
          } catch {
            return false;
          }
        });
      }
    } else if (locator.includes(":text-is(")) {
      const textIsMatch = locator.match(/:text-is\((['"])([^'"]+)\1\)/);
      if (textIsMatch) {
        const textIsIndex = locator.indexOf(":text-is(");
        const beforeTextIs = locator.substring(0, textIsIndex);
        const text = textIsMatch[2];
        const textIsEnd = textIsIndex + textIsMatch[0].length;
        const afterTextIs = locator.substring(textIsEnd);

        const baseSelector = beforeTextIs || "*";
        let baseElements;
        try {
          baseElements = Array.from(searchRoot.querySelectorAll(baseSelector));
        } catch (error) {
          throw new Error(`Invalid base selector: ${baseSelector}`);
        }

        elements = baseElements.filter((el) => {
          const textContent = el.textContent && el.textContent.trim();
          return textContent === text;
        });

        if (afterTextIs && afterTextIs.trim()) {
          elements = elements.filter((el) => {
            try {
              const parent = el.parentElement || searchRoot;
              const matched = window.__locatorEngines.findBySmartLocator(
                afterTextIs.trim(),
                parent
              );
              if (matched && !matched.error) {
                return matched.includes(el);
              }
              return el.matches(afterTextIs.trim());
            } catch {
              try {
                return el.matches(afterTextIs.trim());
              } catch {
                return false;
              }
            }
          });
        }
      }
    } else if (locator.includes(":has-text(")) {
      const hasTextMatch = locator.match(/:has-text\((['"])([^'"]+)\1\)/);
      if (hasTextMatch) {
        const hasTextIndex = locator.indexOf(":has-text(");
        const beforeHasText = locator.substring(0, hasTextIndex);
        const text = hasTextMatch[2];
        const hasTextEnd = hasTextIndex + hasTextMatch[0].length;
        const afterSelector = locator.substring(hasTextEnd);
        const baseSelector = beforeHasText || "*";
        let baseElements;
        try {
          baseElements = baseSelector
            ? Array.from(searchRoot.querySelectorAll(baseSelector))
            : Array.from(searchRoot.querySelectorAll("*"));
        } catch (error) {
          throw new Error(`Invalid base selector: ${baseSelector}`);
        }

        elements = baseElements.filter((el) => {
          const textContent = el.textContent && el.textContent.trim();
          return textContent && textContent.includes(text);
        });

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
    } else if (locator.includes(":visible")) {
      const visibleMatch = locator.match(/^([^:]*):visible(.*)$/);
      if (visibleMatch) {
        const [, baseSelector, afterSelector] = visibleMatch;
        let baseElements;
        try {
          baseElements = baseSelector
            ? Array.from(searchRoot.querySelectorAll(baseSelector))
            : Array.from(searchRoot.querySelectorAll("*"));
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
    } else if (locator.includes(":contains(")) {
      const containsMatch = locator.match(/:contains\((['"])([^'"]+)\1\)/);
      if (containsMatch) {
        const containsIndex = locator.indexOf(":contains(");
        const beforeContains = locator.substring(0, containsIndex);
        const text = containsMatch[2];
        const containsEnd = containsIndex + containsMatch[0].length;
        const afterSelector = locator.substring(containsEnd);
        const baseSelector = beforeContains || "*";
        let baseElements;
        try {
          baseElements = baseSelector
            ? Array.from(searchRoot.querySelectorAll(baseSelector))
            : Array.from(searchRoot.querySelectorAll("*"));
        } catch (error) {
          throw new Error(`Invalid base selector: ${baseSelector}`);
        }

        elements = baseElements.filter((el) => {
          const textContent = el.textContent && el.textContent.trim();
          return textContent && textContent.includes(text);
        });

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
    } else if (locator.includes(":nth-match(")) {
      const nthMatchPattern = /:nth-match\(([^,]+),\s*(\d+)\)/;
      const match = locator.match(nthMatchPattern);
      if (match) {
        const beforeNthMatch = locator.substring(
          0,
          locator.indexOf(":nth-match")
        );
        const selector = match[1].trim();
        const n = parseInt(match[2], 10);
        const afterNthMatch = locator.substring(
          locator.indexOf(":nth-match") + match[0].length
        );

        let baseElements;
        try {
          const fullSelector = beforeNthMatch + selector + afterNthMatch;
          baseElements = beforeNthMatch
            ? Array.from(
                searchRoot.querySelectorAll(
                  beforeNthMatch + selector + afterNthMatch
                )
              )
            : Array.from(searchRoot.querySelectorAll(selector + afterNthMatch));
        } catch (error) {
          throw new Error(`Invalid selector in :nth-match: ${error.message}`);
        }

        const parentMap = new Map();
        baseElements.forEach((el) => {
          const parent = el.parentElement;
          if (parent) {
            if (!parentMap.has(parent)) {
              parentMap.set(parent, []);
            }
            parentMap.get(parent).push(el);
          }
        });

        elements = [];
        parentMap.forEach((siblings) => {
          if (n > 0 && n <= siblings.length) {
            elements.push(siblings[n - 1]);
          }
        });
      }
    } else if (locator.includes(":first-child")) {
      const parts = locator.split(":first-child");
      const baseSelector = parts[0] || "*";
      const afterSelector = parts.slice(1).join(":first-child");

      try {
        const allElements = baseSelector
          ? Array.from(document.querySelectorAll(baseSelector))
          : Array.from(document.querySelectorAll("*"));

        elements = allElements.filter((el) => {
          const parent = el.parentElement;
          if (!parent) return false;
          const siblings = Array.from(parent.children);
          return siblings.indexOf(el) === 0;
        });

        if (afterSelector && afterSelector.trim()) {
          elements = elements.filter((el) => {
            try {
              return el.matches(afterSelector.trim());
            } catch {
              return false;
            }
          });
        }
      } catch (error) {
        throw new Error(`Invalid selector: ${error.message}`);
      }
    } else if (locator.includes(":last-child")) {
      const parts = locator.split(":last-child");
      const baseSelector = parts[0] || "*";
      const afterSelector = parts.slice(1).join(":last-child");

      try {
        const allElements = baseSelector
          ? Array.from(document.querySelectorAll(baseSelector))
          : Array.from(document.querySelectorAll("*"));

        elements = allElements.filter((el) => {
          const parent = el.parentElement;
          if (!parent) return false;
          const siblings = Array.from(parent.children);
          return siblings.indexOf(el) === siblings.length - 1;
        });

        if (afterSelector && afterSelector.trim()) {
          elements = elements.filter((el) => {
            try {
              return el.matches(afterSelector.trim());
            } catch {
              return false;
            }
          });
        }
      } catch (error) {
        throw new Error(`Invalid selector: ${error.message}`);
      }
    } else if (locator.includes(":only-child")) {
      const parts = locator.split(":only-child");
      const baseSelector = parts[0] || "*";
      const afterSelector = parts.slice(1).join(":only-child");

      try {
        const allElements = baseSelector
          ? Array.from(document.querySelectorAll(baseSelector))
          : Array.from(document.querySelectorAll("*"));

        elements = allElements.filter((el) => {
          const parent = el.parentElement;
          if (!parent) return false;
          return parent.children.length === 1;
        });

        if (afterSelector && afterSelector.trim()) {
          elements = elements.filter((el) => {
            try {
              return el.matches(afterSelector.trim());
            } catch {
              return false;
            }
          });
        }
      } catch (error) {
        throw new Error(`Invalid selector: ${error.message}`);
      }
    } else if (locator.includes(":nth-child(")) {
      const nthChildMatch = locator.match(/:nth-child\(([^)]+)\)/);
      if (nthChildMatch) {
        const nthValue = nthChildMatch[1].trim();
        const parts = locator.split(/:nth-child\([^)]+\)/);
        const baseSelector = parts[0] || "*";
        const afterSelector = parts[1] || "";

        try {
          const allElements = baseSelector
            ? Array.from(searchRoot.querySelectorAll(baseSelector))
            : Array.from(searchRoot.querySelectorAll("*"));

          elements = allElements.filter((el) => {
            const parent = el.parentElement;
            if (!parent) return false;
            const siblings = Array.from(parent.children);
            const index = siblings.indexOf(el) + 1;

            if (nthValue === "n" || nthValue === "1n") {
              return true;
            } else if (/^\d+$/.test(nthValue)) {
              return index === parseInt(nthValue, 10);
            } else if (/^(\d+)n$/.test(nthValue)) {
              const multiplier = parseInt(nthValue.match(/^(\d+)n$/)[1], 10);
              return index % multiplier === 0;
            } else if (/^(\d+)n\s*\+\s*(\d+)$/.test(nthValue)) {
              const match = nthValue.match(/^(\d+)n\s*\+\s*(\d+)$/);
              const multiplier = parseInt(match[1], 10);
              const offset = parseInt(match[2], 10);
              return (index - offset) % multiplier === 0 && index >= offset;
            } else if (/^(\d+)n\s*-\s*(\d+)$/.test(nthValue)) {
              const match = nthValue.match(/^(\d+)n\s*-\s*(\d+)$/);
              const multiplier = parseInt(match[1], 10);
              const offset = parseInt(match[2], 10);
              return (index + offset) % multiplier === 0 && index >= offset;
            }
            return false;
          });

          if (afterSelector && afterSelector.trim()) {
            elements = elements.filter((el) => {
              try {
                return el.matches(afterSelector.trim());
              } catch {
                return false;
              }
            });
          }
        } catch (error) {
          throw new Error(`Invalid :nth-child selector: ${error.message}`);
        }
      }
    } else if (locator.includes(":nth-last-child(")) {
      const nthLastChildMatch = locator.match(/:nth-last-child\(([^)]+)\)/);
      if (nthLastChildMatch) {
        const nthValue = nthLastChildMatch[1].trim();
        const parts = locator.split(/:nth-last-child\([^)]+\)/);
        const baseSelector = parts[0] || "*";
        const afterSelector = parts[1] || "";

        try {
          const allElements = baseSelector
            ? Array.from(searchRoot.querySelectorAll(baseSelector))
            : Array.from(searchRoot.querySelectorAll("*"));

          elements = allElements.filter((el) => {
            const parent = el.parentElement;
            if (!parent) return false;
            const siblings = Array.from(parent.children);
            const index = siblings.length - siblings.indexOf(el);

            if (nthValue === "n" || nthValue === "1n") {
              return true;
            } else if (/^\d+$/.test(nthValue)) {
              return index === parseInt(nthValue, 10);
            } else if (/^(\d+)n$/.test(nthValue)) {
              const multiplier = parseInt(nthValue.match(/^(\d+)n$/)[1], 10);
              return index % multiplier === 0;
            } else if (/^(\d+)n\s*\+\s*(\d+)$/.test(nthValue)) {
              const match = nthValue.match(/^(\d+)n\s*\+\s*(\d+)$/);
              const multiplier = parseInt(match[1], 10);
              const offset = parseInt(match[2], 10);
              return (index - offset) % multiplier === 0 && index >= offset;
            } else if (/^(\d+)n\s*-\s*(\d+)$/.test(nthValue)) {
              const match = nthValue.match(/^(\d+)n\s*-\s*(\d+)$/);
              const multiplier = parseInt(match[1], 10);
              const offset = parseInt(match[2], 10);
              return (index + offset) % multiplier === 0 && index >= offset;
            }
            return false;
          });

          if (afterSelector && afterSelector.trim()) {
            elements = elements.filter((el) => {
              try {
                return el.matches(afterSelector.trim());
              } catch {
                return false;
              }
            });
          }
        } catch (error) {
          throw new Error(`Invalid :nth-last-child selector: ${error.message}`);
        }
      }
    } else if (locator.includes(":active")) {
      const parts = locator.split(":active");
      const baseSelector = parts[0] || "*";
      const afterSelector = parts.slice(1).join(":active");

      try {
        const allElements = baseSelector
          ? Array.from(document.querySelectorAll(baseSelector))
          : Array.from(document.querySelectorAll("*"));

        elements = allElements.filter((el) => {
          return document.activeElement === el && el.matches(":active");
        });

        if (afterSelector && afterSelector.trim()) {
          elements = elements.filter((el) => {
            try {
              return el.matches(afterSelector.trim());
            } catch {
              return false;
            }
          });
        }
      } catch (error) {
        throw new Error(`Invalid selector: ${error.message}`);
      }
    } else if (locator.includes(":focus")) {
      const parts = locator.split(":focus");
      const baseSelector = parts[0] || "*";
      const afterSelector = parts.slice(1).join(":focus");

      try {
        const allElements = baseSelector
          ? Array.from(document.querySelectorAll(baseSelector))
          : Array.from(document.querySelectorAll("*"));

        elements = allElements.filter((el) => {
          return document.activeElement === el;
        });

        if (afterSelector && afterSelector.trim()) {
          elements = elements.filter((el) => {
            try {
              return el.matches(afterSelector.trim());
            } catch {
              return false;
            }
          });
        }
      } catch (error) {
        throw new Error(`Invalid selector: ${error.message}`);
      }
    } else if (locator.includes(":checked")) {
      const parts = locator.split(":checked");
      const baseSelector = parts[0] || "*";
      const afterSelector = parts.slice(1).join(":checked");

      try {
        const allElements = baseSelector
          ? Array.from(document.querySelectorAll(baseSelector))
          : Array.from(document.querySelectorAll("*"));

        elements = allElements.filter((el) => {
          return (
            (el.type === "checkbox" && el.checked) ||
            (el.type === "radio" && el.checked) ||
            el.hasAttribute("checked")
          );
        });

        if (afterSelector && afterSelector.trim()) {
          elements = elements.filter((el) => {
            try {
              return el.matches(afterSelector.trim());
            } catch {
              return false;
            }
          });
        }
      } catch (error) {
        throw new Error(`Invalid selector: ${error.message}`);
      }
    } else if (locator.includes(":disabled")) {
      const parts = locator.split(":disabled");
      const baseSelector = parts[0] || "*";
      const afterSelector = parts.slice(1).join(":disabled");

      try {
        const allElements = baseSelector
          ? Array.from(document.querySelectorAll(baseSelector))
          : Array.from(document.querySelectorAll("*"));

        elements = allElements.filter((el) => {
          return el.disabled === true || el.hasAttribute("disabled");
        });

        if (afterSelector && afterSelector.trim()) {
          elements = elements.filter((el) => {
            try {
              return el.matches(afterSelector.trim());
            } catch {
              return false;
            }
          });
        }
      } catch (error) {
        throw new Error(`Invalid selector: ${error.message}`);
      }
    } else if (locator.includes(":enabled")) {
      const parts = locator.split(":enabled");
      const baseSelector = parts[0] || "*";
      const afterSelector = parts.slice(1).join(":enabled");

      try {
        const allElements = baseSelector
          ? Array.from(document.querySelectorAll(baseSelector))
          : Array.from(document.querySelectorAll("*"));

        elements = allElements.filter((el) => {
          return el.disabled !== true && !el.hasAttribute("disabled");
        });

        if (afterSelector && afterSelector.trim()) {
          elements = elements.filter((el) => {
            try {
              return el.matches(afterSelector.trim());
            } catch {
              return false;
            }
          });
        }
      } catch (error) {
        throw new Error(`Invalid selector: ${error.message}`);
      }
    } else if (locator.includes(":not(")) {
      const notIndex = locator.indexOf(":not(");
      let depth = 0;
      let notEndIndex = -1;
      for (let i = notIndex + 5; i < locator.length; i++) {
        if (locator[i] === "(") depth++;
        else if (locator[i] === ")") {
          if (depth === 0) {
            notEndIndex = i;
            break;
          }
          depth--;
        }
      }

      if (notEndIndex === -1) {
        throw new Error("Invalid :not() syntax - missing closing parenthesis");
      }

      const notSelector = locator.substring(notIndex + 5, notEndIndex);
      const parts = locator.split(/:not\([^)]+\)/);
      const beforeNot = locator.substring(0, notIndex);
      const afterNot = locator.substring(notEndIndex + 1);

      let baseSelector = beforeNot || "*";
      const afterSelector = afterNot || "";

      try {
        try {
          return Array.from(searchRoot.querySelectorAll(locator));
        } catch (nativeError) {
          // Native failed, use custom logic
        }

        const allElements = baseSelector
          ? Array.from(searchRoot.querySelectorAll(baseSelector))
          : Array.from(searchRoot.querySelectorAll("*"));

        elements = allElements.filter((el) => {
          try {
            const parent = el.parentElement || searchRoot;
            const matched = window.__locatorEngines.findBySmartLocator(
              notSelector,
              parent
            );
            if (matched && matched.error) {
              return true;
            }
            const elementMatches =
              matched && matched.length > 0 && matched.includes(el);
            return !elementMatches;
          } catch (err) {
            try {
              return !el.matches(notSelector);
            } catch {
              return true;
            }
          }
        });

        if (afterSelector && afterSelector.trim()) {
          elements = elements.filter((el) => {
            try {
              return el.matches(afterSelector.trim());
            } catch {
              return false;
            }
          });
        }
      } catch (err) {
        throw new Error(`Invalid :not selector: ${err.message}`);
      }
    } else if (locator.includes(":is(") || locator.includes(":where(")) {
      try {
        return Array.from(searchRoot.querySelectorAll(locator));
      } catch (error) {
        const isWhereMatch = locator.match(/:(is|where)\(([^)]+)\)/);
        if (isWhereMatch) {
          const selectors = isWhereMatch[2].split(",").map((s) => s.trim());
          const parts = locator.split(/:(is|where)\([^)]+\)/);
          const baseSelector = parts[0] || "";
          const afterSelector = parts[2] || "";

          elements = [];
          selectors.forEach((sel) => {
            try {
              const fullSelector = baseSelector + sel + afterSelector;
              const matched = Array.from(
                searchRoot.querySelectorAll(fullSelector)
              );
              elements.push(...matched);
            } catch (err) {
              // Skip invalid selector
            }
          });

          elements = [...new Set(elements)];
        }
      }
    } else {
      try {
        elements = Array.from(searchRoot.querySelectorAll(locator));
      } catch (error) {
        throw new Error(
          `Invalid CSS selector: ${locator}. Error: ${error.message}`
        );
      }
    }

    return elements;
  } catch (error) {
    return {
      error: `Smart locator error: ${error.message}`,
    };
  }
};

console.log(
  "[Smart Locator Engine] Loaded - window.__locatorEngines.findBySmartLocator available:",
  typeof window.__locatorEngines.findBySmartLocator
);
