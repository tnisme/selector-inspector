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

    const inject = () => {
      const target = document.head || document.documentElement;
      if (target) {
        target.appendChild(script);
      } else {
        setTimeout(() => {
          const retryTarget = document.head || document.documentElement;
          if (retryTarget) {
            retryTarget.appendChild(script);
          } else {
            reject(new Error(`Cannot find injection target for ${src}`));
          }
        }, 100);
      }
    };

    if (document.documentElement || document.head) {
      inject();
    } else {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", inject, { once: true });
        setTimeout(() => {
          if (document.documentElement || document.head) {
            inject();
          } else {
            reject(new Error(`DOM not ready for ${src}`));
          }
        }, 1000);
      } else {
        inject();
      }
    }
  });
}

async function injectEngines() {
  try {
    await injectScript("engine/cssEngine.js");
    await injectScript("engine/xpathEngine.js");
    await injectScript("engine/playwrightEngine.js");
    await injectScript("engine/smartLocatorEngine.js");

    await injectScript("engine/injector.js");

    console.log(
      "[Content Script] All engines and injector injected successfully"
    );
  } catch (error) {
    console.error("[Content Script] Failed to inject:", error);
  }
}

injectEngines();
