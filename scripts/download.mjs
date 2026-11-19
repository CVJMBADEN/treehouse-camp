import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const origin = 'https://treehouse-camp.eu';
const root = path.resolve('snapshot');
await fs.mkdir(root, { recursive: true });
const records = new Map();
const failures = [];
const external = new Set();
let queue = [origin + '/index.html'];

function normalize(value, base) {
  if (!value || /^(?:#|data:|mailto:|tel:|javascript:)/i.test(value)) return null;
  try {
    const u = new URL(value.replaceAll('&amp;', '&'), base);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (u.hostname.replace(/^www\./, '') !== 'treehouse-camp.eu') { external.add(u.href); return null; }
    u.protocol = 'https:'; u.hostname = 'treehouse-camp.eu'; u.hash = '';
    if (u.pathname === '/') u.pathname = '/index.html';
    return u.href;
  } catch { return null; }
}

export function references(text, css = false) {
  const refs = [];
  if (!css) {
    for (const m of text.matchAll(/\b(?:href|src|poster|data-src|data-background|data-original)\s*=\s*(["'])(.*?)\1/gs)) refs.push(m[2]);
    for (const m of text.matchAll(/\bsrcset\s*=\s*(["'])(.*?)\1/gs)) for (const item of m[2].split(',')) refs.push(item.trim().split(/\s+/)[0]);
  }
  for (const m of text.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gs)) refs.push(m[2]);
  return refs;
}

function include(url) {
  const u = new URL(url);
  if (/\/(?:typo3|typo3conf|typo3temp)\//.test(u.pathname) && /\.(?:js|php)$/i.test(u.pathname)) return false;
  if (/\.php$|\/(?:login|logout|admin)\/?$/i.test(u.pathname) || u.search) return false;
  return /\.[a-z0-9]{2,5}$/i.test(u.pathname);
}

async function download(url) {
  const u = new URL(url);
  const isPage = /\.html?$/i.test(u.pathname);
  const ext = path.extname(u.pathname).toLowerCase();
  const name = isPage ? 'pages' + decodeURIComponent(u.pathname) : 'assets/' + createHash('sha256').update(url).digest('hex').slice(0,12) + '-' + decodeURIComponent(path.basename(u.pathname)).replace(/[^a-zA-Z0-9._-]/g, '_');
  let data;
  try {
    data = await fs.readFile(path.join(root, name));
  } catch {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}`);
          error.permanent = response.status >= 400 && response.status < 500;
          throw error;
        }
        data = Buffer.from(await response.arrayBuffer());
        await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
        await fs.writeFile(path.join(root, name), data);
        break;
      } catch (error) { lastError = error; if (error.permanent) break; }
    }
    if (!data) { failures.push({ url, error: String(lastError) }); return []; }
  }
  records.set(url, { url, file: name, type: isPage ? 'page' : 'asset', bytes: data.length });
  if (isPage || ['.css', '.svg'].includes(ext)) {
    return references(data.toString('utf8'), ext === '.css').map(v => normalize(v, url)).filter(v => v && include(v));
  }
  return [];
}

const seen = new Set(queue);
while (queue.length) {
  const batch = queue.splice(0, 8);
  const found = await Promise.all(batch.map(download));
  for (const url of found.flat()) if (!seen.has(url)) { seen.add(url); queue.push(url); }
  if (records.size % 40 < 8 || !queue.length) console.log(`Downloaded ${records.size}; queued ${queue.length}; failed ${failures.length}`);
}
const manifest = { origin, downloadedAt: new Date().toISOString(), records: [...records.values()].sort((a,b) => a.url.localeCompare(b.url)), failures, external: [...external].sort() };
await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ pages: manifest.records.filter(r => r.type === 'page').length, assets: manifest.records.filter(r => r.type === 'asset').length, failures, external: manifest.external }, null, 2));
