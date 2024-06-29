// Function to get the API key from Chrome storage
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

// Function to fetch a Notion database
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

// Function to normalize property headers
function normalizeHeader(header) {
  const words = header.split(' ');
  return words[0].toLowerCase() + words.slice(1).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

// Function to get the title of a Notion page
async function getPageTitle(pageId, apiKey) {
  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const title = data.properties.title?.title[0]?.plain_text || data.properties.Name?.title[0]?.plain_text || 'Untitled';
    return title;
  } catch (error) {
    console.error('Error fetching page title:', error);
    return 'Error fetching title';
  }
}

// Function to parse Notion data
async function parseNotionData(data) {
  console.log('Parsing Notion data');
  const parsedData = [];
  const apiKey = await getApiKey();

  for (const page of data) {
    const item = {};
    for (const [propName, propData] of Object.entries(page.properties)) {
      const normalizedName = normalizeHeader(propName);
      const propType = propData.type;
      
      switch (propType) {
        case "title":
        case "rich_text":
          item[normalizedName] = propData[propType].map(text => text.plain_text).join('');
          break;
        case "number":
          item[normalizedName] = propData.number;
          break;
        case "select":
          item[normalizedName] = propData.select?.name || null;
          break;
        case "multi_select":
          item[normalizedName] = propData.multi_select.map(option => option.name);
          break;
        case "date":
          item[normalizedName] = propData.date ? {
            start: propData.date.start,
            end: propData.date.end,
            time_zone: propData.date.time_zone
          } : null;
          break;
        case "checkbox":
          item[normalizedName] = propData.checkbox;
          break;
        case "url":
          item[normalizedName] = propData.url;
          break;
        case "email":
          item[normalizedName] = propData.email;
          break;
        case "phone_number":
          item[normalizedName] = propData.phone_number;
          break;
        case "formula":
          item[normalizedName] = propData.formula.type === 'string' ? propData.formula.string :
                                 propData.formula.type === 'number' ? propData.formula.number :
                                 propData.formula.type === 'boolean' ? propData.formula.boolean :
                                 propData.formula.type === 'date' ? propData.formula.date : null;
          break;
        case "relation":
          const relationPromises = propData.relation.map(rel => getPageTitle(rel.id, apiKey));
          item[normalizedName] = await Promise.all(relationPromises);
          break;
        case "rollup":
          item[normalizedName] = propData.rollup.type === 'number' ? propData.rollup.number :
                                 propData.rollup.type === 'date' ? propData.rollup.date :
                                 propData.rollup.type === 'array' ? propData.rollup.array : null;
          break;
        case "created_time":
        case "last_edited_time":
          item[normalizedName] = propData[propType];
          break;
        case "created_by":
        case "last_edited_by":
          item[normalizedName] = {
            id: propData[propType].id,
            object: propData[propType].object
          };
          break;
        case "files":
          item[normalizedName] = propData.files.map(file => ({
            name: file.name,
            type: file.type,
            url: file.file ? file.file.url : file.external.url
          }));
          break;
        case "people":
          item[normalizedName] = propData.people.map(person => ({
            id: person.id,
            object: person.object,
            name: person.name,
            avatar_url: person.avatar_url
          }));
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

// Message listener for Chrome extension
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
        const parsedData = await parseNotionData(notionData);
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