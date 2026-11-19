import fs from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';

const manifest = JSON.parse(await fs.readFile('snapshot/manifest.json', 'utf8'));
const records = new Map(manifest.records.map(r => [r.url, r]));
const pages = manifest.records.filter(r => r.type === 'page');
const repairs = [];
const unresolved = [];
const relative = (from, to) => path.posix.relative(path.posix.dirname(from), to) || path.posix.basename(to);
const output = r => r.type === 'page' ? r.file.slice(6) : r.file;

function recordFor(value, base) {
  try {
    const u = new URL(value.replaceAll('&amp;', '&'), base);
    if (u.hostname.replace(/^www\./, '') !== 'treehouse-camp.eu') return null;
    u.protocol = 'https:'; u.hostname = 'treehouse-camp.eu';
    if (u.pathname === '/') u.pathname = '/index.html';
    u.hash = ''; u.search = '';
    return records.get(u.href);
  } catch { return null; }
}

function rewrite(value, base, destination) {
  if (!value || /^(?:#|data:|mailto:|tel:)/i.test(value)) return value;
  const r = recordFor(value, base);
  if (r) return relative(destination, output(r)) + new URL(value.replaceAll('&amp;', '&'), base).hash;
  return value;
}

await fs.mkdir('dist/assets', { recursive: true });
for (const r of manifest.records.filter(r => r.type === 'asset')) {
  let data = await fs.readFile('snapshot/' + r.file);
  if (/\.(css|svg)$/i.test(r.file)) {
    let text = data.toString('utf8');
    text = text.replace(/url\(\s*(["']?)(.*?)\1\s*\)/gs, (all, quote, value) => {
      // Fix an invalid exported filter and legacy font URLs in the original stylesheet.
      if (value === 'frontend.min.css') return 'none';
      value = value.replace(/\.eot%3F$/i, '.eot');
      return `url(${quote}${rewrite(value, r.url, r.file)}${quote})`;
    }).replace(/\/\*# sourceMappingURL=.*?\*\//g, '');
    data = text;
  }
  await fs.writeFile('dist/' + r.file, data);
}

for (const r of pages) {
  const destination = output(r);
  let original = await fs.readFile('snapshot/' + r.file, 'utf8');
  original = original.replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  const $ = load(original);
  $('script, meta[name="generator"], meta[http-equiv="x-ua-compatible"], base').remove();
  $('html').attr('lang', 'en').removeAttr('xml:lang');
  $('meta[name="viewport"]').attr('content', 'width=device-width, initial-scale=1');
  // Keep the source site's noindex setting until its owner chooses to enable indexing.
  $('*').contents().filter((_, e) => e.type === 'comment' && /TYPO3|CDATA/.test(e.data)).remove();
  $('span').filter((_, e) => $(e).text() === 'sk-spamprotection').remove();
  $('a[href^="javascript:"]').each((_, e) => {
    const a = $(e);
    if (/linkTo_UnCryptMailto/.test(a.attr('href'))) {
      const text = a.text().trim();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) a.attr('href', 'mailto:' + text);
      else throw new Error('Unrecognized email link: ' + text);
    } else a.removeAttr('href');
  });

  $('source[srcset]').each((_, e) => {
    const valid = $(e).attr('srcset').split(',').filter(v => recordFor(v.trim().split(/\s+/)[0], r.url));
    if (!valid.length) $(e).remove();
    else $(e).attr('srcset', valid.join(','));
  });

  $('a[href]').each((_, e) => {
    const a = $(e); const href = a.attr('href');
    if (/fileadmin\//.test(href) && !recordFor(href, r.url)) {
      const img = a.find('img').first();
      if (img.length && recordFor(img.attr('src'), r.url)) {
        repairs.push({ page: destination, missing: href, replacement: img.attr('src') });
        a.attr('href', img.attr('src'));
      } else unresolved.push({ page: destination, url: href });
    }
  });

  $('*').each((_, e) => {
    const el = $(e);
    for (const attr of ['href', 'xlink:href', 'src', 'poster']) {
      const value = el.attr(attr);
      if (value) el.attr(attr, rewrite(value, r.url, destination));
    }
    if (el.attr('srcset')) el.attr('srcset', el.attr('srcset').split(',').map(v => {
      const [url, ...size] = v.trim().split(/\s+/);
      return [rewrite(url, r.url, destination), ...size].join(' ');
    }).join(', '));
    if (el.attr('style')) el.attr('style', el.attr('style').replace(/url\((["']?)(.*?)\1\)/g, (_, q, url) => `url(${q}${rewrite(url, r.url, destination)}${q})`));
    for (const name of Object.keys(e.attribs || {})) if (/^on/i.test(name)) el.removeAttr(name);
  });

  // Remove TYPO3 form state. Categories are read from the existing competency links.
  $('form[name="categories"]').each((_, e) => {
    const form = $(e);
    form.attr('data-component-filter', '').removeAttr('action').removeAttr('enctype').removeAttr('name');
    form.find('input[type="hidden"]').remove();
    form.find('input[type="checkbox"]').attr('name', 'category');
    form.append('<p class="filter-status" role="status" aria-live="polite"></p>');
    const categories = new Map();
    const normalize = text => text.toLowerCase().replace(/[^a-z0-9]/g, '');
    form.find('label').each((_, label) => categories.set(normalize($(label).text()), $(label).find('input').attr('id')));
    $('#c72 > .container > section > .tx_theme_frontend > .accordion > .accordionItem').each((_, item) => {
      const keys = new Set();
      $(item).find('a[href*="key-competences.html#"]').each((_, link) => {
        const key = categories.get(normalize($(link).text()));
        if (key) keys.add(key);
        else throw new Error('Unknown competency ' + $(link).text());
      });
      $(item).attr('data-categories', [...keys].join(' '));
    });
    if (!$('[data-categories]').length) throw new Error('Component filter content not found');
  });

  $('nav.main .navNextLevel').remove();
  $('nav.main li').each((i, e) => {
    const li = $(e), sub = li.children('ul');
    li.removeClass('open');
    if (!sub.length) return;
    const id = 'submenu-' + i;
    sub.attr('id', id);
    const expanded = li.hasClass('active') || li.hasClass('current') || li.find('li.current').length > 0;
    li.attr('data-expanded', String(expanded));
    const button = $('<button type="button" class="submenu-toggle"></button>');
    button.attr('aria-controls', id).attr('aria-expanded', String(expanded)).attr('aria-label', 'Show sections: ' + li.children('a').find('.navTitle').first().text()).text('+');
    li.children('a').after(button);
  });
  $('nav.main li.current > a').attr('aria-current', 'page');
  $('#burger').replaceWith('<button id="burger" type="button" class="opener mainAside-opener" aria-controls="mainAside" aria-expanded="false" aria-label="Open menu"><span class="piece"></span><span class="piece"></span><span class="piece"></span></button>');
  $('#innerAside').prepend('<button type="button" class="menu-close" aria-label="Close menu">Close menu</button>');
  $('#mainAside').attr('aria-label', 'Main navigation');

  $('.interactive .main_group [data-page-id]').each((_, e) => {
    const group = $(e); const ids = group.attr('data-page-id').split(',');
    const link = $('.interactive .legendNavigation li.page-' + ids[0] + ' a').first();
    if (link.length) group.attr('data-href', link.attr('href')).attr('tabindex', '0').attr('role', 'link').attr('aria-label', link.text().trim());
  });
  $('.interactive .legend .opener').attr('role', 'button').attr('tabindex', '0').attr('aria-label', 'Toggle illustration legend').attr('aria-expanded', 'false');
  $('iframe[src*="youtube"]').each((_, e) => {
    const iframe = $(e); const url = new URL(iframe.attr('src'));
    url.searchParams.delete('origin'); url.searchParams.delete('enablejsapi');
    iframe.attr('src', url.href).attr('loading', 'lazy').attr('referrerpolicy', 'strict-origin-when-cross-origin');
  });
  $('.tx_theme_frontend').removeClass('tx_theme_frontend').addClass('categorized-content');
  $('[class]').each((_, e) => { $(e).attr('class', $(e).attr('class').replace(/type-gridelements_pi1/g, 'type-grid')); });
  $('head').append(`<link rel="stylesheet" href="${relative(destination, 'assets/static.css')}"><script defer src="${relative(destination, 'assets/app.js')}"></script>`);
  $('body').prepend('<a class="skip-link" href="#mainContent">Skip to content</a>');
  await fs.mkdir(path.dirname('dist/' + destination), { recursive: true });
  await fs.writeFile('dist/' + destination, '<!doctype html>\n' + $.html());
}
await fs.copyFile('src/app.js', 'dist/assets/app.js');
await fs.copyFile('src/static.css', 'dist/assets/static.css');
await fs.writeFile('migration-report.json', JSON.stringify({ downloadedAt: manifest.downloadedAt, pages: pages.length, assets: manifest.records.length - pages.length, originalMissingAssets: manifest.failures, repairedImageLinks: repairs, unresolved }, null, 2) + '\n');
console.log(`Built ${pages.length} pages and ${manifest.records.length - pages.length} assets. Repaired ${repairs.length} unavailable full-size image links. Unresolved: ${unresolved.length}.`);
if (unresolved.length) process.exitCode = 1;
