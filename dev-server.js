// Servidor local: entrega o site compilado (dist) e as funções de /api,
// do mesmo jeito que o Vercel faz. Uso: npm run build && npm run serve
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PORT = Number(process.env.PORT || 3000);
const DIST = path.resolve('dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };
const cache = {};

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const m = u.pathname.match(/^\/api\/([a-z-]+)$/);
  if (m) {
    const file = path.resolve('api', m[1] + '.js');
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('{}'); }
    cache[file] = cache[file] || (await import(pathToFileURL(file).href)).default;
    return cache[file](req, res);
  }
  let p = path.join(DIST, decodeURIComponent(u.pathname));
  if (!p.startsWith(DIST) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIST, 'index.html');
  res.setHeader('Content-Type', TYPES[path.extname(p)] || 'application/octet-stream');
  fs.createReadStream(p).pipe(res);
}).listen(PORT, () => console.log('Convite Interativo em http://localhost:' + PORT + ' (senha local: convite)'));
