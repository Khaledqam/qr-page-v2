<?php
// =============================================================
// AtoZ Store — Admin Panel  (v3)
// =============================================================
declare(strict_types=1);

// Secure session bootstrap
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict', 'secure' => isset($_SERVER['HTTPS'])]);
    session_start();
}

// Check remember-me cookie even before rendering
$isLoggedIn = !empty($_SESSION['admin_user']);
if (!$isLoggedIn && !empty($_COOKIE['atoz_rm'])) {
    // The auth API will validate it when JS calls /api/auth.php?action=check
    // We pass $isLoggedIn=false so the login screen renders first,
    // then JS auto-re-authenticates and reloads — cleaner than doing it server-side here.
}

$currentRole = '';
$currentUser = '';
if ($isLoggedIn) {
    $currentUser = $_SESSION['admin_user'];
}
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>لوحة تحكم AtoZ Store</title>
<meta name="robots" content="noindex, nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/admin/admin.css?v=3">
</head>
<body>

<?php if (!$isLoggedIn): ?>
<!-- ========================================================
     LOGIN SCREEN
     ======================================================== -->
<main class="login" id="loginScreen">
  <div class="login__card">
    <h1 class="login__title">لوحة التحكم</h1>

    <label class="login__label" for="username">اسم المستخدم</label>
    <input class="login__input" type="text" id="username" name="username"
           autocomplete="username" required>

    <label class="login__label" for="password">كلمة المرور</label>
    <div class="login__pw-wrap">
      <input class="login__input" type="password" id="password" name="password"
             autocomplete="current-password" required>
      <button class="login__eye" type="button" id="togglePw" aria-label="إظهار/إخفاء كلمة المرور">
        <svg id="eyeIcon" width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
    </div>

    <label class="login__remember">
      <input type="checkbox" id="rememberMe">
      <span>تذكرني لمدة 30 يوماً</span>
    </label>

    <button class="login__btn" type="button" id="loginBtn">دخول</button>
    <p class="login__error" id="loginError" hidden></p>
  </div>
</main>

<?php else: ?>
<!-- ========================================================
     ADMIN DASHBOARD
     ======================================================== -->
