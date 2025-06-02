// Save and load Grak AI API key
const input = document.getElementById('apiKey');
const saveBtn = document.getElementById('save');

saveBtn.onclick = () => {
  chrome.storage.sync.set({ grakApiKey: input.value });
};

chrome.storage.sync.get('grakApiKey', (data) => {
  if (data.grakApiKey) input.value = data.grakApiKey;
});
