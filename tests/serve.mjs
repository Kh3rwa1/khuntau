import http from 'http'; import fs from 'fs'; import path from 'path';
const root = process.cwd() + '/public';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.mp3': 'audio/mpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/json', '.jpg': 'image/jpeg' };
http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/index.html') { r.writeHead(307, { location: '/' }); return r.end(); } // as the real host does; a service worker that saves this redirect breaks offline
  if (u === '/') u = '/index.html'; const f = path.join(root, u);
  if (u.startsWith('/api') || !f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end('no'); }
  r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8791, '127.0.0.1');
