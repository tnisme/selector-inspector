window.__locatorEngines = window.__locatorEngines || {};
window.__locatorEngines.findBySmartLocator = function findBySmartLocator(
  locator
) {
  if (!locator || !locator.trim()) return [];
  if (locator.match(/[\s>+~]$/)) return [];

  try {
    let elements = [];

    if (
      !locator.includes(":has(") &&
      !locator.includes(":text-is(") &&
      !locator.includes(":has-text(") &&
      !locator.includes(":visible") &&
      !locator.includes(":contains(")
    ) {
      try {
        return Array.from(document.querySelectorAll(locator));
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
          ? Array.from(document.querySelectorAll(baseSelector))
          : Array.from(document.querySelectorAll("*"));
      } catch (error) {
        throw new Error(`Invalid base selector: ${baseSelector}`);
      }

      elements = baseElements.filter((el) => {
        if (hasContent.includes(":has-text(")) {
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
          try {
            return el.querySelector(hasContent) !== null;
          } catch (error) {
            return false;
          }
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
    } else if (locator.includes(":text-is(")) {
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
    } else if (locator.includes(":has-text(")) {
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
    } else {
      try {
        elements = Array.from(document.querySelectorAll(locator));
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
