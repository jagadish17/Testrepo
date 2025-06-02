// Listens for messages from content script and communicates with Grak AI
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'USER_ACTIONS') {
    // Get Grak AI API key from storage
    chrome.storage.sync.get('grakApiKey', async (data) => {
      const apiKey = data.grakApiKey;
      if (!apiKey) {
        sendResponse({ status: 'error', code: '// Please set your Grak AI API key in the extension options.' });
        return;
      }
      // Prepare the prompt for Grak AI
      const frameworkPrompt = `Generate Playwright TypeScript code for the following user actions in my custom framework. Actions: ${JSON.stringify(message.actions, null, 2)}`;
      try {
        const resp = await fetch('https://api.grak.ai/v1/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({ prompt: frameworkPrompt, model: 'playwright-ts' })
        });
        const result = await resp.json();
        sendResponse({ status: 'ok', code: result.code || result.choices?.[0]?.text || '// No code generated.' });
      } catch (e) {
        sendResponse({ status: 'error', code: `// Error: ${e.message}` });
      }
    });
    // Required for async sendResponse
    return true;
  }
});
