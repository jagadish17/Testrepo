// Update to use Grok AI key in options
const input = document.getElementById('apiKey');
const saveBtn = document.getElementById('save');

saveBtn.onclick = () => {
  chrome.storage.sync.set({ grokApiKey: input.value });
};

chrome.storage.sync.get('grokApiKey', (data) => {
  if (data.grokApiKey) input.value = data.grokApiKey;
});
