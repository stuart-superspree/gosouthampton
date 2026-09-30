// Zero-dependency static server for local testing and as a fallback host.
// Mirrors the Caddyfile: serves ./site, rewrites /t/* to the app, gzip for text,
// security headers, the same cache rules with ETag revalidation, and reads the
// port from $PORT (never hardcoded). Works on Windows, macOS and Linux, and from
// folders whose names contain spaces.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('./site/', import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ics': 'text/calendar; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon' };
const COMPRESS = /\.(html|css|js|mjs|json|webmanifest|svg|ics|csv|txt)$/;
const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'";

// Returns the URL path to serve (always with forward slashes) and the file on disk.
function resolve(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  if (/^\/t\/[A-Za-z0-9]+\/?$/.test(p)) p = '/index.html';
  p = path.posix.normalize(p);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, ...p.split('/'));
  if (!file.startsWith(ROOT)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) return { rel: `${p}/index.html`, file: path.join(file, 'index.html') };
  return { rel: p, file };
}

http.createServer((req, res) => {
  const hit = resolve(req.url || '/');
  const rel = hit ? hit.rel : '';
  // As in the Caddyfile: page-level policies go on documents only, the worker gets its own CSP.
  const isAsset = /\.(js|css|json|woff2|webp|png|webmanifest|csv|ics|txt)$/.test(rel);
  const headers = { 'X-Content-Type-Options': 'nosniff' };
  if (!isAsset) Object.assign(headers, { 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Content-Security-Policy': CSP, 'Permissions-Policy': 'geolocation=(), camera=(), microphone=()' });
  if (rel === '/sw.js') headers['Content-Security-Policy'] = "default-src 'self'";
  if (!hit || !fs.existsSync(hit.file) || fs.statSync(hit.file).isDirectory()) {
    const nf = path.join(ROOT, '404.html');
    res.writeHead(404, { ...headers, 'Content-Security-Policy': CSP, 'Content-Type': TYPES['.html'] });
    return res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'Not found');
  }
  const { file } = hit;
  const ext = path.extname(file);
  const type = TYPES[ext] || 'application/octet-stream';
  // Same rules as the Caddyfile: app code, data and strings revalidate on every
  // load (a cheap 304 via ETag); fonts and images can be cached for a day.
  const cache = /^\/(fonts|img)\//.test(rel) ? 'public, max-age=86400' : 'no-cache';
  const st = fs.statSync(file);
  const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
  const h = { ...headers, 'Content-Type': type, 'Cache-Control': cache, Vary: 'Accept-Encoding', ETag: etag };
  if (rel === '/sw.js') h['Service-Worker-Allowed'] = '/';
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, h); return res.end(); }
  let body = fs.readFileSync(file);
  if (COMPRESS.test(rel) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) { body = zlib.gzipSync(body, { level: 6 }); h['Content-Encoding'] = 'gzip'; }
  res.writeHead(200, h);
  res.end(req.method === 'HEAD' ? undefined : body);
}).listen(PORT, () => console.log(`RouteLoop demo on http://localhost:${PORT}  (demo panel: /?demo=1, admin: /admin/)`));
