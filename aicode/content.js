// Injected into every page to listen for user actions
function sendAction(action) {
  chrome.runtime.sendMessage({ type: 'USER_ACTION', action });
}
document.addEventListener('click', (e) => {
  sendAction({ event: 'click', tag: e.target.tagName, id: e.target.id, class: e.target.className });
});
// Add more listeners as needed

// Remove popup logic and inject a persistent, premium side panel
function createOrShowSidePanel() {
  let panel = document.getElementById('grok-side-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'grok-side-panel';
    panel.innerHTML = `
      <style>
        #grok-side-panel { position: fixed; top: 0; right: 0; width: 420px; height: 100vh; background: linear-gradient(135deg, #181a1b 0%, #232526 100%); color: #fff; box-shadow: -2px 0 24px #0008; z-index: 2147483647; font-family: 'Segoe UI', Arial, sans-serif; display: flex; flex-direction: column; border-radius: 8px 0 0 8px; }
        #grok-side-panel-header { padding: 20px 28px; font-size: 1.4em; font-weight: 700; background: rgba(0,0,0,0.16); border-bottom: 1px solid #333; display: flex; align-items: center; justify-content: space-between; }
        #grok-side-panel-close { background: none; border: none; color: #fff; font-size: 1.3em; cursor: pointer; }
        #grok-side-panel-body { flex: 1; overflow-y: auto; padding: 20px 28px; }
        #grok-side-panel-footer { padding: 16px 28px; border-top: 1px solid #333; background: rgba(0,0,0,0.10); display: flex; justify-content: flex-end; gap: 10px; }
        #grok-copy-btn, #grok-insert-btn, #grok-start-btn, #grok-stop-btn, #grok-start-server-btn { background: #00c6ff; color: #fff; border: none; border-radius: 4px; padding: 10px 22px; font-size: 1em; cursor: pointer; font-weight: 600; box-shadow: 0 2px 8px #00c6ff22; transition: background 0.2s; }
        #grok-copy-btn:hover, #grok-insert-btn:hover, #grok-start-btn:hover, #grok-stop-btn:hover, #grok-start-server-btn:hover { background: #0072ff; }
        .grok-action-item { margin-bottom: 10px; padding: 10px 14px; background: #23272b; border-radius: 4px; font-size: 1em; }
        .grok-code-block { background: #181a1b; color: #b5e0ff; border-radius: 4px; padding: 14px; font-family: 'Fira Mono', 'Consolas', monospace; font-size: 1em; margin-top: 12px; white-space: pre; }
        #grok-server-status { margin-left: 12px; font-size: 0.98em; }
        #grok-file-path { background: #181a1b; color: #b5e0ff; border: 1px solid #333; border-radius: 4px; padding: 7px 12px; font-size: 1em; width: 60%; margin-right: 10px; }
        #grok-confirm-bar { background: #232526; padding: 12px 28px; border-top: 1px solid #333; display: flex; justify-content: flex-end; gap: 10px; }
      </style>
      <div id="grok-side-panel-header">
        <span>Grok AI DOM Recorder</span>
        <span id="grok-server-status">Server: <span id="grok-server-status-value">Checking...</span></span>
        <button id="grok-side-panel-close">×</button>
      </div>
      <div id="grok-side-panel-body">
        <div id="grok-action-list">No actions yet.</div>
        <div id="grok-code-block" class="grok-code-block" style="display:none;"></div>
      </div>
      <div id="grok-side-panel-footer">
        <input id="grok-file-path" placeholder="/path/in/workspace.ts" />
        <button id="grok-start-btn">Start</button>
        <button id="grok-stop-btn" disabled>Stop</button>
        <button id="grok-insert-btn">Insert to VS Code</button>
        <button id="grok-copy-btn">Copy Code</button>
        <button id="grok-start-server-btn">Start VS Code Server</button>
      </div>
      <div id="grok-confirm-bar" style="display:none;">
        <span>Insert code at <span id="grok-confirm-path"></span>?</span>
        <button id="grok-keep-btn">Keep</button>
        <button id="grok-discard-btn">Discard</button>
      </div>
    `;
    document.body.appendChild(panel);
    document.getElementById('grok-side-panel-close').onclick = () => panel.remove();
  }
  panel.style.display = 'flex';
}

// --- Testron AI Copilot-inspired premium features ---
let grokActions = [];
let recording = false;
let code = '';
let highlightBox = null;
let serverProcess = null;

function renderActions() {
  const list = document.getElementById('grok-action-list');
  if (!list) return;
  if (!grokActions.length) { list.textContent = 'No actions yet.'; return; }
  list.innerHTML = grokActions.map((a, i) => `<div class="grok-action-item" data-index="${i}"><b>${i+1}.</b> <span style="color:#00c6ff">[${a.event}]</span> <span style="color:#b5e0ff">${a.locator || a.tag}</span> <span style="color:#aaa">${a.value ? '= ' + a.value : ''}</span></div>`).join('');
}

function highlightElement(el) {
  if (highlightBox) highlightBox.remove();
  if (!el || !recording) return;
  highlightBox = document.createElement('div');
  const rect = el.getBoundingClientRect();
  highlightBox.style.position = 'fixed';
  highlightBox.style.left = rect.left + 'px';
  highlightBox.style.top = rect.top + 'px';
  highlightBox.style.width = rect.width + 'px';
  highlightBox.style.height = rect.height + 'px';
  highlightBox.style.border = '2.5px solid #00c6ff';
  highlightBox.style.borderRadius = '6px';
  highlightBox.style.zIndex = 2147483646;
  highlightBox.style.pointerEvents = 'none';
  highlightBox.style.boxShadow = '0 0 16px #00c6ff88';
  document.body.appendChild(highlightBox);
  setTimeout(() => { if (highlightBox) highlightBox.remove(); }, 900);
}

