#!/usr/bin/env node
// 開発用の静的サーバ（依存ゼロ・Node 標準のみ）。vercel.json の cleanUrls / trailingSlash:false を再現する。
//   node tools/serve.mjs [port]     既定 3000。Ctrl+C で停止。
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, dirname, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 3000);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf', '.woff2': 'font/woff2',
};

const isFile = async (p) => { try { return (await stat(p)).isFile(); } catch { return false; } };

async function resolvePath(urlPath) {
  // ルート外への脱出を防ぐ
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^([/\.]+)/, '');
  const base = join(ROOT, rel);
  if (!base.startsWith(ROOT)) return null;
  if (urlPath === '/' || urlPath === '') return join(ROOT, 'index.html');
  if (await isFile(base)) return base;
  if (await isFile(`${base}.html`)) return `${base}.html`;          // cleanUrls
  if (await isFile(join(base, 'index.html'))) return join(base, 'index.html');
  return null;
}

createServer(async (req, res) => {
  const urlPath = new URL(req.url, `http://localhost:${PORT}`).pathname;
  // trailingSlash: false — /about/ は /about へ 308
  if (urlPath.length > 1 && urlPath.endsWith('/')) {
    res.writeHead(308, { Location: urlPath.replace(/\/+$/, '') }).end();
    return;
  }
  const file = await resolvePath(urlPath);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found');
    console.log(`404 ${urlPath}`);
    return;
  }
  const body = await readFile(file);
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  }).end(body);
  console.log(`200 ${urlPath}`);
}).listen(PORT, () => {
  console.log(`ちるーむ dev server: http://localhost:${PORT}  (Ctrl+C で停止)`);
});
