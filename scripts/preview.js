import http from 'node:http';
import { readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from './build-site.js';

await buildSite();
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif' };
const prefix = '/lutra3d/';
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/') { response.writeHead(302, { Location: prefix }); response.end(); return; }
    if (!url.pathname.startsWith(prefix)) { response.writeHead(404); response.end('Not found'); return; }
    const relative = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
    const file = path.resolve(root, relative);
    const rel = path.relative(root, file);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Invalid path');
    // The build produces no symlinks, but also guard against later local edits.
    let current = root;
    for (const part of rel.split(path.sep)) { current = path.join(current, part); if ((await lstat(current)).isSymbolicLink()) throw new Error('Invalid path'); }
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': `${types[path.extname(file)] || 'application/octet-stream'}${/\.(html|css|js|json)$/.test(file) ? '; charset=utf-8' : ''}`, 'Cache-Control': 'no-cache' });
    response.end(body);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`Preview: http://localhost:${server.address().port}${prefix}`));
