// Background script for side panel management
chrome.action.onClicked.addListener(async (tab) => {
  // Open the side panel for the current window
  await chrome.sidePanel.open({
    windowId: tab.windowId,
  });
});

// Set up side panel availability for all tabs
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;

  // Enable side panel for all tabs
  await chrome.sidePanel.setOptions({
    tabId,
    path: "popup.html",
    enabled: true,
  });
});

// Enable side panel for existing tabs on extension startup
chrome.runtime.onStartup.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.url) {
      await chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: "popup.html",
        enabled: true,
      });
    }
  }
});
