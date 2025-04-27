/**
 * Sidebar script for the Hyperlink Extractor extension
 * Handles displaying and managing extract hyperlinks using IndexedDB
 */

// Elements
const groupContainer = document.getElementById('groupContainer');
const clearAllBtn = document.getElementById('clearAllBtn');

// Format ISO timestamp → human date/time
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Crop a paragraph snippet nicely
function cropSnippet(snippetText) {
  const words = snippetText.split(/\s+/);
  if (words.length <= 10) {
    return snippetText;
  }
  return `${words.slice(0, 5).join(' ')} ... ${words.slice(-5).join(' ')}`;
}

// Render all extracted pages
async function renderExtractedPages() {
  try {
    const pages = await HyperlinkExtractorDB.getAllPages(); // <-- DB call
    groupContainer.innerHTML = '';

    if (!pages.length) {
      groupContainer.innerHTML = `
        <div class="no-data">
          <p>No hyperlinks extracted yet.</p>
        </div>
      `;
      return;
    }

    // Group pages by URL
    const groups = pages.reduce((acc, page) => {
      const key = page.url;
      (acc[key] = acc[key] || []).push(page);
      return acc;
    }, {});

    // Sort groups by latest timestamp
    const sortedGroups = Object.values(groups)
      .map(group => {
        group.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return group;
      })
      .sort((g1, g2) => new Date(g2[0].timestamp) - new Date(g1[0].timestamp));

    sortedGroups.forEach(groupPages => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'page-group';

      // Big Title (Page Title)
      const titleDiv = document.createElement('div');
      titleDiv.className = 'group-title';
      titleDiv.textContent = groupPages[0].title;
      groupDiv.appendChild(titleDiv);

      // URL
      const urlDiv = document.createElement('a');
      urlDiv.className = 'group-url';
      urlDiv.href = groupPages[0].url;
      urlDiv.target = '_blank';
      urlDiv.textContent = groupPages[0].url;
      groupDiv.appendChild(urlDiv);

      // Render each extraction under this URL
      groupPages.forEach(page => {
        const entry = document.createElement('div');
        entry.className = 'extraction-item';

        // Timestamp
        const dateDiv = document.createElement('div');
        dateDiv.className = 'group-meta';
        dateDiv.textContent = formatDate(page.timestamp);
        entry.appendChild(dateDiv);

        // Snippet
        const snippetDiv = document.createElement('div');
        snippetDiv.className = 'snippet-preview';
        snippetDiv.textContent = (page.snippet === "Full Page") ? "Full Page" : cropSnippet(page.snippet);
        snippetDiv.title = page.snippet; // Hover shows full paragraph
        entry.appendChild(snippetDiv);

        // Link List
        const linkList = document.createElement('ul');
        linkList.className = 'link-list';
        (page.links || []).forEach(link => {
          const li = document.createElement('li');
          li.className = 'link-item';
          li.innerHTML = `<a href="${link.href}" target="_blank">${link.text || link.href}</a>`;
          linkList.appendChild(li);
        });
        entry.appendChild(linkList);

        groupDiv.appendChild(entry);

        // Divider
        const divider = document.createElement('hr');
        divider.className = 'extraction-divider';
        groupDiv.appendChild(divider);
      });

      groupContainer.appendChild(groupDiv);
    });

  } catch (error) {
    console.error('Error rendering extracted pages:', error);
    groupContainer.innerHTML = `
      <div class="no-data">
        <p>Error loading extracted pages</p>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// Initialize: load database + render
async function initialize() {
  try {
    await HyperlinkExtractorDB.init(); // <-- DB initialization
    await renderExtractedPages();
  } catch (error) {
    console.error('Error initializing sidebar:', error);
    groupContainer.innerHTML = `
      <div class="no-data">
        <p>Error initializing storage</p>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// Clear all saved pages
clearAllBtn.addEventListener('click', async () => {
  if (confirm('Are you sure you want to delete all extracted hyperlinks?')) {
    try {
      await HyperlinkExtractorDB.clearAllPages();
      await renderExtractedPages();
    } catch (error) {
      console.error('Error clearing extracted pages:', error);
    }
  }
});

if (!window.hasHyperlinkExtractorSidebarListener) {
  console.log('[Sidebar] Adding runtime.onMessage listener');

  chrome.runtime.onMessage.addListener((message, sender) => {
    console.log('[Sidebar] Received message:', message.action);

    if (message.source === 'background' && (message.action === 'extractAllLinks' || message.action === 'extractLinksFromSelection') && message.data) {
      console.log('[Sidebar] Attempting to add page to DB...');

      (async () => {
        try {
          await HyperlinkExtractorDB.addPage(message.data);
          console.log('[Sidebar] Successfully added page to DB');
          await renderExtractedPages();
          console.log('[Sidebar] Rendered extracted pages');
        } catch (error) {
          console.error('Error adding new extracted page:', error);
        }
      })();
    }
  });

  window.hasHyperlinkExtractorSidebarListener = true;
}

// Kick off
document.addEventListener('DOMContentLoaded', initialize);