<div class="admin" id="adminShell">

  <header class="admin__header">
    <h1>
      <span class="admin__header-logo">⚡</span>
      لوحة تحكم AtoZ
    </h1>
    <div class="admin__header-actions">
      <span class="admin__user-badge" id="userBadge">
        <span id="headerUsername"><?= htmlspecialchars($currentUser) ?></span>
        <span class="admin__role-chip" id="headerRole"></span>
      </span>
      <a class="btn btn--ghost btn--sm" href="/" target="_blank" rel="noopener">← الصفحة</a>
      <button id="logoutBtn" class="btn btn--ghost btn--sm btn--danger">خروج</button>
    </div>
  </header>

  <!-- Pending approvals notification bar (shown only for admin+) -->
  <div id="approvalBar" class="approval-bar" hidden>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    <span id="approvalBarText">لديك تعديلات بانتظار المراجعة</span>
    <button class="btn btn--sm" id="goToApprovalBtn">مراجعتها</button>
  </div>

  <!-- Tab nav -->
  <nav class="admin__tabs" role="tablist">
    <button class="admin__tab admin__tab--active" role="tab" data-tab="links"         aria-selected="true">الروابط</button>
    <button class="admin__tab"                    role="tab" data-tab="content"        aria-selected="false">المحتوى</button>
    <button class="admin__tab"                    role="tab" data-tab="branches"       aria-selected="false">الفروع</button>
    <button class="admin__tab"                    role="tab" data-tab="appearance"     aria-selected="false">المظهر</button>
    <button class="admin__tab"                    role="tab" data-tab="integrations"   aria-selected="false">التكاملات</button>
    <button class="admin__tab"                    role="tab" data-tab="users"          aria-selected="false" id="usersTab" hidden>المستخدمون</button>
    <button class="admin__tab"                    role="tab" data-tab="approvals"      aria-selected="false" id="approvalsTab" hidden>الموافقات</button>
    <button class="admin__tab"                    role="tab" data-tab="import-export"  aria-selected="false">استيراد/تصدير</button>
  </nav>

  <!-- ---- LINKS TAB ---- -->
  <section class="admin__panel" data-panel="links" role="tabpanel">
    <p class="admin__hint">اسحب وأفلت لإعادة الترتيب. كل رابط يمكن تفعيله أو إيقافه بدون حذفه.</p>
    <ul id="linksEditor" class="link-editor-list"></ul>
    <div class="btn-row">
      <button id="addLinkBtn"  class="btn">+ رابط جديد</button>
      <button id="saveLinksBtn" class="btn btn--primary">حفظ الروابط</button>
    </div>
    <p class="admin__status" id="linksStatus"></p>
  </section>

  <!-- ---- CONTENT TAB ---- -->
  <section class="admin__panel" data-panel="content" role="tabpanel" hidden>

    <label class="admin__label" for="storeNameInput">اسم المتجر</label>
    <input class="admin__input" id="storeNameInput" type="text" placeholder="AtoZ.ps - أبو زهرة...">

    <label class="admin__label" for="taglineInput">الشعار / التعريف المختصر</label>
    <input class="admin__input" id="taglineInput" type="text" placeholder="وجهتك الأولى في فلسطين | Expect More...">

    <label class="admin__label">نص التعريف (محرر WYSIWYG)</label>
    <div class="wysiwyg">
      <div class="wysiwyg__toolbar">
        <button type="button" data-cmd="bold"><b>B</b></button>
        <button type="button" data-cmd="italic"><i>I</i></button>
        <button type="button" data-cmd="underline"><u>U</u></button>
        <button type="button" data-cmd="insertUnorderedList">•</button>
        <button type="button" data-cmd="createLink">🔗</button>
      </div>
      <div class="wysiwyg__editor" id="bioEditor" contenteditable="true" dir="rtl"></div>
    </div>

    <label class="admin__label" for="websiteUrlInput">رابط الموقع الإلكتروني</label>
    <input class="admin__input" id="websiteUrlInput" type="url" placeholder="https://www.AtoZ.ps" dir="ltr">

    <label class="admin__label" for="phoneInput">رقم التواصل (يظهر كزر اتصال)</label>
    <input class="admin__input" id="phoneInput" type="text" placeholder="1700111222" dir="ltr">

    <label class="admin__label" for="footerTextInput">نص التذييل (Footer)</label>
    <input class="admin__input" id="footerTextInput" type="text" placeholder="AtoZ Store © {year} — جميع الحقوق محفوظة">
    <p class="admin__hint" style="margin-top:4px">{year} سيُستبدل تلقائياً بالسنة الحالية.</p>

    <label class="admin__label">شعار المتجر (Logo)</label>
    <div class="logo-uploader">
      <img id="logoPreview" class="logo-uploader__preview" src="" alt="معاينة الشعار" hidden>
      <label class="btn" for="logoUpload">📁 رفع شعار</label>
      <input id="logoUpload" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden>
    </div>

    <div class="logo-opts-grid">
      <div>
        <label class="admin__label" for="logoShapeSelect">شكل الشعار</label>
        <select class="admin__input" id="logoShapeSelect">
          <option value="circle">دائري</option>
          <option value="rounded">مربع بحواف دائرية</option>
          <option value="original">أبعاد أصلية</option>
        </select>
      </div>
      <div>
        <label class="admin__label" for="logoGlowToggle">توهج (Glow) حول الشعار</label>
        <label class="toggle-switch">
          <input type="checkbox" id="logoGlowToggle" checked>
          <span class="toggle-switch__slider"></span>
        </label>
      </div>
    </div>

    <button id="saveContentBtn" class="btn btn--primary">حفظ المحتوى</button>
    <p class="admin__status" id="contentStatus"></p>
  </section>

  <!-- ---- BRANCHES TAB ---- -->
  <section class="admin__panel" data-panel="branches" role="tabpanel" hidden>
    <p class="admin__hint">اسحب وأفلت لإعادة ترتيب الفروع. زر واتساب يظهر للزوار فقط إذا أدخلت رقم الواتساب.</p>
    <ul id="branchesEditor" class="link-editor-list"></ul>
    <div class="btn-row">
      <button id="addBranchBtn"  class="btn">+ فرع جديد</button>
      <button id="saveBranchesBtn" class="btn btn--primary">حفظ الفروع</button>
    </div>
    <p class="admin__status" id="branchesStatus"></p>
  </section>

  <!-- ---- APPEARANCE TAB ---- -->
  <section class="admin__panel" data-panel="appearance" role="tabpanel" hidden>
    <p class="admin__hint">تتحكم هذه الخيارات بمظهر صفحة العرض العامة فقط — ولا تؤثر على هذه اللوحة.</p>

    <div class="appearance-grid">
      <div class="appearance-field">
        <label class="admin__label" for="bgColorInput">لون الخلفية</label>
        <input type="color" id="bgColorInput" class="color-input" value="#0c1727">
      </div>
      <div class="appearance-field">
        <label class="admin__label" for="primaryColorInput">اللون الأساسي</label>
        <input type="color" id="primaryColorInput" class="color-input" value="#00bed9">
      </div>
      <div class="appearance-field">
        <label class="admin__label" for="secondaryColorInput">لون النصوص الرئيسية</label>
        <input type="color" id="secondaryColorInput" class="color-input" value="#ffffff">
      </div>
    </div>

    <label class="admin__label" for="layoutStyleSelect">طريقة عرض الروابط</label>
    <select id="layoutStyleSelect" class="admin__input">
      <option value="list">قائمة (رابط أسفل رابط)</option>
      <option value="grid">شبكة (عمودين)</option>
    </select>

    <label class="admin__label" for="cardStyleSelect">شكل بطاقة الرابط</label>
    <select id="cardStyleSelect" class="admin__input">
      <option value="glass">زجاجي (Glassmorphism)</option>
      <option value="elevated">مرتفعة بظل</option>
      <option value="outline">بإطار فقط</option>
      <option value="flat">مسطحة</option>
    </select>

    <label class="admin__label">معاينة مباشرة</label>
    <div id="appearancePreview" class="appearance-preview">
      <div class="appearance-preview__card">
        <span class="appearance-preview__icon"></span>
        <span>مثال رابط</span>
      </div>
    </div>

    <hr class="admin__divider">

    <label class="admin__label">روابط التطبيق (App Store / Play Store)</label>
    <div class="app-links-grid">
      <div>
        <label class="admin__label" for="androidInput">رابط أندرويد (Play Store)</label>
        <input class="admin__input" id="androidInput" type="url" placeholder="https://play.google.com/..." dir="ltr">
      </div>
      <div>
        <label class="admin__label" for="iosInput">رابط آيفون (App Store)</label>
        <input class="admin__input" id="iosInput" type="url" placeholder="https://apps.apple.com/..." dir="ltr">
      </div>
    </div>

    <label class="admin__label" for="appPositionSelect">موضع بلوك التطبيق في الصفحة</label>
    <select id="appPositionSelect" class="admin__input">
      <option value="bottom">أسفل قائمة الروابط (افتراضي)</option>
      <option value="top">أعلى قائمة الروابط</option>
    </select>

    <button id="saveAppearanceBtn" class="btn btn--primary">حفظ المظهر والتطبيقات</button>
    <p class="admin__status" id="appearanceStatus"></p>
  </section>

  <!-- ---- INTEGRATIONS TAB ---- -->
  <section class="admin__panel" data-panel="integrations" role="tabpanel" hidden>
    <p class="admin__hint">
      الصق كود تتبع خارجي (Google Analytics, Meta Pixel, Tawk.to, إلخ). سيُحقن تلقائياً في الصفحة العامة.
      <strong>تحذير: هذه الحقول تُنفَّذ مباشرة في الصفحة — لا تضف أكواداً من مصادر غير موثوقة.</strong>
    </p>

    <label class="admin__label" for="trackingHeadInput">سكريبتات داخل &lt;head&gt; (Analytics, Pixel...)</label>
    <textarea class="admin__textarea" id="trackingHeadInput" rows="6" dir="ltr"
              placeholder="<!-- Google Analytics -->&lt;script async src=&quot;...&quot;&gt;&lt;/script&gt;"></textarea>

    <label class="admin__label" for="trackingBodyInput">سكريبتات قبل &lt;/body&gt; (Live Chat, Widgets...)</label>
    <textarea class="admin__textarea" id="trackingBodyInput" rows="6" dir="ltr"
              placeholder="<!-- Tawk.to -->&lt;script&gt;...&lt;/script&gt;"></textarea>

    <button id="saveIntegrationsBtn" class="btn btn--primary">حفظ التكاملات</button>
    <p class="admin__status" id="integrationsStatus"></p>
  </section>

  <!-- ---- USERS TAB (superadmin only) ---- -->
  <section class="admin__panel" data-panel="users" role="tabpanel" hidden>
    <p class="admin__hint">إدارة مستخدمي لوحة التحكم. المستخدمون من نوع "محرر" يرسلون تعديلاتهم للموافقة قبل النشر.</p>
    <table class="users-table" id="usersTable">
      <thead>
        <tr>
          <th>المستخدم</th>
          <th>الاسم المعروض</th>
          <th>الدور</th>
          <th>إجراءات</th>
        </tr>
      </thead>
      <tbody id="usersTbody"></tbody>
    </table>
    <hr class="admin__divider">
    <h3 class="admin__section-title">إضافة مستخدم جديد</h3>
    <div class="form-grid">
      <div>
        <label class="admin__label" for="newUsername">اسم المستخدم</label>
        <input class="admin__input" id="newUsername" type="text" placeholder="user123" dir="ltr">
      </div>
      <div>
        <label class="admin__label" for="newDisplayName">الاسم المعروض</label>
        <input class="admin__input" id="newDisplayName" type="text" placeholder="محمد أحمد">
      </div>
      <div>
        <label class="admin__label" for="newPassword">كلمة المرور</label>
        <input class="admin__input" id="newPassword" type="password" placeholder="8 أحرف على الأقل" dir="ltr">
      </div>
      <div>
        <label class="admin__label" for="newRole">الدور</label>
        <select class="admin__input" id="newRole">
          <option value="admin">مدير (Admin) — صلاحيات كاملة</option>
          <option value="editor" selected>محرر (Editor) — تعديلات بموافقة</option>
          <option value="viewer">مشاهد (Viewer) — قراءة فقط</option>
        </select>
      </div>
    </div>
    <button id="createUserBtn" class="btn btn--primary">إنشاء المستخدم</button>
    <p class="admin__status" id="usersStatus"></p>
  </section>

  <!-- ---- APPROVALS TAB (admin+ only) ---- -->
  <section class="admin__panel" data-panel="approvals" role="tabpanel" hidden>
    <p class="admin__hint">التعديلات التي أرسلها المحررون وتنتظر موافقتك قبل النشر.</p>
    <div id="approvalsList" class="approvals-list"></div>
    <p class="admin__status" id="approvalsStatus"></p>
  </section>

  <!-- ---- IMPORT/EXPORT TAB ---- -->
  <section class="admin__panel" data-panel="import-export" role="tabpanel" hidden>
    <h3 class="admin__section-title">تصدير نسخة احتياطية</h3>
    <p>يُصدر ملف JSON كامل يحتوي على كل الروابط والإعدادات الحالية.</p>
    <button id="exportBtn" class="btn">⬇ تصدير نسخة احتياطية</button>

    <hr class="admin__divider">

    <h3 class="admin__section-title">استيراد نسخة احتياطية</h3>
    <p>استيراد ملف JSON سبق تصديره (سيُستبدل البيانات الحالية بالكامل):</p>
    <label class="btn" for="importFile">📁 اختيار ملف</label>
    <input id="importFile" type="file" accept="application/json" hidden>
    <span id="importFileName" style="font-size:.85rem;color:var(--color-text-muted)">لم يتم اختيار ملف</span>
    <button id="importBtn" class="btn btn--primary">استيراد</button>
    <p class="admin__status" id="importStatus"></p>
  </section>

</div><!-- .admin -->
<?php endif; ?>

<script src="/admin/admin.js?v=3"></script>
</body>
</html>
