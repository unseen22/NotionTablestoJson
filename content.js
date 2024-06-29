function extractDatabaseId(url) {
  const match = url.match(/([a-f0-9]{32})/);
  return match ? match[1] : null;
}

function addExportButton() {
  if (document.getElementById('notion-json-export-button')) return;

  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'notion-json-export-container';

  const button = document.createElement('button');
  button.id = 'notion-json-export-button';
  button.textContent = '🤘';

  const tooltip = document.createElement('div');
  tooltip.id = 'notion-json-export-tooltip';
  tooltip.textContent = 'Export Table to JSON';
  
  buttonContainer.appendChild(button);
  buttonContainer.appendChild(tooltip);
  
  const style = document.createElement('style');
  style.textContent = `
    #notion-json-export-container {
      position: fixed;
      bottom: 25px;
      right: 70px;
      z-index: 9999;
    }
    #notion-json-export-button {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background-color: rgba(46, 170, 220, 0.5);
      color: rgba(255, 255, 255, 0.8);
      border: none;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      font-size: 24px;
      line-height: 1;
      text-align: center;
    }
    #notion-json-export-button:hover {
      background-color: rgba(46, 170, 220, 1);
      color: white;
      transform: scale(1.1);
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    }
    #notion-json-export-button:active {
      background-color: rgba(33, 128, 166, 1);
      transform: scale(0.95);
    }
    #notion-json-export-tooltip {
      position: absolute;
      bottom: 100%;
      right: 0;
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 14px;
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
      margin-bottom: 10px;
    }
    #notion-json-export-container:hover #notion-json-export-tooltip {
      opacity: 1;
      visibility: visible;
    }
  `;
  
  document.head.appendChild(style);
  
  button.addEventListener('click', () => {
    const currentUrl = window.location.href;
    const databaseId = extractDatabaseId(currentUrl);
    if (databaseId) {
      console.log('Extracted database ID:', databaseId);
      chrome.runtime.sendMessage({action: "exportJson", databaseId: databaseId}, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error sending message:', chrome.runtime.lastError);
        }
        if (response && response.error) {
          console.error('Error from background script:', response.error);
        }
      });
    } else {
      console.error("Couldn't extract database ID from URL:", currentUrl);
      alert("Couldn't extract database ID. Make sure you're on a Notion database page.");
    }
  });

  document.body.appendChild(buttonContainer);
}

function isNotionPage() {
  return window.location.hostname.includes('notion.so');
}

function initializeExtension() {
  if (isNotionPage()) {
    addExportButton();
  }
}

initializeExtension();

const observer = new MutationObserver(initializeExtension);
observer.observe(document.body, { childList: true, subtree: true });

console.log('Content script loaded');