chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({
    windowId: tab.windowId,
  });
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;

  await chrome.sidePanel.setOptions({
    tabId,
    path: "popup.html",
    enabled: true,
  });
});

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
