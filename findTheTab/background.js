// Background service worker for Find The Tab (MV3)

chrome.runtime.onInstalled.addListener(() => {
  // Nothing to do yet; commands are declared in manifest
});

// Relay command to all tabs to toggle overlay
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-search') return;
  await toggleInActiveTab();
});

// Also allow clicking the toolbar icon to toggle the overlay in the active tab
chrome.action.onClicked.addListener(async () => {
  await toggleInActiveTab();
});

async function toggleInActiveTab() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!activeTab?.id) return;
    const tabId = activeTab.id;
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'FIND_THE_TAB_TOGGLE' });
    } catch (sendErr) {
      // If the content script is not injected (e.g., tab opened before install), inject it and try again
      try {
        await chrome.scripting.insertCSS({ target: { tabId }, files: ['styles.css'] });
      } catch (_) {}
      try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      } catch (_) {}
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'FIND_THE_TAB_TOGGLE' });
      } catch (_) {}
    }
  } catch (_) {
    // Ignore
  }
}

// Handle focus/open requests coming from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'FIND_THE_TAB_ACTIVATE') {
    const { tabId, windowId } = message;
    if (typeof windowId === 'number') {
      chrome.windows.update(windowId, { focused: true });
    }
    if (typeof tabId === 'number') {
      chrome.tabs.update(tabId, { active: true });
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === 'FIND_THE_TAB_OPEN_URL') {
    const { url } = message;
    chrome.tabs.create({ url });
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === 'FIND_THE_TAB_QUERY_TABS') {
    chrome.tabs.query({}, (tabs) => {
      sendResponse(Array.isArray(tabs) ? tabs : []);
    });
    return true;
  }

  if (message?.type === 'FIND_THE_TAB_QUERY_HISTORY') {
    const startTime = Date.now() - 1000 * 60 * 60 * 24 * 30; // 30 days
    chrome.history.search({ text: '', maxResults: 50, startTime }, (results) => {
      sendResponse(Array.isArray(results) ? results : []);
    });
    return true;
  }
});


