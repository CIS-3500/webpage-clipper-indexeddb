/**
 * Extract all <a> elements from a given root (Document or DocumentFragment)
 */
function extractHyperLinks(root) {
  const anchors = Array.from(root.querySelectorAll('a')).filter(a => a.href);
  return anchors.map(a => ({ href: a.href, text: a.innerText.trim() }));
}

/**
 * Build the standard pageData object from a list of links
 */

function buildPageData(links, snippet) {
  return {
    title: document.title,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    links,
    linkCount: links.length,
    snippet  
  };
}

/**
 * Send the extracted data to background, under the given action
 */
function sendLinkData(action, data) {
  chrome.runtime.sendMessage({ action, data }, resp => {
    if (resp?.success) console.log(`${action} sent successfully`);
    else console.error(`${action} failed to send`);
  });
}

/**
 * Extract from the entire document
 */
function handleExtractAll() {
  const links = extractHyperLinks(document);
  sendLinkData('extractAllLinks', buildPageData(links, "Full Page"));
}

/**
 * Extract only from the user’s selection
 */

function handleExtractSelection() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const frag = sel.getRangeAt(0).cloneContents();
  const links = extractHyperLinks(frag);

  const selectedText = sel.toString().trim(); // capture selected text
  sendLinkData('extractLinksFromSelection', buildPageData(links, selectedText));
}

// --- message listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Content] Received message:', message.action);
  if (message.action === 'ping') {
    sendResponse({ success: true });
    return;
  }

  if (message.action === 'extractAllLinks') {
    handleExtractAll();
    sendResponse({ success: true });
    return;
  }

  if (message.action === 'extractLinksFromSelection') {
    handleExtractSelection();
    sendResponse({ success: true });
    return;
  }
});