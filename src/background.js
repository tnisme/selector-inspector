const activeTabs = new Set();

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({
    windowId: tab.windowId,
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    const activeTab = tabs[0];
    if (!activeTab) {
      sendResponse({ success: false });
      return;
    }

    if (message.type === "panel-opened") {
      activeTabs.add(activeTab.id);
      injectContentScript(activeTab.id).catch(console.error);
    } else if (message.type === "panel-closed") {
      activeTabs.delete(activeTab.id);
      cleanupTab(activeTab.id).catch(console.error);
    }
    sendResponse({ success: true });
  });
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" && activeTabs.has(tabId)) {
    await cleanupTab(tabId);
    activeTabs.delete(tabId);
  }
});

async function injectContentScript(tabId) {
  try {
    const results = await chrome.scripting
      .executeScript({
        target: { tabId },
        func: () => typeof window.__locatorInspect,
        world: "MAIN",
      })
      .catch(() => null);

    if (results?.[0]?.result !== "function") {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [
            "src/engine/cssEngine.js",
            "src/engine/xpathEngine.js",
            "src/engine/playwrightEngine.js",
            "src/engine/smartLocatorEngine.js",
            "src/engine/injector.js",
          ],
          world: "MAIN",
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        const verifyResults = await chrome.scripting
          .executeScript({
            target: { tabId },
            func: () => {
              return {
                hasInspect: typeof window.__locatorInspect === "function",
                hasEngines: typeof window.__locatorEngines === "object",
                engineKeys: window.__locatorEngines
                  ? Object.keys(window.__locatorEngines)
                  : [],
              };
            },
            world: "MAIN",
          })
          .catch(() => null);

        if (verifyResults?.[0]?.result) {
          const verify = verifyResults[0].result;
          if (!verify.hasInspect) {
            console.error(
              "Failed to inject __locatorInspect. Engines available:",
              verify.engineKeys
            );
          }
        }

        await chrome.scripting
          .executeScript({
            target: { tabId },
            func: () => {
              if (window.__locatorInspect) {
                window.__locatorInspect.__active = true;
              }
            },
            world: "MAIN",
          })
          .catch(() => {});
      } catch (error) {
        console.error("Error injecting content scripts:", error);
      }
    } else {
      await chrome.scripting
        .executeScript({
          target: { tabId },
          func: () => {
            if (window.__locatorInspect) {
              window.__locatorInspect.__active = true;
            }
          },
          world: "MAIN",
        })
        .catch(() => {});
    }
  } catch (error) {
    console.log("Content script injection skipped:", error.message);
  }
}

async function cleanupTab(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const container = document.getElementById(
          "locator-inspector-overlay-container"
        );
        if (container) {
          if (container._cleanup) container._cleanup();
          container.remove();
        }
        const styles = document.getElementById("locator-inspector-styles");
        if (styles) styles.remove();

        if (window.__locatorInspect) {
          window.__locatorInspect.__active = false;
        }
      },
      world: "MAIN",
    });
  } catch (error) {
    // Tab might be closed or inaccessible, ignore error
    // This is expected when tab is closed or navigated away
  }
}
