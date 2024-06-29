function getApiKey() {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(['notionApiKey'], function(result) {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (result.notionApiKey) {
          resolve(result.notionApiKey);
        } else {
          reject(new Error('Notion API key not set. Please set it in the extension options.'));
        }
      });
    });
  }
  
  async function getNotionDb(databaseId) {
    console.log('Fetching Notion database:', databaseId);
    let results = [];
    let hasMore = true;
    let nextCursor = null;
  
    const apiKey = await getApiKey();
  
    while (hasMore) {
      try {
        console.log(`Fetching data, cursor: ${nextCursor}`);
        const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(nextCursor ? { start_cursor: nextCursor } : {})
        });
  
        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
        }
  
        const data = await response.json();
        console.log(`Received ${data.results.length} results`);
        results = results.concat(data.results);
        hasMore = data.has_more;
        nextCursor = data.next_cursor;
      } catch (error) {
        console.error('Error in API call:', error);
        throw error;
      }
    }
  
    console.log(`Total results fetched: ${results.length}`);
    return results;
  }
  
  function normalizeHeader(header) {
    const words = header.split(' ');
    return words[0].toLowerCase() + words.slice(1).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  }
  
  function parseNotionData(data) {
    console.log('Parsing Notion data');
    const parsedData = [];
    for (const page of data) {
      const item = {};
      for (const [propName, propData] of Object.entries(page.properties)) {
        const normalizedName = normalizeHeader(propName);
        const propType = propData.type;
        
        switch (propType) {
          case "title":
            item[normalizedName] = propData.title[0]?.plain_text || "";
            break;
          case "rich_text":
            item[normalizedName] = propData.rich_text[0]?.plain_text || "";
            break;
          case "number":
            item[normalizedName] = propData.number;
            break;
          case "select":
            item[normalizedName] = propData.select?.name || "";
            break;
          case "multi_select":
            item[normalizedName] = propData.multi_select.map(option => option.name);
            break;
          case "date":
            item[normalizedName] = propData.date?.start || "";
            break;
          case "checkbox":
            item[normalizedName] = propData.checkbox;
            break;
          default:
            item[normalizedName] = `Unsupported type: ${propType}`;
        }
      }
      parsedData.push(item);
    }
    console.log('Parsing complete');
    return parsedData;
  }
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "exportJson") {
      console.log('Received exportJson request');
      (async () => {
        try {
          // Clear any existing data
          await new Promise((resolve) => chrome.storage.local.remove('notionData', resolve));
          console.log('Cleared existing data from storage');
  
          const databaseId = request.databaseId;
          console.log(`Attempting to export database: ${databaseId}`);
          const notionData = await getNotionDb(databaseId);
          console.log('Notion data fetched successfully');
          const parsedData = parseNotionData(notionData);
          const jsonOutput = JSON.stringify(parsedData, null, 2);
          console.log('JSON output created, length:', jsonOutput.length);
          
          chrome.storage.local.set({notionData: jsonOutput}, function() {
            if (chrome.runtime.lastError) {
              console.error('Error saving data to storage:', chrome.runtime.lastError);
              throw new Error('Failed to save data to storage');
            }
            console.log('Data saved to chrome.storage.local');
            
            chrome.windows.create({
              url: chrome.runtime.getURL('display.html'),
              type: 'popup',
              width: 800,
              height: 600
            }, (window) => {
              console.log('Display window created');
            });
          });
        } catch (error) {
          console.error('Error in export process:', error);
          chrome.windows.create({
            url: chrome.runtime.getURL('display.html'),
            type: 'popup',
            width: 800,
            height: 600
          }, (window) => {
            chrome.tabs.sendMessage(window.tabs[0].id, { 
              action: "displayError", 
              error: error.message,
              debug: {
                databaseId: request.databaseId
              }
            });
          });
        }
      })();
      return true; // Indicates we will send a response asynchronously
    }
  });
  
  console.log('Background script loaded');