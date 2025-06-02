// Node.js server to receive code from Chrome extension and write to VS Code workspace
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 34567;
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

let lastStatus = 'idle';

app.post('/insert-code', async (req, res) => {
  const { code, filePath } = req.body;
  if (!code || !filePath) {
    return res.status(400).json({ error: 'Missing code or filePath' });
  }
  const absPath = path.join(WORKSPACE_ROOT, filePath);
  try {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, code, 'utf8');
    lastStatus = `Inserted code to ${filePath}`;
    return res.json({ status: 'ok', filePath });
  } catch (e) {
    lastStatus = `Error: ${e.message}`;
    return res.status(500).json({ error: e.message });
  }
});

app.get('/status', (req, res) => {
  res.json({ status: lastStatus });
});

app.listen(PORT, () => {
  console.log(`VS Code Code Insert Server running on http://localhost:${PORT}`);
});
