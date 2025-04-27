/**
 * Background service worker for the Hyperlink Extractor extension
 * Initializes the database and handles side panel setup
 */

// Register the side panel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Relay extractor results into the sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, data } = message;
  if (action === 'extractAllLinks' || action === 'extractLinksFromSelection') {
    console.log(`[Background] forwarding "${action}" to sidebar`, data);
    chrome.runtime.sendMessage({ source: 'background', action, data });
    sendResponse({ success: true });
  }
});

// Create two context-menu items on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'extractAllLinks',
    title: 'Extract all links',
    contexts: ['page', 'selection']
  });
  chrome.contextMenus.create({
    id: 'extractLinksFromSelection',
    title: 'Extract links from selection',
    contexts: ['selection']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('[Background] onClicked:', info, 'tab:', tab);
  if (!tab?.id) {
    console.warn('[Background] no valid tab ID—aborting');
    return;
  }

  let extractorAction = null;
  if (info.menuItemId === 'extractAllLinks') {
    extractorAction = 'extractAllLinks';
  } else if (info.menuItemId === 'extractLinksFromSelection') {
    extractorAction = 'extractLinksFromSelection';
  } else {
    console.log('[Background] clicked menuItemId not recognized—ignoring');
    return;
  }

  // Build the message
  const buildMessage = () => {
    const msg = { action: extractorAction };
    if (extractorAction === 'extractLinksFromSelection') {
      msg.selectionText = info.selectionText;
    }
    console.log('[Background] sending to content script:', msg);
    chrome.tabs.sendMessage(tab.id, msg);
  };

  // Ping to see if content.js is loaded
  console.log('[Background] pinging content script in tab', tab.id);  
  chrome.tabs.sendMessage(tab.id, { action: 'ping' }, response => {
    if (chrome.runtime.lastError || !response?.success) {
      console.warn('[Background] No content script found — injecting into tab', tab.id);
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('[Background] Injection failed:', chrome.runtime.lastError);
          return;
        }
        console.log('[Background] Content script injected. Sending extraction message...');
        // wait for content script to finish setting up listener
        setTimeout(() => {
          buildMessage(); // send extraction after ~small wait
        }, 100); // small 100ms wait to be safe
      });
    } else {
      console.log('[Background] Content script already active. Sending extraction message...');
      buildMessage();
    }
  });
});

console.log('[Background] Hyperlink Extractor background script loaded');