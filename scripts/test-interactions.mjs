import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';

const script = await fs.readFile('src/app.js', 'utf8');
const manifest = JSON.parse(await fs.readFile('snapshot/manifest.json', 'utf8'));
let checks = 0;
for (const page of manifest.records.filter(r => r.type === 'page')) {
  const file = page.file.slice(6);
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(await fs.readFile('dist/' + file, 'utf8'), {
    url: 'https://static.example/' + file,
    runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole,
  });
  const { window } = dom;
  const document = window.document;
  window.matchMedia = () => ({ matches: true, addEventListener() {} });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.eval(script);
  assert.ok(document.body.classList.contains('js-ready'), file + ': app initialized'); checks++;

  const burger = document.getElementById('burger');
  burger.click();
  assert.equal(burger.getAttribute('aria-expanded'), 'true');
  assert.equal(document.getElementById('mainAside').inert, false);
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(burger.getAttribute('aria-expanded'), 'false'); checks++;
  const toggle = document.querySelector('.submenu-toggle');
  const before = toggle.getAttribute('aria-expanded'); toggle.click();
  assert.notEqual(toggle.getAttribute('aria-expanded'), before);
  assert.equal(document.getElementById(toggle.getAttribute('aria-controls')).hidden, before === 'true'); checks++;

  const header = document.querySelector('.accordionHeader[role="button"]');
  if (header) {
    const content = document.getElementById(header.getAttribute('aria-controls'));
    const wasHidden = content.hidden;
    header.click(); assert.notEqual(content.hidden, wasHidden);
    header.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.equal(content.hidden, wasHidden); checks++;
  }
  const form = document.querySelector('[data-component-filter]');
  if (form) {
    const items = [...document.querySelectorAll('[data-categories]')];
    assert.ok(items.length > 5);
    for (const input of form.querySelectorAll('input[type="checkbox"]')) {
      input.checked = true; input.dispatchEvent(new window.Event('change', { bubbles: true }));
      for (const item of items) assert.equal(!item.hidden, item.dataset.categories.split(' ').includes(input.id));
      input.checked = false; input.dispatchEvent(new window.Event('change', { bubbles: true }));
      assert.equal(items.filter(item => !item.hidden).length, items.length); checks++;
    }
    const inputs = [...form.querySelectorAll('input[type="checkbox"]')];
    inputs[0].checked = true; inputs[1].checked = true;
    form.dispatchEvent(new window.Event('change', { bubbles: true }));
    for (const item of items) assert.equal(!item.hidden, [inputs[0], inputs[1]].some(input => item.dataset.categories.split(' ').includes(input.id)));
    checks++;
  }
  const group = document.querySelector('.main_group [data-href]');
  if (group) {
    assert.ok(!group.dataset.href.startsWith('http'));
    group.dispatchEvent(new window.Event('mouseenter'));
    assert.ok(document.querySelector('.info.active'));
    group.dispatchEvent(new window.Event('mouseleave'));
    assert.equal(document.querySelector('.info.active'), null); checks++;
    const opener = document.querySelector('.legend .opener');
    opener.click(); assert.equal(opener.getAttribute('aria-expanded'), 'true'); checks++;
  }
  const photo = [...document.querySelectorAll('a[href]')].find(a => /\.(?:png|jpe?g|webp|gif)$/i.test(a.getAttribute('href')) && a.querySelector('img'));
  if (photo) {
    photo.click(); const dialog = document.querySelector('.static-lightbox');
    assert.equal(dialog.open, true);
    assert.equal(dialog.querySelector('img').src, photo.href);
    dialog.querySelector('[data-close]').click(); assert.equal(dialog.open, false); checks++;
  }
  assert.deepEqual(errors, [], file + ': no runtime errors'); checks++;
  dom.window.close();
}
console.log(`PASS: ${checks} interaction checks across all 55 pages (DOM simulation; visual browser QA unavailable).`);
