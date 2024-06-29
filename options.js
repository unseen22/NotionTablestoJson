// Saves options to chrome.storage
function saveOptions() {
    var apiKey = document.getElementById('api-key').value;
    chrome.storage.sync.set({
        notionApiKey: apiKey
    }, function() {
        // Update status to let user know options were saved.
        var status = document.getElementById('status');
        status.textContent = 'Options saved.';
        status.classList.add('show');
        setTimeout(function() {
            status.classList.remove('show');
        }, 3000);
    });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restoreOptions() {
    chrome.storage.sync.get({
        notionApiKey: ''
    }, function(items) {
        document.getElementById('api-key').value = items.notionApiKey;
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);