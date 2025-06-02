// Injected into every page to listen for user actions
function sendAction(action) {
  chrome.runtime.sendMessage({ type: 'USER_ACTION', action });
}
document.addEventListener('click', (e) => {
  sendAction({ event: 'click', tag: e.target.tagName, id: e.target.id, class: e.target.className });
});
// Add more listeners as needed

// Inject a side panel UI into the page
function createSidePanel() {
  if (document.getElementById('grak-side-panel')) return;
  const panel = document.createElement('div');
  panel.id = 'grak-side-panel';
  panel.innerHTML = `
    <style>
      #grak-side-panel {
        position: fixed;
        top: 0; right: 0;
        width: 400px; height: 100vh;
        background: linear-gradient(135deg, #232526 0%, #414345 100%);
        color: #fff;
        box-shadow: -2px 0 16px rgba(0,0,0,0.2);
        z-index: 999999;
        font-family: 'Segoe UI', Arial, sans-serif;
        display: flex; flex-direction: column;
        border-radius: 8px 0 0 8px;
        transition: transform 0.3s cubic-bezier(.4,2,.6,1);
      }
      #grak-side-panel-header {
        padding: 18px 24px;
        font-size: 1.3em;
        font-weight: 600;
        background: rgba(0,0,0,0.12);
        border-bottom: 1px solid #333;
        display: flex; align-items: center; justify-content: space-between;
      }
      #grak-side-panel-close {
        background: none; border: none; color: #fff; font-size: 1.2em; cursor: pointer;
      }
      #grak-side-panel-body {
        flex: 1; overflow-y: auto; padding: 18px 24px;
      }
      #grak-side-panel-footer {
        padding: 12px 24px; border-top: 1px solid #333; background: rgba(0,0,0,0.10);
        display: flex; justify-content: flex-end;
      }
      #grak-copy-btn {
        background: #00c6ff; color: #fff; border: none; border-radius: 4px; padding: 8px 18px; font-size: 1em; cursor: pointer; font-weight: 500;
        box-shadow: 0 2px 8px rgba(0,198,255,0.08);
        transition: background 0.2s;
      }
      #grak-copy-btn:hover { background: #0072ff; }
      .grak-action-item { margin-bottom: 10px; padding: 8px 12px; background: #2c2f34; border-radius: 4px; font-size: 0.98em; }
      .grak-code-block { background: #181a1b; color: #b5e0ff; border-radius: 4px; padding: 12px; font-family: 'Fira Mono', 'Consolas', monospace; font-size: 0.97em; margin-top: 10px; white-space: pre; }
    </style>
    <div id="grak-side-panel-header">
      <span>Grak AI DOM Recorder</span>
      <button id="grak-side-panel-close">×</button>
    </div>
    <div id="grak-side-panel-body">
      <div id="grak-action-list"></div>
      <div id="grak-code-block" class="grak-code-block" style="display:none;"></div>
    </div>
    <div id="grak-side-panel-footer">
      <button id="grak-copy-btn">Copy Code</button>
    </div>
  `;
  document.body.appendChild(panel);
  document.getElementById('grak-side-panel-close').onclick = () => panel.remove();
  document.getElementById('grak-copy-btn').onclick = () => {
    const code = document.getElementById('grak-code-block').textContent;
    if (code) navigator.clipboard.writeText(code);
  };
}

// Utility: Get the best unique locator for an element
function getBestLocator(el) {
  if (!el) return null;
  // 1. Try data-testid or data-test attributes
  const testId = el.getAttribute('data-testid') || el.getAttribute('data-test');
  if (testId) return `[data-testid="${testId}"]`;
  // 2. Try unique ID
  if (el.id && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
    return `#${el.id}`;
  }
  // 3. Try unique name
  if (el.name && document.querySelectorAll(`[name="${el.name}"]`).length === 1) {
    return `[name="${el.name}"]`;
  }
  // 4. Try unique class
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.split(/\s+/).filter(Boolean);
    for (const cls of classes) {
      if (document.querySelectorAll(`.${CSS.escape(cls)}`).length === 1) {
        return `.${cls}`;
      }
    }
  }
  // 5. Try text content for buttons/links/labels
  if (['BUTTON', 'A', 'LABEL'].includes(el.tagName) && el.innerText) {
    const text = el.innerText.trim().replace(/\s+/g, ' ');
    if (text && document.evaluate(`count(//*[text()='${text}'])`, document, null, XPathResult.NUMBER_TYPE, null).numberValue === 1) {
      return `${el.tagName}:has-text(\"${text}\")`;
    }
  }
  // 6. Fallback: nth-child selector
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
  return path;
}

// Maintain a list of actions
let grakActions = [];
function addAction(action) {
  grakActions.push(action);
  const list = document.getElementById('grak-action-list');
  if (list) {
    const item = document.createElement('div');
    item.className = 'grak-action-item';
    item.textContent = `[${action.event}] ${action.tag}${action.id ? '#' + action.id : ''}${action.class ? '.' + action.class : ''}`;
    list.appendChild(item);
  }
  // Send actions to background for AI code gen
  chrome.runtime.sendMessage({ type: 'USER_ACTIONS', actions: grakActions }, (resp) => {
    if (resp && resp.code) {
      const codeBlock = document.getElementById('grak-code-block');
      codeBlock.style.display = 'block';
      codeBlock.textContent = resp.code;
    }
  });
  if (action.targetElement) {
    action.locator = getBestLocator(action.targetElement);
    delete action.targetElement;
  }
}

// Listen for user actions (click, input, change, dblclick, etc.)
['click', 'input', 'change', 'dblclick'].forEach(evt => {
  document.addEventListener(evt, (e) => {
    if (!document.getElementById('grak-side-panel')) return;
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

// Add keyboard shortcut to open side panel (Ctrl+Shift+Y)
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'y') {
    createSidePanel();
  }
});

// Optionally, auto-open panel on page load for demo
document.addEventListener('DOMContentLoaded', createSidePanel);
