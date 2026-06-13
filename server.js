const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = process.env.PORT || 8650;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.yml': 'text/yaml; charset=utf-8', '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  let fp = path.join(root, p);
  if (!fp.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(fp, (err, st) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    if (st.isDirectory()) fp = path.join(fp, 'index.html');
    fs.readFile(fp, (e, data) => {
      if (e) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': types[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
}).listen(port, () => console.log('SDOH ART site serving ' + root + ' on http://localhost:' + port));
