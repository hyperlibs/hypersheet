const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = parseInt(process.argv[2] || '8769', 10);
const ROOT = path.resolve(__dirname, '..', '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

http.createServer((req, res) => {
  let filePath = path.join(ROOT, req.url === '/' ? '/demo/index.html' : req.url);
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err) {
      filePath = path.join(ROOT, 'demo', 'index.html');
      return fs.stat(filePath, (err2, stat2) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': stat2.size });
        fs.createReadStream(filePath).pipe(res);
      });
    }
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      return fs.stat(filePath, (err2, stat2) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': stat2.size });
        fs.createReadStream(filePath).pipe(res);
      });
    }
    res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size });
    fs.createReadStream(filePath).pipe(res);
  });
}).listen(PORT, () => {
  console.log(`Serving ${ROOT} on http://localhost:${PORT}`);
});
