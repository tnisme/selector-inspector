window.__locatorEngines = window.__locatorEngines || {};
window.__locatorEngines.findByPlaywright = function findByPlaywright(selector) {
  let elements = [];
  if (selector.includes("getByRole")) {
    const roleMatch = selector.match(/getByRole\(['\"]([^'\"]+)['\"]\)/);
    if (roleMatch) {
      const role = roleMatch[1];
      elements = Array.from(document.querySelectorAll(`[role="${role}"]`));
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
  } else if (selector.includes("getByText")) {
    const textMatch = selector.match(/getByText\(['\"]([^'\"]+)['\"]\)/);
    if (textMatch) {
      const text = textMatch[1];
      elements = Array.from(document.querySelectorAll("*")).filter((el) => {
        const textContent = el.textContent && el.textContent.trim();
        const hasChildren =
          el.children.length === 0 ||
          Array.from(el.children).every(
            (child) =>
              !child.textContent || !child.textContent.trim().includes(text)
          );
        return textContent && textContent.includes(text) && hasChildren;
      });
    }
  } else if (selector.includes("getByTestId")) {
    const testIdMatch = selector.match(/getByTestId\(['\"]([^'\"]+)['\"]\)/);
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
  return elements;
};

console.log(
  "[Playwright Engine] Loaded - window.__locatorEngines.findByPlaywright available:",
  typeof window.__locatorEngines.findByPlaywright
);
