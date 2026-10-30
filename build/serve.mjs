// Tiny static server for local tests: http://localhost:47631/monkey-rampage/
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = path.resolve(new URL('..', import.meta.url).pathname); const PORT = 47631;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.mjs': 'text/javascript' };
http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split('?')[0]).replace(/^\/monkey-rampage/, ''); if (u.endsWith('/')) u += 'index.html';
  const f = path.join(ROOT, u); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(PORT, () => console.log('serving', ROOT, 'on', PORT));
