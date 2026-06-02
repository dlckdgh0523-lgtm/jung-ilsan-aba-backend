// Dev-only static server for the frontend kit. Serves the design-system root so the
// relative ../../assets/ image paths resolve. Run: node serve-frontend.mjs <root>
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, resolve } from 'node:path';

const ROOT = resolve(process.argv[2] || process.cwd());
const PORT = Number(process.argv[3] || 5173);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon',
};

http
  .createServer(async (req, res) => {
    try {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const fp = join(ROOT, normalize(p));
      if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
      const s = await stat(fp).catch(() => null);
      if (!s || !s.isFile()) { res.writeHead(404); res.end('not found'); return; }
      const buf = await readFile(fp);
      res.writeHead(200, { 'Content-Type': MIME[extname(fp).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(buf);
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  })
  .listen(PORT, () => console.log(`frontend dev server: http://localhost:${PORT}  (root=${ROOT})`));
