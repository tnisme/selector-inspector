function buildInspectResult(elements) {
  let details = "";

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
    details,
    error: null,
  };
}
