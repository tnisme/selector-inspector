const activeTabs = new Set();

// tabId → port: DevTools panel (popup.html running inside DevTools)
const devtoolsPorts = new Map();
// tabId → port: Elements sidebar pane (sidebar.html)
const sidebarPanePorts = new Map();
// tabId → port: devtools.js connection (so we can send SHOW_SIDEBAR back)
const devtoolsSidebarPorts = new Map();
// tabId → data: element data waiting for sidebar.html to finish loading
const pendingSidebarData = new Map();
// Fallback when tabId key lookup fails (covers tabId=0 / mismatch edge cases)
let latestSidebarPort = null;
// ─── DevTools port connections ─────────────────────────────────────────────

chrome.runtime.onConnect.addListener((port) => {

  if (port.name === "devtools-panel") {
    // popup.html opened as a DevTools panel
    port.onMessage.addListener((msg) => {
      if (msg.type === "INIT") {
        devtoolsPorts.set(msg.tabId, port);
        injectContentScript(msg.tabId).catch(console.error);
      }
    });
    port.onDisconnect.addListener(() => {
      for (const [tabId, p] of devtoolsPorts) {
        if (p === port) { devtoolsPorts.delete(tabId); break; }
      }
    });
  }

  if (port.name === "devtools-sidebar") {
    // devtools.js sidebar management connection
    let sidebarTabId = null;
    port.onMessage.addListener((msg) => {
      if (msg.type === "INIT") {
        sidebarTabId = msg.tabId;
        devtoolsSidebarPorts.set(msg.tabId, port); // store so we can send back
        injectContentScript(msg.tabId).catch(console.error);
      }
      if (msg.type === "REINJECT" && msg.tabId) {
        injectContentScript(msg.tabId).catch(console.error);
      }
      // Relay sidebar state to sidebar.html via its own port
      if (msg.type === "SIDEBAR_LOADING" || msg.type === "SIDEBAR_EMPTY") {
        const sp = sidebarPanePorts.get(msg.tabId) || latestSidebarPort;
        if (sp) sp.postMessage(msg);
      }
      if (msg.type === "SIDEBAR_UPDATE") {
        const sp = sidebarPanePorts.get(msg.tabId) || latestSidebarPort;
        if (sp) {
          sp.postMessage(msg);
        } else {
          // sidebar.html hasn't loaded yet — hold the data until it does
          pendingSidebarData.set(msg.tabId, msg.data);
        }
      }
      // Run window.__suggestLocators in isolated world, send result back to devtools.js.
      // Uses XPath to re-locate $0 — expando properties are NOT shared between worlds.
      if (msg.type === "GET_SMART_SUGGESTIONS") {
        const { tabId: tId, requestId, elementPath } = msg;
        chrome.scripting.executeScript({
          target: { tabId: tId, allFrames: false },
          func: (xpath) => {
            try {
              if (!xpath || typeof window.__suggestLocators !== "function") return null;
              const result = document.evaluate(
                xpath, document, null,
                XPathResult.FIRST_ORDERED_NODE_TYPE, null
              );
              const el = result.singleNodeValue;
              if (!el) return null;
              return window.__suggestLocators(el, "smart");
            } catch (_) { return null; }
          },
          args: [elementPath],
          world: "ISOLATED",
        }).then((results) => {
          const data = results?.[0]?.result;
          port.postMessage({
            type: "SMART_SUGGESTIONS_RESULT",
            requestId,
            suggestions: data?.suggestions || [],
          });
        }).catch(() => {
          port.postMessage({ type: "SMART_SUGGESTIONS_RESULT", requestId, suggestions: [] });
        });
      }
      // sidebar "Use in Panel" forwarded through devtools.js → here → panel port
      if (msg.type === "FORWARD_USE_IN_PANEL") {
        const panelPort = devtoolsPorts.get(msg.tabId);
        if (panelPort) {
          panelPort.postMessage({
            type: "ELEMENT_SUGGESTIONS",
            data: { selector: msg.selector, type: msg.locatorType },
          });
        }
      }
    });
    port.onDisconnect.addListener(() => {
      if (sidebarTabId) {
        cleanupTab(sidebarTabId).catch(() => {});
        devtoolsSidebarPorts.delete(sidebarTabId);
        pendingSidebarData.delete(sidebarTabId);
      }
    });
  }

  if (port.name === "sidebar-pane") {
    // sidebar.html connected — track as latest and store in Map
    latestSidebarPort = port;
    let paneTabId = null;
    port.onMessage.addListener((msg) => {
      if (msg.type === "SIDEBAR_INIT") {
        paneTabId = msg.tabId;
        if (paneTabId) sidebarPanePorts.set(paneTabId, port);
        // Flush any data pending from before the page finished loading.
        // Check by tabId first, then fall back to any queued entry.
        const pending =
          (paneTabId && pendingSidebarData.get(paneTabId)) ||
          (pendingSidebarData.size > 0
            ? pendingSidebarData.values().next().value
            : null);
        if (pending) {
          port.postMessage({ type: "SIDEBAR_UPDATE", data: pending });
          if (paneTabId) pendingSidebarData.delete(paneTabId);
          else pendingSidebarData.clear();
        }
      }
      // "Use in Panel" sent from sidebar.html directly via port
      if (msg.type === "USE_IN_PANEL") {
        const panelPort = devtoolsPorts.get(paneTabId);
        if (panelPort) {
          panelPort.postMessage({
            type: "ELEMENT_SUGGESTIONS",
            data: { selector: msg.selector, type: msg.locatorType },
          });
        }
      }
      // Highlight request from sidebar.html
      if (msg.type === "HIGHLIGHT" && paneTabId) {
        chrome.scripting
          .executeScript({
            target: { tabId: paneTabId, allFrames: false },
            func: (selector, locatorType) => {
              if (typeof window.__locatorInspect === "function") {
                window.__locatorInspect(selector, locatorType, -1);
              }
            },
            args: [msg.selector, (msg.locatorType || "css").toLowerCase()],
            world: "ISOLATED",
          })
          .catch(() => {});
      }
    });
    port.onDisconnect.addListener(() => {
      if (paneTabId) sidebarPanePorts.delete(paneTabId);
      if (latestSidebarPort === port) latestSidebarPort = null;
    });
  }
});

