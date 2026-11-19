import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { load } from 'cheerio';

const manifest = JSON.parse(await fs.readFile('snapshot/manifest.json', 'utf8'));
const errors = [];
const warnings = new Set();
let checkedLinks = 0;
const cache = new Map();
async function read(file) { if (!cache.has(file)) cache.set(file, await fs.readFile('dist/' + file, 'utf8')); return cache.get(file); }

async function checkRef(value, file) {
  if (!value || /^(?:data:|mailto:|tel:)/i.test(value)) return;
  if (/^javascript:|(?:typo3|tx_theme_frontend|requirejs|\.php(?:\?|$))/i.test(value)) { errors.push(`${file}: CMS reference ${value}`); return; }
  const u = new URL(value.replaceAll('&amp;', '&'), 'https://static.example/' + file);
  if (u.origin !== 'https://static.example') {
    if (/treehouse-camp\.eu/.test(u.hostname)) errors.push(`${file}: original-site dependency ${value}`);
    return;
  }
  const target = decodeURIComponent(u.pathname).slice(1) || 'index.html';
  try { await fs.access('dist/' + target); checkedLinks++; }
  catch { errors.push(`${file}: missing ${value}`); return; }
  if (/\.html$/.test(target) && u.hash) {
    const text = await read(target);
    const fragment = decodeURIComponent(u.hash.slice(1));
    const $ = load(text);
    if (!$('[id]').toArray().some(e => $(e).attr('id') === fragment)) warnings.add(`${file}: original anchor missing ${target}#${fragment}`);
  }
}

const normalizedText = $ => {
  const copy = load($.html());
  copy('script, style, .skip-link, .menu-close, .submenu-toggle, .filter-status, input').remove();
  return copy('body').text().replace(/sk-spamprotection/g, '').replace(/\s+/g, ' ').trim();
};

for (const r of manifest.records.filter(r => r.type === 'page')) {
  const file = r.file.slice(6);
  const source = load(await fs.readFile('snapshot/' + r.file, 'utf8'));
  const text = await read(file), $ = load(text);
  try { assert.equal(normalizedText($), normalizedText(source)); }
  catch { errors.push(`${file}: visible text differs from source`); }
  if ($('script').length !== 1 || $('script').attr('src')?.endsWith('assets/app.js') !== true) errors.push(`${file}: unexpected scripts`);
  if ($('input[type="hidden"]').length || $('[action*="tx_theme"]').length || $('meta[name="generator"]').length) errors.push(`${file}: CMS state remains`);
  for (const el of $('*').toArray()) {
    for (const attr of ['href','xlink:href','src','poster','data-href']) if ($(el).attr(attr)) await checkRef($(el).attr(attr), file);
    if ($(el).attr('srcset')) for (const item of $(el).attr('srcset').split(',')) await checkRef(item.trim().split(/\s+/)[0], file);
    if ($(el).attr('style')) for (const match of $(el).attr('style').matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)) await checkRef(match[1], file);
  }
}
for (const r of manifest.records.filter(r => r.file.endsWith('.css'))) {
  const text = await read(r.file);
  for (const match of text.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gs)) await checkRef(match[2], r.file);
}
console.log(`Checked ${manifest.records.filter(r => r.type === 'page').length} pages; ${checkedLinks} local references; full page text preserved.`);
console.log(`Warnings: ${warnings.size}`);
for (const warning of warnings) console.log(warning);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('PASS: No missing local files, CMS runtime dependencies, or changed page text.');
