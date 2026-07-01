const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8769;
const ROOT = process.cwd();

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

http.createServer((req, res) => {
  let file = req.url === '/' ? 'demo/index.html' : req.url.replace(/^\//, '');
  let filePath = path.resolve(ROOT, file);
  // Security: must resolve within project root
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    let content = fs.readFileSync(filePath);
    let ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  } catch (e) {
    res.writeHead(404);
    res.end('Not Found');
  }
}).listen(PORT, () => console.log(`Server on ${PORT}`));
