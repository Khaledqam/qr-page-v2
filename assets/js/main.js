/* =============================================================
   AtoZ Store — Public Frontend JS  (v3)
   ============================================================= */
(function () {
  'use strict';

  const API = {
    links:    'api/links.php',
    settings: 'api/settings.php',
  };

  // Built-in inline SVG icons for common types (no external dependency)
  const TYPE_ICONS = {
    whatsapp:  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%2325D366"/><path fill="%23fff" d="M23 9a9.9 9.9 0 0 0-16.9 7.1c0 1.6.4 3.1 1.2 4.4L6 27l6.7-1.8c1.3.7 2.7 1 4.2 1a9.9 9.9 0 0 0 9.9-9.9c0-2.6-1-5-2.8-6.9z"/></svg>',
    instagram: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><radialGradient id="ig" cx="30%" cy="107%" r="150%"><stop offset="0%" stop-color="%23fdf497"/><stop offset="5%" stop-color="%23fdf497"/><stop offset="45%" stop-color="%23fd5949"/><stop offset="60%" stop-color="%23d6249f"/><stop offset="90%" stop-color="%23285AEB"/></radialGradient></defs><rect width="32" height="32" rx="8" fill="url(%23ig)"/><rect x="8" y="8" width="16" height="16" rx="5" fill="none" stroke="%23fff" stroke-width="2"/><circle cx="16" cy="16" r="4" fill="none" stroke="%23fff" stroke-width="2"/><circle cx="22" cy="10" r="1.2" fill="%23fff"/></svg>',
    facebook:  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%231877F2"/><path fill="%23fff" d="M17.5 10.5h2.5V7.5H17a4 4 0 0 0-4 4V13H11v3h2v8h3v-8h2.5l.5-3H16v-1.5a1 1 0 0 1 1-1z"/></svg>',
    tiktok:    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23010101"/><path fill="%23fff" d="M22 12.5a5.5 5.5 0 0 1-3.3-1.1v7.1a5.1 5.1 0 1 1-3.5-4.8v2.9a2.2 2.2 0 1 0 1.5 2.1V8h2.3a5.4 5.4 0 0 0 3 4.5z"/></svg>',
    youtube:   'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23FF0000"/><polygon fill="%23fff" points="13,11 22,16 13,21"/></svg>',
    website:   'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%2300BED9"/><circle cx="16" cy="16" r="9" fill="none" stroke="%23fff" stroke-width="2"/><line x1="16" y1="7" x2="16" y2="25" stroke="%23fff" stroke-width="1.5"/><line x1="7" y1="16" x2="25" y2="16" stroke="%23fff" stroke-width="1.5"/><ellipse cx="16" cy="16" rx="5" ry="9" fill="none" stroke="%23fff" stroke-width="1.5"/></svg>',
    custom:    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%230c1727"/><circle cx="16" cy="16" r="7" fill="none" stroke="%2300BED9" stroke-width="2"/></svg>',
  };

  /* --- Icon resolution --------------------------------- */
  function iconFor(link) {
    if (link.icon_source === 'upload' && link.icon) {
      return `assets/img/icons/${link.icon}`;
    }
    if (TYPE_ICONS[link.type]) return TYPE_ICONS[link.type];
    // Fallback: Google favicon service
    try {
      const domain = new URL(link.url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch { return TYPE_ICONS.custom; }
  }

  /* --- Build SVG icon strings for branch action buttons --- */
  const SVG = {
    maps: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    wa:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
    android: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.523 15.341a1 1 0 0 1-1.73-1l1.154-2a1 1 0 1 1 1.73 1zm-11.047 0 1.154-2a1 1 0 1 0-1.73-1l-1.154 2a1 1 0 1 0 1.73 1zM20 9H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1v3a1 1 0 0 0 2 0v-3h10v3a1 1 0 0 0 2 0v-3h1a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1zM8.5 6.5a1 1 0 1 0-2 0 1 1 0 0 0 2 0zm9 0a1 1 0 1 0-2 0 1 1 0 0 0 2 0zM6.76 8h10.48l-1.74-3.018A2 2 0 0 0 13.764 4h-3.528a2 2 0 0 0-1.732 1l-1.745 3z"/></svg>`,
    apple:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>`,
  };

  /* --- Render link cards -------------------------------- */
  function renderLinks(links) {
    const list = document.getElementById('linksList');
    list.innerHTML = '';

    if (!links.length) {
      list.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);padding:20px 0">لا توجد روابط متاحة حالياً</p>';
      return;
    }

    links.forEach((link) => {
      const a = document.createElement('a');
      a.className   = 'link-card';
      a.href        = link.url;
      a.target      = '_blank';
      a.rel         = 'noopener noreferrer';

      const icon = document.createElement('img');
      icon.className = 'link-card__icon';
      icon.src       = iconFor(link);
      icon.alt       = '';
      icon.loading   = 'eager';

      const title = document.createElement('span');
      title.className   = 'link-card__title';
      title.textContent = link.title;

      a.append(icon, title);
      list.appendChild(a);
    });
  }

  /* --- Render branch cards ------------------------------ */
  function renderBranches(branches) {
    const list = document.getElementById('branchesList');
    list.innerHTML = '';

    if (!branches || !branches.length) {
      list.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);padding:20px 0">لا توجد فروع مضافة</p>';
      return;
    }

    // Sort by order field
    const sorted = [...branches].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    sorted.forEach((b) => {
      const card = document.createElement('div');
      card.className = 'branch-card';

      const name = document.createElement('div');
      name.className   = 'branch-card__name';
      name.textContent = b.name;

      const actions = document.createElement('div');
      actions.className = 'branch-card__actions';

      // Maps button — only if URL exists
      if (b.maps_url) {
        const mapsBtn = document.createElement('a');
        mapsBtn.className = 'branch-action-btn branch-action-btn--maps';
        mapsBtn.href      = b.maps_url;
        mapsBtn.target    = '_blank';
        mapsBtn.rel       = 'noopener noreferrer';
        mapsBtn.innerHTML = `${SVG.maps} الخريطة`;
        actions.appendChild(mapsBtn);
      }

      // WhatsApp button — only if number exists
      const waNum = (b.whatsapp || '').replace(/\D/g, '');
      if (waNum) {
        const waBtn = document.createElement('a');
        waBtn.className = 'branch-action-btn branch-action-btn--wa';
        waBtn.href      = `https://wa.me/${waNum}`;
        waBtn.target    = '_blank';
        waBtn.rel       = 'noopener noreferrer';
        waBtn.innerHTML = `${SVG.wa} واتساب`;
        actions.appendChild(waBtn);
      }

      card.append(name, actions);
      list.appendChild(card);
    });
  }

  /* --- Render app store block (always 2-column) --------- */
  function buildAppBlock(appLinks) {
    if (!appLinks || (!appLinks.android && !appLinks.ios)) return null;

    const wrap = document.createElement('div');
    wrap.className = 'app-block';

    if (appLinks.android) {
      const a = document.createElement('a');
      a.className = 'app-btn';
      a.href      = appLinks.android;
      a.target    = '_blank';
      a.rel       = 'noopener noreferrer';
      a.innerHTML = `${SVG.android}<span>Google Play</span>`;
      wrap.appendChild(a);
    }
    if (appLinks.ios) {
      const a = document.createElement('a');
      a.className = 'app-btn';
      a.href      = appLinks.ios;
      a.target    = '_blank';
      a.rel       = 'noopener noreferrer';
      a.innerHTML = `${SVG.apple}<span>App Store</span>`;
      wrap.appendChild(a);
    }
    return wrap;
  }

  function renderAppLinks(appLinks) {
    const block = buildAppBlock(appLinks);
    if (!block) return;

    const pos = appLinks.app_block_position === 'top' ? 'appBlockTop' : 'appBlockBottom';
    const container = document.getElementById(pos);
    if (!container) return;
    container.appendChild(block);
    container.hidden = false;
  }

  /* --- Apply appearance from admin settings ------------- */
  function applyAppearance(appearance) {
    if (!appearance) return;
    const root = document.documentElement;
    if (appearance.background_color) root.style.setProperty('--color-bg', appearance.background_color);
    if (appearance.primary_color)    root.style.setProperty('--color-primary', appearance.primary_color);
    if (appearance.secondary_color)  root.style.setProperty('--color-secondary', appearance.secondary_color);

    document.body.classList.remove('layout-list', 'layout-grid');
    document.body.classList.add(appearance.layout_style === 'grid' ? 'layout-grid' : 'layout-list');

    document.body.classList.remove('card-style-glass', 'card-style-elevated', 'card-style-outline', 'card-style-flat');
    document.body.classList.add(`card-style-${appearance.card_style || 'glass'}`);
  }

  /* --- Apply logo shape & glow -------------------------- */
  function applyLogoStyle(settings) {
    const shape = settings.logo_shape || 'circle';
    const glow  = settings.logo_glow !== false;
    document.body.classList.remove('logo-circle', 'logo-rounded', 'logo-original');
    document.body.classList.add(`logo-${shape}`);
    document.body.classList.toggle('logo-glow', glow);

    // Propagate shape to glow wrapper
    const wrap = document.getElementById('logoWrap');
    if (wrap) {
      wrap.style.borderRadius = shape === 'circle' ? '50%' : shape === 'rounded' ? '22px' : '0';
    }
  }

  /* --- Tab switching ------------------------------------ */
  function initTabs() {
    const tabs   = document.querySelectorAll('.tab');
    const panels = document.querySelectorAll('.panel');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.panel;

        tabs.forEach((t) => {
          t.classList.remove('tab--active');
          t.setAttribute('aria-selected', 'false');
        });
        panels.forEach((p) => { p.hidden = true; });

        tab.classList.add('tab--active');
        tab.setAttribute('aria-selected', 'true');

        const panel = document.getElementById(`panel-${target}`);
        if (panel) panel.hidden = false;
      });
    });
  }

  /* --- Main init --------------------------------------- */
  async function init() {
    document.getElementById('year').textContent = new Date().getFullYear();
    initTabs();

    try {
      const [linksRes, settingsRes] = await Promise.all([
        fetch(API.links),
        fetch(API.settings),
      ]);

      const linksData = await linksRes.json();
      const settings  = await settingsRes.json();

      // Inject tracking scripts (head and body) if present
      if (settings.tracking_scripts_head) {
        const headPlaceholder = document.querySelector('meta[name="robots"]');
        if (headPlaceholder) {
          const temp = document.createElement('div');
          temp.innerHTML = settings.tracking_scripts_head;
          while (temp.firstChild) {
            headPlaceholder.parentNode.insertBefore(temp.firstChild, headPlaceholder.nextSibling);
          }
        }
      }
      if (settings.tracking_scripts_body) {
        const bodyPlaceholder = document.getElementById('footerText')?.parentNode;
        if (bodyPlaceholder) {
          const temp = document.createElement('div');
          temp.innerHTML = settings.tracking_scripts_body;
          while (temp.firstChild) {
            bodyPlaceholder.appendChild(temp.firstChild);
          }
        }
      }

      // Header
      document.getElementById('storeName').textContent = settings.store_name || 'AtoZ Store';
      document.getElementById('taglineText').textContent = settings.tagline || 'Expect More...';
      if (settings.bio_html) {
        document.getElementById('bioText').innerHTML = settings.bio_html;
      }
      if (settings.logo_url) {
        document.getElementById('logoImg').src = settings.logo_url;
      }

      // Website micro-button
      const websiteBtn   = document.getElementById('websiteBtn');
      const websiteLabel = document.getElementById('websiteLabel');
      if (settings.website_url) {
        websiteBtn.href      = settings.website_url;
        try { websiteLabel.textContent = new URL(settings.website_url).hostname; } catch { /* keep default */ }
        websiteBtn.hidden = false;
      }

      // Phone micro-button
      const phoneBtn   = document.getElementById('phoneBtn');
      const phoneLabel = document.getElementById('phoneLabel');
      if (settings.phone) {
        phoneBtn.href        = `tel:${settings.phone.replace(/\s/g, '')}`;
        phoneLabel.textContent = settings.phone;
        phoneBtn.hidden = false;
      }

      // Footer
      const footerText = settings.footer_text
        ? settings.footer_text.replace('{year}', new Date().getFullYear())
        : `AtoZ Store © ${new Date().getFullYear()}`;
      document.getElementById('footerText').textContent = footerText;

      // Appearance
      applyAppearance(settings.appearance);
      applyLogoStyle(settings);

      // Links
      renderLinks(linksData.links || []);

      // Branches
      renderBranches(settings.branches);

      // App store badges
      renderAppLinks(settings.app_links);

    } catch (err) {
      console.error('[AtoZ] Failed to load page data:', err);
      document.getElementById('linksList').innerHTML =
        '<p style="text-align:center;color:var(--color-text-muted);padding:20px 0">تعذر تحميل الروابط، يرجى المحاولة لاحقاً</p>';
      document.getElementById('branchesList').innerHTML = '';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
