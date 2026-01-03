// This content script injects the locator engines into the page's main world
// so they can be accessed from the page context

console.log("[Content Script] Loaded - about to inject engines");

function injectScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL(src);
    script.onload = () => {
      script.remove();
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`Failed to inject ${src}`));
    };
    (document.head || document.documentElement).appendChild(script);
  });
}

async function injectEngines() {
  try {
    // Inject engines first
    await injectScript("engine/cssEngine.js");
    await injectScript("engine/xpathEngine.js");
    await injectScript("engine/playwrightEngine.js");
    await injectScript("engine/smartLocatorEngine.js");

    // Then inject injector which depends on engines
    await injectScript("engine/injector.js");

    console.log(
      "[Content Script] All engines and injector injected successfully"
    );
  } catch (error) {
    console.error("[Content Script] Failed to inject:", error);
  }
}

// Start injection as soon as possible
injectEngines();
