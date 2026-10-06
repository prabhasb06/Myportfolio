const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.argv[2] || 4174);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Choose a port between 1024 and 65535.');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon' };

http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
  catch { res.writeHead(400); res.end(); return; }
  const parts = pathname.split(/[\\/]/);
  const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!filename.startsWith(root + path.sep) || parts.some(part => part.startsWith('.')) || pathname.includes('\0')) {
    res.writeHead(403); res.end(); return;
  }
  const send = (file, status) => fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) {
      if (status === 200) { send(path.join(root, '404.html'), 404); return; }
      res.writeHead(404); res.end('Page not found'); return;
    }
    res.writeHead(status, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
  send(filename, 200);
}).listen(port, '127.0.0.1', () => console.log(`Portfolio preview: http://127.0.0.1:${port}/`));
