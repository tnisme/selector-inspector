// eslint-disable-next-line no-unused-vars
function renderOverlays(elements) {
  if (!elements || elements.length === 0) return;

  const overlayContainer = document.createElement('div');
  overlayContainer.id = 'locator-inspector-overlay-container';
  overlayContainer.className = 'locator-inspector-container';
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

  const highlightData = [];

  elements.forEach((element, index) => {
    if (!element) return;

    const highlight = document.createElement('div');
    highlight.className = 'locator-inspector-highlight';
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

    const badge = document.createElement('div');
    badge.textContent = index + 1;
    badge.className = 'locator-inspector-badge';
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

    highlightData.push({
      element,
      highlight,
    });
  });

  function updateHighlightPositions() {
    highlightData.forEach((data) => {
      if (
        data.element &&
        data.highlight &&
        document.body.contains(data.element)
      ) {
        const rect = data.element.getBoundingClientRect();
        data.highlight.style.top = rect.top + 'px';
        data.highlight.style.left = rect.left + 'px';
        data.highlight.style.width = rect.width + 'px';
        data.highlight.style.height = rect.height + 'px';
      }
    });
  }

  updateHighlightPositions();

  const scrollHandler = () => updateHighlightPositions();
  window.addEventListener('scroll', scrollHandler, { passive: true });

  overlayContainer._cleanup = () => {
    window.removeEventListener('scroll', scrollHandler);
  };

  if (!document.getElementById('locator-inspector-styles')) {
    const style = document.createElement('style');
    style.id = 'locator-inspector-styles';
    style.textContent = `
      @keyframes locatorPulse {
        0% { opacity: 1; }
        50% { opacity: 0.7; }
        100% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => {
    const container = document.getElementById(
      'locator-inspector-overlay-container'
    );
    if (container) {
      if (container._cleanup) container._cleanup();
      container.remove();
    }
    const styles = document.getElementById('locator-inspector-styles');
    if (styles) styles.remove();
  }, 5000);
}
