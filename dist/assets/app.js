/* Browser-only enhancements. No CMS, framework, API, storage or cookies. */
(() => {
  'use strict';
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const activate = (el, action) => {
    el.addEventListener('click', action);
    el.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(event); }
    });
  };

  all('nav.main li[data-expanded]').forEach(li => {
    const sub = li.querySelector(':scope > ul');
    const button = li.querySelector(':scope > .submenu-toggle');
    const set = open => { sub.hidden = !open; button.setAttribute('aria-expanded', String(open)); button.textContent = open ? '−' : '+'; };
    set(li.dataset.expanded === 'true');
    button.addEventListener('click', () => set(sub.hidden));
  });

  const aside = document.getElementById('mainAside');
  const burger = document.getElementById('burger');
  const overlay = document.getElementById('mainAside-overlay');
  const mobile = matchMedia('(max-width:1199px)');
  let menuOpen = false;
  function setMenu(open, restoreFocus = true) {
    menuOpen = open;
    aside?.setAttribute('data-offcanvas-status', open ? 'OPEN' : 'CLOSED');
    burger?.setAttribute('aria-expanded', String(open));
    burger?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-open', open);
    overlay?.classList.toggle('active', open);
    if (aside) aside.inert = mobile.matches && !open;
    if (open) aside?.querySelector('.menu-close')?.focus();
    else if (restoreFocus && mobile.matches) burger?.focus();
  }
  burger?.addEventListener('click', () => setMenu(!menuOpen));
  document.querySelector('.menu-close')?.addEventListener('click', () => setMenu(false));
  overlay?.addEventListener('click', () => setMenu(false));
  mobile.addEventListener('change', () => setMenu(false, false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuOpen) setMenu(false);
    if (event.key === 'Tab' && menuOpen && mobile.matches) {
      const targets = all('a[href],button', aside).filter(e => e.getClientRects().length);
      const first = targets[0], last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  setMenu(false, false);

  const states = new Map();
  all('.accordionItem').forEach((item, index) => {
    const header = item.querySelector(':scope > .accordionHeader');
    const content = item.querySelector(':scope > .accordionContent');
    if (!header || !content) return;
    header.setAttribute('role', 'button'); header.tabIndex = 0;
    header.id ||= `accordion-heading-${index}`;
    content.id ||= `accordion-panel-${index}`;
    header.setAttribute('aria-controls', content.id);
    content.setAttribute('aria-labelledby', header.id);
    const set = open => { content.hidden = !open; header.setAttribute('aria-expanded', String(open)); item.dataset.accordionStatus = open ? 'open' : 'closed'; };
    set(item.dataset.accordionStatus === 'open');
    states.set(item, set);
    activate(header, event => {
      if (event.target.closest('a,button,input')) return;
      set(content.hidden);
    });
  });
  function revealHash() {
    let target;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return; }
    if (!target) return;
    let parent = target;
    while (parent) { if (states.has(parent)) states.get(parent)(true); parent = parent.parentElement; }
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  }
  addEventListener('hashchange', revealHash);
  revealHash();

  all('.interactive').forEach(interactive => {
    const legend = interactive.querySelector('.legend');
    const opener = legend?.querySelector('.opener');
    if (opener) activate(opener, () => { const open = legend.classList.toggle('open'); opener.setAttribute('aria-expanded', String(open)); });
    all('.main_group [data-href]', interactive).forEach(group => {
      const show = active => {
        group.classList.toggle('hovered', active);
        all('.info-wrap .info', interactive).forEach(info => info.classList.toggle('active', active && group.dataset.pageId.split(',').includes(info.dataset.pageId)));
      };
      group.addEventListener('mouseenter', () => show(true));
      group.addEventListener('mouseleave', () => show(false));
      group.addEventListener('focus', () => show(true));
      group.addEventListener('blur', () => show(false));
      activate(group, () => { location.href = group.dataset.href; });
    });
  });

  all('.puzzle__opener-info').forEach(opener => {
    opener.setAttribute('role', 'button'); opener.tabIndex = 0; opener.setAttribute('aria-label', 'More information'); opener.setAttribute('aria-expanded', 'false');
    activate(opener, event => { event.preventDefault(); event.stopPropagation(); const open = opener.closest('.puzzle').classList.toggle('info-open'); opener.setAttribute('aria-expanded', String(open)); });
  });

  const form = document.querySelector('[data-component-filter]');
  if (form) {
    const items = all('[data-categories]');
    const inputs = all('input[type="checkbox"]', form);
    const filter = () => {
      const selected = inputs.filter(i => i.checked).map(i => i.id);
      let visible = 0;
      items.forEach(item => { item.hidden = selected.length > 0 && !selected.some(id => item.dataset.categories.split(' ').includes(id)); if (!item.hidden) visible++; });
      inputs.forEach(i => i.closest('label').classList.toggle('isChecked', i.checked));
      form.querySelector('.filter-status').textContent = `${visible} of ${items.length} components shown`;
    };
    form.addEventListener('submit', event => { event.preventDefault(); filter(); });
    form.addEventListener('change', filter);
    filter();
  }

  const photos = all('a[href]').filter(a => /\.(?:png|jpe?g|webp|gif)(?:#.*)?$/i.test(a.getAttribute('href')) && a.querySelector('img'));
  if (photos.length && typeof HTMLDialogElement !== 'undefined') {
    const dialog = document.createElement('dialog');
    dialog.className = 'static-lightbox'; dialog.setAttribute('aria-label', 'Image viewer');
    dialog.innerHTML = '<div class="lightbox-controls"><button type="button" data-prev>Previous</button><button type="button" data-close>Close</button><button type="button" data-next>Next</button></div><figure><img alt=""><figcaption></figcaption></figure>';
    document.body.append(dialog);
    let current = 0;
    const show = index => {
      current = (index + photos.length) % photos.length;
      const link = photos[current], original = link.querySelector('img');
      dialog.querySelector('img').src = link.href;
      dialog.querySelector('img').alt = original.alt || '';
      dialog.querySelector('figcaption').textContent = link.closest('figure')?.querySelector('figcaption')?.textContent || original.alt || '';
    };
    photos.forEach((a, i) => a.addEventListener('click', event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); show(i); dialog.showModal(); }));
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.querySelector('[data-prev]').addEventListener('click', () => show(current - 1));
    dialog.querySelector('[data-next]').addEventListener('click', () => show(current + 1));
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('keydown', event => { if (event.key === 'ArrowLeft') show(current - 1); if (event.key === 'ArrowRight') show(current + 1); });
  }
  document.body.classList.add('js-ready');
})();