// ─── Side Panel (original flow) ────────────────────────────────────────────

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Side panel lifecycle messages
  if (message.type === "panel-opened" || message.type === "panel-closed") {
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const activeTab = tabs[0];
      if (!activeTab) { sendResponse({ success: false }); return; }
      if (message.type === "panel-opened") {
        activeTabs.add(activeTab.id);
        injectContentScript(activeTab.id).catch(console.error);
      } else {
        activeTabs.delete(activeTab.id);
        cleanupTab(activeTab.id).catch(console.error);
      }
      sendResponse({ success: true });
    });
    return true;
  }
  sendResponse({ success: false });
});

// ─── Tab lifecycle ─────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
  devtoolsPorts.delete(tabId);
  sidebarPanePorts.delete(tabId);
  devtoolsSidebarPorts.delete(tabId);
  pendingSidebarData.delete(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, _tab) => {
  if (changeInfo.status === "loading" && activeTabs.has(tabId)) {
    await cleanupTab(tabId);
    activeTabs.delete(tabId);
  }
});

// ─── Content script injection ──────────────────────────────────────────────

async function injectContentScript(tabId) {
  try {
    const results = await chrome.scripting
      .executeScript({
        target: { tabId, allFrames: true },
        func: () => typeof window.__locatorInspect,
        world: "ISOLATED",
      })
      .catch(() => null);

    const needsInjection = !results || results.some((r) => r.result !== "function");

    if (needsInjection) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          files: [
            "engine/cssEngine.js",
            "engine/xpathEngine.js",
            "engine/playwrightEngine.js",
            "engine/smartLocatorEngine.js",
            "engine/candidateGenerator.js",
            "engine/injector.js",
          ],
          world: "ISOLATED",
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        const verifyResults = await chrome.scripting
          .executeScript({
            target: { tabId, allFrames: true },
            func: () => ({
              hasInspect: typeof window.__locatorInspect === "function",
              hasEngines: typeof window.__locatorEngines === "object",
              engineKeys: window.__locatorEngines
                ? Object.keys(window.__locatorEngines)
                : [],
            }),
            world: "ISOLATED",
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
            target: { tabId, allFrames: true },
            func: () => {
              if (window.__locatorInspect) window.__locatorInspect.__active = true;
            },
            world: "ISOLATED",
          })
          .catch(() => {});
      } catch (error) {
        console.error("Error injecting content scripts:", error);
      }
    } else {
      await chrome.scripting
        .executeScript({
          target: { tabId, allFrames: true },
          func: () => {
            if (window.__locatorInspect) window.__locatorInspect.__active = true;
          },
          world: "ISOLATED",
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
      target: { tabId, allFrames: true },
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
        if (window.__locatorInspect) window.__locatorInspect.__active = false;
      },
      world: "ISOLATED",
    });
  } catch (_error) {
    // Tab might be closed or inaccessible — expected
  }
}
