// eslint-disable-next-line no-unused-vars
function clearOverlays() {
  const c = document.getElementById('locator-inspector-overlay-container');
  if (c) {
    if (c._cleanup) c._cleanup();
    c.remove();
  }
}