function addAction(action) {
  if (!recording) return;
  if (action.targetElement) {
    action.locator = getBestLocator(action.targetElement);
    highlightElement(action.targetElement);
    delete action.targetElement;
  }
  grokActions.push(action);
  renderActions();
  // Send actions to background for AI code gen
  chrome.runtime.sendMessage({ type: 'USER_ACTIONS', actions: grokActions }, (resp) => {
    if (resp && resp.code) {
      code = resp.code;
      const codeBlock = document.getElementById('grok-code-block');
      codeBlock.style.display = 'block';
      codeBlock.textContent = code;
    }
  });
}

// --- Advanced locator strategy: show why a locator was chosen ---
function getBestLocator(el) {
  if (!el) return null;
  // 1. Try data-testid or data-test
  const testId = el.getAttribute('data-testid') || el.getAttribute('data-test');
  if (testId) return `[data-testid="${testId}"] // preferred: data-testid`;
  // 2. Try aria-label or role
  const aria = el.getAttribute('aria-label');
  if (aria) return `[aria-label="${aria}"] // preferred: aria-label`;
  const role = el.getAttribute('role');
  if (role) return `[role="${role}"] // preferred: role`;
  // 3. Unique visible text (for buttons/links/labels)
  if (['BUTTON', 'A', 'LABEL'].includes(el.tagName) && el.innerText) {
    const text = el.innerText.trim().replace(/\s+/g, ' ');
    if (text && document.evaluate(`count(//*[text()='${text}'])`, document, null, XPathResult.NUMBER_TYPE, null).numberValue === 1) {
      return `${el.tagName}:has-text(\"${text}\") // unique text`;
    }
  }
  // 4. Unique name or placeholder
  if (el.name && document.querySelectorAll(`[name="${el.name}"]`).length === 1) {
    return `[name="${el.name}"] // unique name`;
  }
  const placeholder = el.getAttribute('placeholder');
  if (placeholder && document.querySelectorAll(`[placeholder="${placeholder}"]`).length === 1) {
    return `[placeholder="${placeholder}"] // unique placeholder`;
  }
  // 5. Stable and meaningful CSS IDs
  if (el.id && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
    return `#${el.id} // unique id`;
  }
  // 6. Tag/class/attribute combinations
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.split(/\s+/).filter(Boolean);
    for (const cls of classes) {
      if (document.querySelectorAll(`.${CSS.escape(cls)}`).length === 1) {
        return `.${cls} // unique class`;
      }
    }
  }
  // 7. XPath (last resort)
  let path = '';
  let curr = el;
  while (curr && curr.nodeType === 1 && curr !== document.body) {
    let selector = curr.tagName.toLowerCase();
    if (curr.id) {
      selector += `#${curr.id}`;
      path = selector + (path ? '>' + path : '');
      break;
    } else {
      let sib = curr, nth = 1;
      while ((sib = sib.previousElementSibling)) nth++;
      selector += `:nth-child(${nth})`;
      path = selector + (path ? '>' + path : '');
      curr = curr.parentElement;
    }
  }
  return path ? `${path} // fallback: nth-child` : null;
}

['click', 'input', 'change', 'dblclick'].forEach(evt => {
  document.addEventListener(evt, (e) => {
    if (!document.getElementById('grok-side-panel')) return;
    const target = e.target;
    addAction({
      event: evt,
      tag: target.tagName,
      id: target.id,
      class: target.className,
      name: target.name,
      value: target.value || undefined,
      text: target.innerText || undefined,
      timestamp: Date.now(),
      targetElement: target
    });
  }, true);
});

function setRecording(on) {
  recording = on;
  const startBtn = document.getElementById('grok-start-btn');
  const stopBtn = document.getElementById('grok-stop-btn');
  if (startBtn && stopBtn) {
    startBtn.disabled = on;
    stopBtn.disabled = !on;
  }
  // Visual feedback for recording state
  const header = document.getElementById('grok-side-panel-header');
  if (header) header.style.boxShadow = on ? '0 0 16px #00c6ff88' : '';
}
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'grok-start-btn') setRecording(true);
  if (e.target && e.target.id === 'grok-stop-btn') setRecording(false);
});

// Remove popup trigger and always use side panel
// Add keyboard shortcut to open side panel (Ctrl+Shift+Y)
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'y') {
    createOrShowSidePanel();
  }
});

// Optionally, auto-open panel on page load for demo
document.addEventListener('DOMContentLoaded', createOrShowSidePanel);

// --- Server control functions ---
function updateServerStatus() {
  fetch('http://localhost:34567/status')
    .then(response => response.json())
    .then(data => {
      const statusEl = document.getElementById('grok-server-status-value');
      if (statusEl) {
        statusEl.textContent = data.running ? 'Running' : 'Stopped';
        statusEl.style.color = data.running ? '#5fff5f' : '#ff5f5f';
      }
    })
    .catch(err => console.error('Error fetching server status:', err));
}

function startServer() {
  if (serverProcess) return;
  fetch('http://localhost:34567/status')
    .then(() => updateServerStatus())
    .catch(() => {
      // Try to start the server using a VS Code command (requires user to allow Node.js execution)
      chrome.runtime.sendMessage({ type: 'START_VSCODE_SERVER' });
    });
}

// Add Start Server button to the side panel footer
function addStartServerButton() {
  const footer = document.getElementById('grok-side-panel-footer');
  if (!footer || document.getElementById('grok-start-server-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'grok-start-server-btn';
  btn.className = 'btn';
  btn.textContent = 'Start VS Code Server';
  btn.onclick = startServer;
  footer.insertBefore(btn, footer.firstChild);
}

document.addEventListener('DOMContentLoaded', addStartServerButton);
