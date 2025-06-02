// Handles UI in the popup
const output = document.getElementById('output');
const copyBtn = document.getElementById('copy');
const insertBtn = document.getElementById('insert-btn');
const filePathInput = document.getElementById('file-path');
const serverStatus = document.getElementById('server-status-value');
const actionList = document.getElementById('action-list');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const confirmBar = document.getElementById('confirm-bar');
const confirmPath = document.getElementById('confirm-path');
const keepBtn = document.getElementById('keep-btn');
const discardBtn = document.getElementById('discard-btn');

let actions = [];
let code = '';
let recording = false;
let lastInsertedPath = '';

function updateServerStatus() {
  fetch('http://localhost:34567/status')
    .then(r => r.json())
    .then(d => { serverStatus.textContent = d.status.includes('Error') ? 'Error' : 'Online'; serverStatus.style.color = d.status.includes('Error') ? 'red' : '#00c6ff'; })
    .catch(() => { serverStatus.textContent = 'Offline'; serverStatus.style.color = 'red'; });
}
updateServerStatus();
setInterval(updateServerStatus, 3000);

function renderActions() {
  if (!actions.length) { actionList.textContent = 'No actions yet.'; return; }
  actionList.innerHTML = actions.map((a, i) => `<div class="action-item">${i+1}. [${a.event}] ${a.locator || a.tag}</div>`).join('');
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.code) { code = msg.code; output.textContent = code; }
  if (msg.actions) { actions = msg.actions; renderActions(); }
});

copyBtn.onclick = () => { if (code) navigator.clipboard.writeText(code); };

insertBtn.onclick = () => {
  if (!code) return alert('No code to insert!');
  const filePath = filePathInput.value.trim();
  if (!filePath) return alert('Please enter a file path!');
  fetch('http://localhost:34567/insert-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, filePath })
  })
    .then(r => r.json())
    .then(res => {
      if (res.status === 'ok') {
        lastInsertedPath = filePath;
        confirmPath.textContent = filePath;
        confirmBar.style.display = 'flex';
      } else {
        alert('Insert failed: ' + (res.error || 'Unknown error'));
      }
    })
    .catch(e => alert('Insert failed: ' + e.message));
};

keepBtn.onclick = () => { confirmBar.style.display = 'none'; };
discardBtn.onclick = () => {
  if (!lastInsertedPath) return;
  fetch('http://localhost:34567/insert-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: '', filePath: lastInsertedPath })
  }).then(() => { confirmBar.style.display = 'none'; });
};

startBtn.onclick = () => { recording = true; startBtn.disabled = true; stopBtn.disabled = false; };
stopBtn.onclick = () => { recording = false; startBtn.disabled = false; stopBtn.disabled = true; };
