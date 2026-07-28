/* =============================================================
   AtoZ Store — Admin Panel JS  (v3)
   Full feature set: RBAC, drag-drop links+branches, WYSIWYG,
   logo upload, users management, approval queue, integrations,
   import/export, password eye toggle, remember-me, CSRF.
   ============================================================= */
(function () {
  'use strict';

  /* ---- API endpoints ---- */
  const API = {
    auth:     '/api/auth.php',
    links:    '/api/links.php',
    settings: '/api/settings.php',
    upload:   '/api/upload.php',
    approval: '/api/approval.php',
  };

  /* ---- Shared state ---- */
  let csrfToken    = '';
  let currentRole  = '';
  let linksState   = [];
  let settingsState = {};

  /* ================================================================
     UTILITY HELPERS
     ================================================================ */

  function escapeAttr(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function setStatus(id, msg, isError = false) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? 'var(--color-danger)' : 'var(--color-teal)';
  }

  /** POST JSON with CSRF header */
  async function apiPost(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify(body),
    });
  }

  /* ================================================================
     ① LOGIN SCREEN (only present when PHP $isLoggedIn = false)
     ================================================================ */
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    /* Password eye toggle */
    document.getElementById('togglePw')?.addEventListener('click', () => {
      const pw   = document.getElementById('password');
      const icon = document.getElementById('eyeIcon');
      if (pw.type === 'password') {
        pw.type = 'text';
        icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`;
      } else {
        pw.type = 'password';
        icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
      }
    });

    /* Get CSRF before login */
    fetch(`${API.auth}?action=csrf`)
      .then(r => r.json())
      .then(d => { csrfToken = d.csrf_token || ''; })
      .catch(() => {});

    loginBtn.addEventListener('click', async () => {
      const username   = document.getElementById('username').value.trim();
      const password   = document.getElementById('password').value;
      const rememberMe = document.getElementById('rememberMe')?.checked ?? false;
      const errorEl    = document.getElementById('loginError');
      errorEl.hidden   = true;

      if (!username || !password) {
        errorEl.textContent = 'يرجى إدخال اسم المستخدم وكلمة المرور';
        errorEl.hidden = false;
        return;
      }

      loginBtn.textContent = 'جاري الدخول...';
      loginBtn.disabled    = true;

      try {
        const res  = await fetch(API.auth, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
          body: JSON.stringify({ action: 'login', username, password, remember_me: rememberMe }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          csrfToken = data.csrf_token || csrfToken;
          window.location.reload();
        } else {
          errorEl.textContent = data.error || 'فشل تسجيل الدخول';
          errorEl.hidden = false;
          loginBtn.textContent = 'دخول';
          loginBtn.disabled    = false;
        }
      } catch {
        errorEl.textContent = 'تعذر الاتصال بالخادم';
        errorEl.hidden = false;
        loginBtn.textContent = 'دخول';
        loginBtn.disabled    = false;
      }
    });

    // Allow Enter key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loginBtn.click();
    });

    return; // Nothing else to do on login screen
  }

  /* ================================================================
     ② ADMIN DASHBOARD
     ================================================================ */

  /* ---- Logout ---- */
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await apiPost(API.auth, { action: 'logout' });
    window.location.reload();
  });

  /* ---- Tab switching ---- */
  document.querySelectorAll('.admin__tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin__tab').forEach(t => {
        t.classList.remove('admin__tab--active');
        t.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.admin__panel').forEach(p => p.hidden = true);
      tab.classList.add('admin__tab--active');
      tab.setAttribute('aria-selected', 'true');
      const panel = document.querySelector(`.admin__panel[data-panel="${tab.dataset.tab}"]`);
      if (panel) panel.hidden = false;
    });
  });

  document.getElementById('goToApprovalBtn')?.addEventListener('click', () => {
    document.querySelector('.admin__tab[data-tab="approvals"]')?.click();
  });

  /* ================================================================
     LINKS EDITOR
     ================================================================ */
  const TYPE_ICONS = {
    whatsapp:  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%2325D366"/><path fill="%23fff" d="M23 9a9.9 9.9 0 0 0-16.9 7.1c0 1.6.4 3.1 1.2 4.4L6 27l6.7-1.8c1.3.7 2.7 1 4.2 1a9.9 9.9 0 0 0 9.9-9.9c0-2.6-1-5-2.8-6.9z"/></svg>',
    instagram: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="%23C13584"/><rect x="8" y="8" width="16" height="16" rx="5" fill="none" stroke="%23fff" stroke-width="2"/><circle cx="16" cy="16" r="4" fill="none" stroke="%23fff" stroke-width="2"/></svg>',
    facebook:  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%231877F2"/><path fill="%23fff" d="M17.5 10.5h2.5V7.5H17a4 4 0 0 0-4 4V13H11v3h2v8h3v-8h2.5l.5-3H16v-1.5a1 1 0 0 1 1-1z"/></svg>',
    website:   'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%2300BED9"/><circle cx="16" cy="16" r="9" fill="none" stroke="%23fff" stroke-width="2"/></svg>',
  };

  function iconPreviewSrc(link) {
    if (link.icon_source === 'upload' && link.icon) return `assets/img/icons/${link.icon}`;
    if (TYPE_ICONS[link.type]) return TYPE_ICONS[link.type];
    try { return `https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=64`; }
    catch { return ''; }
  }

  function renderLinksEditor() {
    const list = document.getElementById('linksEditor');
    if (!list) return;
    list.innerHTML = '';

    linksState.forEach((link, index) => {
      const li = document.createElement('li');
      li.className = 'link-editor-item';
      li.draggable = true;
      li.dataset.index = String(index);

      const iconSrc = iconPreviewSrc(link);

      li.innerHTML = `
        <span class="link-editor-item__handle" title="اسحب لإعادة الترتيب">⠿</span>
        <img class="link-editor-item__icon-preview" src="${escapeAttr(iconSrc)}" alt="">
        <div class="link-editor-item__fields">
          <input type="text"   value="${escapeAttr(link.title)}" data-field="title"  placeholder="اسم الرابط">
          <input type="url"    value="${escapeAttr(link.url)}"   data-field="url"    placeholder="https://..." dir="ltr">
          <div class="link-editor-item__meta">
            <select data-field="type">
              <option value="custom"    ${link.type==='custom'?'selected':''}>رابط مخصص</option>
              <option value="whatsapp"  ${link.type==='whatsapp'?'selected':''}>واتساب</option>
              <option value="instagram" ${link.type==='instagram'?'selected':''}>إنستغرام</option>
              <option value="facebook"  ${link.type==='facebook'?'selected':''}>فيسبوك</option>
              <option value="tiktok"    ${link.type==='tiktok'?'selected':''}>تيك توك</option>
              <option value="youtube"   ${link.type==='youtube'?'selected':''}>يوتيوب</option>
              <option value="website"   ${link.type==='website'?'selected':''}>موقع ويب</option>
            </select>
            <label>
              <input type="checkbox" data-field="active" ${link.active?'checked':''}>
              نشط
            </label>
            <button type="button" class="link-icon-upload-btn" data-idx="${index}">📎 أيقونة مخصصة</button>
            <input type="file" class="link-icon-file" accept="image/*" hidden data-idx="${index}">
          </div>
        </div>
        <button type="button" class="link-editor-item__delete" title="حذف">✕</button>
      `;

      /* Field changes */
      li.querySelectorAll('[data-field]').forEach((el) => {
        el.addEventListener('change', () => {
          const f = el.dataset.field;
          linksState[index][f] = f === 'active' ? el.checked : el.value;
          if (f === 'type' || f === 'url') {
            li.querySelector('.link-editor-item__icon-preview').src = iconPreviewSrc(linksState[index]);
          }
        });
        el.addEventListener('input', () => {
          const f = el.dataset.field;
          if (f !== 'active') linksState[index][f] = el.value;
        });
      });

      /* Custom icon upload */
      const uploadBtn  = li.querySelector('.link-icon-upload-btn');
      const fileInput  = li.querySelector('.link-icon-file');
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        uploadBtn.textContent = 'جاري الرفع...';
        const fd = new FormData();
        fd.append('icon', file);
        try {
          const res  = await fetch(API.upload, { method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: fd });
          const data = await res.json();
          if (res.ok) {
            linksState[index].icon        = data.filename;
            linksState[index].icon_source = 'upload';
            li.querySelector('.link-editor-item__icon-preview').src = data.url;
            uploadBtn.textContent = '✔ تم';
          } else {
            uploadBtn.textContent = data.error || 'فشل';
          }
        } catch { uploadBtn.textContent = 'خطأ'; }
      });

      /* Delete */
      li.querySelector('.link-editor-item__delete').addEventListener('click', () => {
        linksState.splice(index, 1);
        renderLinksEditor();
      });

      addDragHandlers(li, 'linksEditor', linksState);
      list.appendChild(li);
    });
  }

  /* ---- Generic drag-and-drop for any editor list ---- */
  let dragSrcIndex = null;
  let dragSrcState = null;

  function addDragHandlers(li, listId, stateArr) {
    li.addEventListener('dragstart', (e) => {
      dragSrcIndex = Number(li.dataset.index);
      dragSrcState = stateArr;
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      document.querySelectorAll('.link-editor-item').forEach(el => el.classList.remove('drag-over'));
      dragSrcIndex = null;
      dragSrcState = null;
    });
    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll(`#${listId} .link-editor-item`).forEach(el => el.classList.remove('drag-over'));
      li.classList.add('drag-over');
    });
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetIndex = Number(li.dataset.index);
      if (dragSrcState !== stateArr || dragSrcIndex === null || dragSrcIndex === targetIndex) return;
      const moved = stateArr.splice(dragSrcIndex, 1)[0];
      stateArr.splice(targetIndex, 0, moved);
      if (listId === 'linksEditor') renderLinksEditor();
      else renderBranchesEditor();
    });
  }

  document.getElementById('addLinkBtn')?.addEventListener('click', () => {
    linksState.push({ id: '', title: '', url: '', icon: '', icon_source: 'auto', type: 'custom', active: true });
    renderLinksEditor();
  });

  document.getElementById('saveLinksBtn')?.addEventListener('click', async () => {
    setStatus('linksStatus', 'جاري الحفظ...');
    try {
      const res  = await apiPost(API.links, { links: linksState });
      const data = await res.json();
      if (res.ok) { linksState = data.links || linksState; renderLinksEditor(); setStatus('linksStatus', data.queued ? '📋 تم إرسال التعديلات للموافقة' : '✔ تم الحفظ'); }
      else setStatus('linksStatus', data.error || 'فشل الحفظ', true);
    } catch { setStatus('linksStatus', 'تعذر الاتصال بالخادم', true); }
  });

  /* ================================================================
     CONTENT TAB
     ================================================================ */
  document.querySelectorAll('.wysiwyg__toolbar button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (cmd === 'createLink') {
        const url = prompt('أدخل الرابط:');
        if (url) document.execCommand('createLink', false, url);
      } else {
        document.execCommand(cmd, false);
      }
      document.getElementById('bioEditor')?.focus();
    });
  });

  document.getElementById('logoUpload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus('contentStatus', 'جاري رفع الشعار...');
    const fd = new FormData();
    fd.append('icon', file);
    try {
      const res  = await fetch(API.upload, { method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: fd });
      const data = await res.json();
      if (res.ok) {
        settingsState.logo_url = data.url;
        const prev = document.getElementById('logoPreview');
        if (prev) { prev.src = data.url; prev.hidden = false; }
        setStatus('contentStatus', 'تم رفع الشعار — لا تنسَ الحفظ ✔');
      } else { setStatus('contentStatus', data.error || 'فشل رفع الشعار', true); }
    } catch { setStatus('contentStatus', 'تعذر الاتصال بالخادم', true); }
  });

  document.getElementById('saveContentBtn')?.addEventListener('click', async () => {
    setStatus('contentStatus', 'جاري الحفظ...');
    const payload = {
      store_name: document.getElementById('storeNameInput')?.value,
      tagline:    document.getElementById('taglineInput')?.value,
      bio_html:   document.getElementById('bioEditor')?.innerHTML,
      website_url: document.getElementById('websiteUrlInput')?.value,
      phone:      document.getElementById('phoneInput')?.value,
      footer_text: document.getElementById('footerTextInput')?.value,
      logo_shape: document.getElementById('logoShapeSelect')?.value,
      logo_glow:  document.getElementById('logoGlowToggle')?.checked ?? true,
    };
    if (settingsState.logo_url) payload.logo_url = settingsState.logo_url;

    try {
      const res  = await apiPost(API.settings, payload);
      const data = await res.json();
      if (res.ok) { settingsState = { ...settingsState, ...data.settings }; setStatus('contentStatus', data.queued ? '📋 تم إرسال التعديلات للموافقة' : '✔ تم الحفظ'); }
      else setStatus('contentStatus', data.error || 'فشل الحفظ', true);
    } catch { setStatus('contentStatus', 'تعذر الاتصال بالخادم', true); }
  });

  /* ================================================================
     BRANCHES EDITOR
     ================================================================ */
  function renderBranchesEditor() {
    const list = document.getElementById('branchesEditor');
    if (!list) return;
    list.innerHTML = '';

    const branches = settingsState.branches || [];

    branches.forEach((branch, index) => {
      const li = document.createElement('li');
      li.className = 'link-editor-item';
      li.draggable = true;
      li.dataset.index = String(index);

      li.innerHTML = `
        <span class="link-editor-item__handle" title="اسحب لإعادة الترتيب">⠿</span>
        <div class="link-editor-item__fields">
          <input type="text" value="${escapeAttr(branch.name)}"      data-field="name"      placeholder="اسم الفرع">
          <input type="url"  value="${escapeAttr(branch.maps_url||'')}" data-field="maps_url" placeholder="رابط خرائط جوجل / Waze" dir="ltr">
          <input type="text" value="${escapeAttr(branch.whatsapp||'')}" data-field="whatsapp" placeholder="رقم واتساب بدون + (مثال: 972591234567)" dir="ltr">
        </div>
        <button type="button" class="link-editor-item__delete" title="حذف فرع">✕</button>
      `;

      li.querySelectorAll('[data-field]').forEach((input) => {
        input.addEventListener('input', () => {
          settingsState.branches[index][input.dataset.field] = input.value;
        });
      });

      li.querySelector('.link-editor-item__delete').addEventListener('click', () => {
        settingsState.branches.splice(index, 1);
        renderBranchesEditor();
      });

      addDragHandlers(li, 'branchesEditor', settingsState.branches);
      list.appendChild(li);
    });
  }

  document.getElementById('addBranchBtn')?.addEventListener('click', () => {
    settingsState.branches = settingsState.branches || [];
    const maxOrder = settingsState.branches.reduce((m, b) => Math.max(m, b.order ?? 0), 0);
    settingsState.branches.push({ id: 'br_' + Date.now(), name: '', maps_url: '', whatsapp: '', order: maxOrder + 1 });
    renderBranchesEditor();
  });

  document.getElementById('saveBranchesBtn')?.addEventListener('click', async () => {
    setStatus('branchesStatus', 'جاري الحفظ...');
    // Re-assign order based on current array position
    const branches = (settingsState.branches || []).map((b, i) => ({ ...b, order: i + 1 }));
    try {
      const res  = await apiPost(API.settings, { branches });
      const data = await res.json();
      if (res.ok) { settingsState.branches = data.settings?.branches || branches; renderBranchesEditor(); setStatus('branchesStatus', data.queued ? '📋 تم إرسال التعديلات للموافقة' : '✔ تم الحفظ'); }
      else setStatus('branchesStatus', data.error || 'فشل الحفظ', true);
    } catch { setStatus('branchesStatus', 'تعذر الاتصال بالخادم', true); }
  });

  /* ================================================================
     APPEARANCE TAB
     ================================================================ */
  function updateAppearancePreview() {
    const preview   = document.getElementById('appearancePreview');
    const card      = preview?.querySelector('.appearance-preview__card');
    const icon      = preview?.querySelector('.appearance-preview__icon');
    if (!preview || !card || !icon) return;

    const bg         = document.getElementById('bgColorInput')?.value        || '#0c1727';
    const primary    = document.getElementById('primaryColorInput')?.value   || '#00bed9';
    const secondary  = document.getElementById('secondaryColorInput')?.value || '#ffffff';
    const cardStyle  = document.getElementById('cardStyleSelect')?.value     || 'glass';

    preview.style.background = bg;
    card.style.color          = secondary;
    icon.style.background     = primary;

    if (cardStyle === 'glass') {
      card.style.background   = 'rgba(255,255,255,0.07)';
      card.style.border       = '1px solid rgba(255,255,255,0.10)';
      card.style.borderRadius = '14px';
      card.style.boxShadow    = '0 8px 32px -8px rgba(0,0,0,0.45)';
    } else if (cardStyle === 'elevated') {
      card.style.background   = 'rgba(255,255,255,0.09)';
      card.style.border       = '1px solid transparent';
      card.style.borderRadius = '14px';
      card.style.boxShadow    = '0 4px 20px -4px rgba(0,0,0,0.4)';
    } else if (cardStyle === 'outline') {
      card.style.background   = 'transparent';
      card.style.border       = `1.5px solid rgba(255,255,255,0.15)`;
      card.style.borderRadius = '14px';
      card.style.boxShadow    = 'none';
    } else {
      card.style.background   = 'transparent';
      card.style.border       = 'none';
      card.style.borderBottom = `1px solid rgba(255,255,255,0.12)`;
      card.style.borderRadius = '0';
      card.style.boxShadow    = 'none';
    }
  }

  function populateAppearanceFields(a) {
    if (!a) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    set('bgColorInput',       a.background_color || '#0c1727');
    set('primaryColorInput',  a.primary_color    || '#00bed9');
    set('secondaryColorInput',a.secondary_color  || '#ffffff');
    set('layoutStyleSelect',  a.layout_style     || 'list');
    set('cardStyleSelect',    a.card_style       || 'glass');
    updateAppearancePreview();
  }

  ['bgColorInput','primaryColorInput','secondaryColorInput','layoutStyleSelect','cardStyleSelect']
    .forEach(id => document.getElementById(id)?.addEventListener('input', updateAppearancePreview));

  document.getElementById('saveAppearanceBtn')?.addEventListener('click', async () => {
    setStatus('appearanceStatus', 'جاري الحفظ...');
    const payload = {
      appearance: {
        background_color: document.getElementById('bgColorInput')?.value,
        primary_color:    document.getElementById('primaryColorInput')?.value,
        secondary_color:  document.getElementById('secondaryColorInput')?.value,
        layout_style:     document.getElementById('layoutStyleSelect')?.value,
        card_style:       document.getElementById('cardStyleSelect')?.value,
      },
      app_links: {
        android:            document.getElementById('androidInput')?.value || '',
        ios:                document.getElementById('iosInput')?.value     || '',
        app_block_position: document.getElementById('appPositionSelect')?.value || 'bottom',
      },
    };
    try {
      const res  = await apiPost(API.settings, payload);
      const data = await res.json();
      if (res.ok) { settingsState = { ...settingsState, ...data.settings }; setStatus('appearanceStatus', '✔ تم الحفظ — التغييرات مرئية الآن على الصفحة العامة'); }
      else setStatus('appearanceStatus', data.error || 'فشل الحفظ', true);
    } catch { setStatus('appearanceStatus', 'تعذر الاتصال بالخادم', true); }
  });

  /* ================================================================
     INTEGRATIONS TAB
     ================================================================ */
  document.getElementById('saveIntegrationsBtn')?.addEventListener('click', async () => {
    setStatus('integrationsStatus', 'جاري الحفظ...');
    const payload = {
      tracking_scripts_head: document.getElementById('trackingHeadInput')?.value || '',
      tracking_scripts_body: document.getElementById('trackingBodyInput')?.value || '',
    };
    try {
      const res  = await apiPost(API.settings, payload);
      const data = await res.json();
      if (res.ok) setStatus('integrationsStatus', '✔ تم الحفظ — السكريبتات نشطة على الصفحة العامة');
      else setStatus('integrationsStatus', data.error || 'فشل الحفظ', true);
    } catch { setStatus('integrationsStatus', 'تعذر الاتصال بالخادم', true); }
  });

  /* ================================================================
     USERS MANAGEMENT (superadmin only)
     ================================================================ */
  const ROLE_LABELS = {
    superadmin: 'سوبر أدمن',
    admin:      'مدير',
    editor:     'محرر',
    viewer:     'مشاهد',
  };

  async function loadUsers() {
    const tbody = document.getElementById('usersTbody');
    if (!tbody) return;
    try {
      const res  = await apiPost(API.auth, { action: 'users_list' });
      const data = await res.json();
      if (!res.ok) { tbody.innerHTML = `<tr><td colspan="4" style="color:var(--color-danger)">${data.error}</td></tr>`; return; }

      tbody.innerHTML = '';
      (data.users || []).forEach((u) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeAttr(u.username)}</td>
          <td>${escapeAttr(u.display_name)}</td>
          <td><span class="role-badge role-badge--${u.role}">${ROLE_LABELS[u.role] || u.role}</span></td>
          <td>
            ${u.role !== 'superadmin' ? `
              <select class="admin__input" style="width:auto;padding:4px 8px;font-size:.8rem" data-uid="${escapeAttr(u.id)}" data-action="role">
                <option value="admin"  ${u.role==='admin'?'selected':''}>مدير</option>
                <option value="editor" ${u.role==='editor'?'selected':''}>محرر</option>
                <option value="viewer" ${u.role==='viewer'?'selected':''}>مشاهد</option>
              </select>
              <button class="btn btn--sm btn--ghost btn--danger" data-uid="${escapeAttr(u.id)}" data-action="delete" style="margin-right:4px">حذف</button>
            ` : '<span style="color:var(--color-text-muted);font-size:.8rem">محمي</span>'}
          </td>
        `;
        tbody.appendChild(tr);
      });

      /* Role change */
      tbody.querySelectorAll('[data-action="role"]').forEach((sel) => {
        sel.addEventListener('change', async () => {
          const uid  = sel.dataset.uid;
          const role = sel.value;
          const res2 = await apiPost(API.auth, { action: 'users_update', id: uid, role });
          const d2   = await res2.json();
          setStatus('usersStatus', res2.ok ? '✔ تم تحديث الدور' : (d2.error || 'فشل'), !res2.ok);
          if (res2.ok) loadUsers();
        });
      });

      /* Delete user */
      tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('هل تريد حذف هذا المستخدم نهائياً؟')) return;
          const uid  = btn.dataset.uid;
          const res2 = await apiPost(API.auth, { action: 'users_delete', id: uid });
          const d2   = await res2.json();
          setStatus('usersStatus', res2.ok ? '✔ تم الحذف' : (d2.error || 'فشل'), !res2.ok);
          if (res2.ok) loadUsers();
        });
      });
    } catch { if (tbody) tbody.innerHTML = '<tr><td colspan="4">تعذر التحميل</td></tr>'; }
  }

  document.getElementById('createUserBtn')?.addEventListener('click', async () => {
    const username    = document.getElementById('newUsername')?.value.trim();
    const displayName = document.getElementById('newDisplayName')?.value.trim();
    const password    = document.getElementById('newPassword')?.value;
    const role        = document.getElementById('newRole')?.value;

    if (!username || !password) { setStatus('usersStatus', 'يرجى ملء جميع الحقول المطلوبة', true); return; }

    setStatus('usersStatus', 'جاري الإنشاء...');
    try {
      const res  = await apiPost(API.auth, { action: 'users_create', username, display_name: displayName, password, role });
      const data = await res.json();
      if (res.ok) {
        setStatus('usersStatus', `✔ تم إنشاء المستخدم "${username}"`);
        ['newUsername','newDisplayName','newPassword'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        loadUsers();
      } else { setStatus('usersStatus', data.error || 'فشل الإنشاء', true); }
    } catch { setStatus('usersStatus', 'تعذر الاتصال بالخادم', true); }
  });

  /* ================================================================
     APPROVAL QUEUE
     ================================================================ */
  async function loadApprovals() {
    const container = document.getElementById('approvalsList');
    if (!container) return;
    container.innerHTML = '<p style="color:var(--color-text-muted);font-size:.85rem">جاري التحميل...</p>';

    try {
      const res  = await apiPost(API.approval, { action: 'list' });
      const data = await res.json();
      const queue = (data.queue || []).filter(q => q.status === 'pending');

      if (!queue.length) { container.innerHTML = '<p style="color:var(--color-text-muted)">لا توجد تعديلات معلقة ✔</p>'; return; }

      container.innerHTML = '';
      queue.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'approval-item';
        div.innerHTML = `
          <div class="approval-item__meta">
            <span class="approval-item__resource">${item.resource === 'links' ? 'روابط' : 'إعدادات'}</span>
            أُرسل بواسطة <strong>${escapeAttr(item.submitted_by)}</strong>
            في ${new Date(item.created_at).toLocaleString('ar-SA')}
          </div>
          <details>
            <summary style="cursor:pointer;font-size:.82rem;color:var(--color-text-muted)">عرض البيانات</summary>
            <pre style="font-size:.72rem;overflow:auto;max-height:120px;direction:ltr;background:var(--color-surface-2);padding:8px;border-radius:6px;margin-top:6px">${escapeAttr(JSON.stringify(item.payload, null, 2))}</pre>
          </details>
          <div class="approval-item__actions">
            <button class="btn btn--sm btn--approve" data-id="${escapeAttr(item.id)}" data-action="approve">✔ موافقة ونشر</button>
            <button class="btn btn--sm btn--reject"  data-id="${escapeAttr(item.id)}" data-action="reject">✕ رفض</button>
          </div>
        `;

        div.querySelectorAll('button[data-action]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const action = btn.dataset.action;
            const id     = btn.dataset.id;
            let note = '';
            if (action === 'reject') {
              note = prompt('سبب الرفض (اختياري):') || '';
            }
            setStatus('approvalsStatus', 'جاري المعالجة...');
            try {
              const res2  = await apiPost(API.approval, { action, id, note });
              const data2 = await res2.json();
              if (res2.ok) { setStatus('approvalsStatus', action === 'approve' ? '✔ تم النشر' : '✔ تم الرفض'); loadApprovals(); checkApprovalBar(); }
              else setStatus('approvalsStatus', data2.error || 'فشل', true);
            } catch { setStatus('approvalsStatus', 'تعذر الاتصال بالخادم', true); }
          });
        });

        container.appendChild(div);
      });
    } catch { container.innerHTML = '<p style="color:var(--color-danger)">تعذر تحميل قائمة الموافقات</p>'; }
  }

  async function checkApprovalBar() {
    const bar = document.getElementById('approvalBar');
    if (!bar) return;
    try {
      const res  = await apiPost(API.approval, { action: 'list' });
      const data = await res.json();
      const pending = (data.queue || []).filter(q => q.status === 'pending').length;
      bar.hidden = pending === 0;
      const txt = document.getElementById('approvalBarText');
      if (txt) txt.textContent = `لديك ${pending} تعديل${pending > 1 ? 'ات' : ''} بانتظار المراجعة`;
    } catch { /* silent */ }
  }

  /* Refresh approvals when tab clicked */
  document.querySelector('.admin__tab[data-tab="approvals"]')?.addEventListener('click', loadApprovals);
  document.querySelector('.admin__tab[data-tab="users"]')?.addEventListener('click', loadUsers);

  /* ================================================================
     IMPORT / EXPORT
     ================================================================ */
  document.getElementById('exportBtn')?.addEventListener('click', () => {
    const payload = {
      links:       linksState,
      settings:    settingsState,
      exported_at: new Date().toISOString(),
      version:     3,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `atoz-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('importFile')?.addEventListener('change', (e) => {
    const name = e.target.files[0]?.name || '';
    const el   = document.getElementById('importFileName');
    if (el) el.textContent = name || 'لم يتم اختيار ملف';
  });

  document.getElementById('importBtn')?.addEventListener('click', async () => {
    const file = document.getElementById('importFile')?.files[0];
    if (!file) { setStatus('importStatus', 'اختر ملفاً أولاً', true); return; }

    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch { setStatus('importStatus', 'ملف JSON غير صالح', true); return; }

    if (!Array.isArray(payload.links) || typeof payload.settings !== 'object') {
      setStatus('importStatus', 'بنية الملف غير متوافقة', true);
      return;
    }

    if (!confirm('سيتم استبدال البيانات الحالية بالكامل. هل تريد المتابعة؟')) return;

    setStatus('importStatus', 'جاري الاستيراد...');
    try {
      const [lr, sr] = await Promise.all([
        apiPost(API.links,    { links: payload.links }),
        apiPost(API.settings, payload.settings),
      ]);
      if (lr.ok && sr.ok) {
        setStatus('importStatus', '✔ تم الاستيراد — أعد تحميل الصفحة لرؤية التغييرات');
        linksState    = payload.links;
        settingsState = payload.settings;
        renderLinksEditor();
        renderBranchesEditor();
        populateAppearanceFields(settingsState.appearance);
      } else {
        setStatus('importStatus', 'حدث خطأ في أثناء الاستيراد', true);
      }
    } catch { setStatus('importStatus', 'تعذر الاتصال بالخادم', true); }
  });

  /* ================================================================
     INIT — load all data, populate UI
     ================================================================ */
  async function init() {
    /* 1. Fetch CSRF token + current user role */
    try {
      const checkRes  = await fetch(`${API.auth}?action=check`);
      const checkData = await checkRes.json();
      csrfToken   = checkData.csrf_token || '';
      currentRole = checkData.role || 'viewer';

      /* Show role chip in header */
      const roleChip = document.getElementById('headerRole');
      if (roleChip) roleChip.textContent = ROLE_LABELS[currentRole] || currentRole;

      /* Show superadmin-only tabs */
      if (currentRole === 'superadmin') {
        document.getElementById('usersTab')?.removeAttribute('hidden');
        document.getElementById('approvalsTab')?.removeAttribute('hidden');
      }
      /* Show approvals tab for admin too */
      if (['superadmin','admin'].includes(currentRole)) {
        document.getElementById('approvalsTab')?.removeAttribute('hidden');
      }
    } catch { /* continue even if check fails */ }

    /* 2. Load links + settings in parallel */
    try {
      const [linksRes, settingsRes] = await Promise.all([
        fetch(API.links),
        fetch(API.settings),
      ]);
      const linksData = await linksRes.json();
      settingsState   = await settingsRes.json();
      linksState      = linksData.links || [];
    } catch (e) {
      console.error('[AtoZ Admin] init fetch failed:', e);
    }

    /* 3. Render all editors */
    renderLinksEditor();
    renderBranchesEditor();
    populateAppearanceFields(settingsState.appearance);

    /* 4. Populate content fields */
    const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    set('storeNameInput',  settingsState.store_name);
    set('taglineInput',    settingsState.tagline);
    set('websiteUrlInput', settingsState.website_url);
    set('phoneInput',      settingsState.phone);
    set('footerTextInput', settingsState.footer_text);
    set('logoShapeSelect', settingsState.logo_shape || 'circle');

    const glowToggle = document.getElementById('logoGlowToggle');
    if (glowToggle) glowToggle.checked = settingsState.logo_glow !== false;

    const bioEditor = document.getElementById('bioEditor');
    if (bioEditor) bioEditor.innerHTML = settingsState.bio_html || '';

    if (settingsState.logo_url) {
      const prev = document.getElementById('logoPreview');
      if (prev) { prev.src = settingsState.logo_url; prev.hidden = false; }
    }

    /* 5. App links fields */
    const app = settingsState.app_links || {};
    set('androidInput',    app.android || '');
    set('iosInput',        app.ios     || '');
    set('appPositionSelect', app.app_block_position || 'bottom');

    /* 6. Tracking scripts */
    set('trackingHeadInput', settingsState.tracking_scripts_head || '');
    set('trackingBodyInput', settingsState.tracking_scripts_body || '');

    /* 7. Check approval bar (admin+) */
    if (['superadmin','admin'].includes(currentRole)) {
      checkApprovalBar();
    }
  }

  init();
})();
