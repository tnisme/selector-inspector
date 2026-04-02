window.__locatorEngines = window.__locatorEngines || {};
window.__locatorEngines.findByPlaywright = function findByPlaywright(
  selector,
  context
) {
  let elements = [];
  // Use context if provided, otherwise use document
  const searchRoot = context || document;

  if (selector.includes("getByRole")) {
    const roleMatch = selector.match(/getByRole\(['\"]([^'\"]+)['\"]\)/);
    if (roleMatch) {
      const role = roleMatch[1];
      elements = window.__locatorEngines.querySelectorAllDeep(`[role="${role}"]`, searchRoot);
      if (role === "button") {
        elements.push(
          ...window.__locatorEngines.querySelectorAllDeep(
            'button, input[type="button"], input[type="submit"]',
            searchRoot
          )
        );
      } else if (role === "textbox") {
        elements.push(
          ...window.__locatorEngines.querySelectorAllDeep(
            'input[type="text"], input[type="email"], input[type="password"], textarea',
            searchRoot
          )
        );
      }
    }
  } else if (selector.includes("getByText")) {
    const textMatch = selector.match(/getByText\(['\"]([^'\"]+)['\"]\)/);
    if (textMatch) {
      const text = textMatch[1];
      const allElements = window.__locatorEngines.querySelectorAllDeep("*", searchRoot);
      elements = allElements.filter((el) => {
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
      elements = window.__locatorEngines.querySelectorAllDeep(
        `[data-testid="${testId}"], [data-test-id="${testId}"], [data-cy="${testId}"]`,
        searchRoot
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
