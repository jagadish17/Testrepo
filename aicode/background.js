// Listens for messages from content script and communicates with Grok AI
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'USER_ACTIONS') {
    chrome.storage.sync.get('grokApiKey', async (data) => {
      const apiKey = data.grokApiKey;
      if (!apiKey) {
        sendResponse({ status: 'error', code: '// Please set your Grok AI API key in the extension options.' });
        return;
      }
      // Build the custom framework prompt
      const baseUrl = window.location ? window.location.origin : '';
      const actionDescriptions = message.actions.map((a, i) => `${i+1}. [${a.event}] ${a.locator || a.tag} ${a.value ? `= ${a.value}` : ''}`).join('\n');
      const frameworkPrompt = `\nYou're an expert AI coding assistant working on a Playwright-based TypeScript automation framework. Follow these rules and conventions strictly and intelligently, as if you've spent years building and maintaining high-quality test suites.\n\n🔧 Project Structure\nPage objects live in the pages folder — one class per file, named XxxPage.ts.\n\nTests live in the tests folder — grouped by feature.\n\nAll utilities like date/time helpers or data generation (faker) go in utils.\n\nCustom fixtures are stored in customFixtures.\n\n🧭 Selector Strategy\nSelectors must be defined in a selectors object inside each page class. Use clear, camelCase property names.\n\nSelector priority (in this order):\n\ndata-testid or data-test\n\naria-label or role\n\nVisible, unique text (e.g. for buttons)\n\nUnique name or placeholder (for inputs)\n\nStable and meaningful CSS IDs\n\nTag/class/attribute combinations (as a last resort)\n\nXPath (only if absolutely necessary — and make them robust)\n\nFor dynamic selectors, use arrow functions like this:\n\nstatusOption: (data: string, index: number) => \`(//span[text()=\"\${data}\"])[\${index}]\`\n⚠️ If you don't use data-testid or aria-label, add a short inline comment explaining why.\n\n✅ Always validate selectors to ensure exactly one element is matched. Refine using nth-child, parent context, or attributes as needed.\n\n⚙️ Page Actions\nAll interactions should be written as async methods inside the page class.\n\nUse await this.page.locator(this.selectors.selectorName).action() for every interaction.\n\nCall await this.validateElementVisibility(...) before interacting, when required.\n\nMethod names and parameters should be self-explanatory, as if written for other testers to reuse with confidence.\n\n🧪 Test Structure\nUse Playwright's test.describe and test blocks properly.\n\nEnable serial mode if needed using: test.describe.configure({ mode: \"serial\" })\n\nEvery test must include annotations:\n\nts\nCopy\nEdit\ntest.info().annotations.push(\n    { type: 'Author', description: 'YourName' },\n    { type: 'TestCase', description: 'TC-123: Feature Description' },\n    { type: 'Test Description', description: 'What exactly is being verified' }\n);\nTests must use custom fixtures and faker utilities wherever appropriate.\n\n🛠️ Utility & Helpers\nFollow the existing utility function styles in utils.\n\nUtility function names should be descriptive and consistent (getCurrentDateFormatted, etc.)\n\n✅ Best Practices\nNever modify the folder structure.\n\nNever use hardcoded waits. Use Playwright's built-in waits and assertions.\n\nMatch the indentation, comments, and spacing used throughout the existing codebase.\n\nDon't invent new styles or patterns — follow the existing framework strictly.\n\nAvoid duplicated actions and remove empty or irrelevant input steps.\n\nLogical flows matter — group related actions (e.g., fill form → validate → submit).\n\nEvery step should be clear, minimal, and reusable.\n\n🧠 Before You Code\nWhen you receive manual flow/recording:\n\nThink like a senior tester. Understand the user's intent, context, and edge cases.\n\nBreak down the steps into logical, layered blocks.\n\nVerify the expected behavior first — don't blindly convert actions to code.\n\nMake sure the final test reflects real usage, not just clicks.\n\n🔄 Output Expectations\nWhen generating code:\n\nInclude only the necessary file blocks (.ts) — no markdown, no extra comments.\n\nInclude imports, setup, POM methods, tests, and assertions that follow the framework exactly.\n\nIf any Page class or selectors are missing, generate them correctly before test code.\n\nThe final code should feel like it was written by a mature, detail-focused engineer — readable, reusable, and robust.\n// --- STRICT CUSTOM FRAMEWORK PROMPT END ---\n\nBase URL: ${baseUrl}\n\nRecorded Actions:\n${actionDescriptions}\n\nReturn **only** the TypeScript code.`;
      try {
        const groqModule = await import('groq-sdk');
        const Groq = groqModule.Groq;
        const groq = new Groq({ apiKey });
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: 'user', content: frameworkPrompt }
          ],
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          temperature: 1,
          max_completion_tokens: 1024,
          top_p: 1,
          stream: false,
          stop: null
        });
        const code = chatCompletion.choices?.[0]?.message?.content || '// No code generated.';
        sendResponse({ status: 'ok', code });
      } catch (e) {
        sendResponse({ status: 'error', code: `// Error: ${e.message}` });
      }
    });
    // Required for async sendResponse
    return true;
  }
  if (message.type === 'START_VSCODE_SERVER') {
    // Try to start the server using a terminal command (only works in VS Code extension context)
    try {
      const { exec } = require('child_process');
      exec('node vscode-insert-server.js', { cwd: process.cwd() }, (err, stdout, stderr) => {
        if (err) {
          sendResponse({ status: 'error', error: err.message });
        } else {
          sendResponse({ status: 'ok', output: stdout });
        }
      });
    } catch (e) {
      sendResponse({ status: 'error', error: e.message });
    }
    return true;
  }
});
