console.log('Display script loaded');

function showDebugInfo(debugInfo) {
    console.log('Showing debug info:', debugInfo);
    const debugElement = document.getElementById('debug-info');
    debugElement.innerHTML = `
        <h3>Debug Information:</h3>
        <p>Database ID: ${debugInfo.databaseId || 'N/A'}</p>
        <p>Total Pages Fetched: ${debugInfo.totalPages || 'N/A'}</p>
    `;
    debugElement.style.display = 'block';
}

function showError(error) {
    console.error('Displaying error:', error);
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = `Error: ${error}`;
    errorElement.style.display = 'block';
    document.getElementById('json-display').style.display = 'none';
    document.getElementById('download-btn').style.display = 'none';
}

function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

function displayJsonData(jsonData) {
    console.log('Displaying JSON data, length:', jsonData.length);
    const jsonDisplay = document.getElementById('json-display');
    jsonDisplay.innerHTML = syntaxHighlight(jsonData);
    jsonDisplay.style.display = 'block';
    document.getElementById('download-btn').style.display = 'block';
}

function retrieveAndDisplayData() {
    console.log('Attempting to retrieve data from storage');
    chrome.storage.local.get(['notionData'], function(result) {
        console.log('Retrieved data from storage:', result);
        if (chrome.runtime.lastError) {
            console.error('Error retrieving data from storage:', chrome.runtime.lastError);
            showError('Error retrieving data from storage');
        } else if (result.notionData) {
            displayJsonData(result.notionData);
        } else {
            console.log('No data found in storage');
            showError('No data retrieved from storage');
        }
    });
}

let attempts = 0;
const maxAttempts = 10;
function attemptDataRetrieval() {
    retrieveAndDisplayData();
    attempts++;
    if (attempts < maxAttempts) {
        setTimeout(attemptDataRetrieval, 500);
    }
}

attemptDataRetrieval();

document.getElementById('download-btn').addEventListener('click', function() {
    chrome.storage.local.get(['notionData'], function(result) {
        if (result.notionData) {
            const blob = new Blob([result.notionData], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'notion_export.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message in display script:', request);
    if (request.action === "displayError") {
        showError(request.error);
        showDebugInfo(request.debug);
    }
});