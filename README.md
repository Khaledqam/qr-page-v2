# AtoZ Store — QR Link-in-Bio  v3
**أبو زهرة للإلكترونيات | qr.atoz.ps**

---

## 📁 ملفات المشروع

```
public_html/                  ← جذر الموقع (أو المجلد الفرعي)
├── .htaccess                 ← إعادة التوجيه، HTTPS، رؤوس الأمان
├── index.html                ← الصفحة العامة (Glassmorphism)
│
├── api/                      ← Backend PHP APIs
│   ├── helpers.php           ← دوال مشتركة، RBAC، CSRF
│   ├── auth.php              ← تسجيل الدخول، المستخدمون، Remember-Me
│   ├── links.php             ← إدارة الروابط
│   ├── settings.php          ← إعدادات الموقع
│   ├── upload.php            ← رفع الصور
│   └── approval.php          ← قائمة الموافقات
│
├── assets/
│   ├── css/style.css         ← تصميم الصفحة العامة
│   ├── js/main.js            ← JavaScript الصفحة العامة
│   └── img/icons/            ← الأيقونات والشعارات المرفوعة
│       └── .htaccess         ← منع تشغيل PHP في مجلد الصور
│
├── data/                     ← بيانات JSON (محمية من الوصول المباشر)
│   ├── .htaccess             ← ← مهم: يحجب الوصول المباشر لهذا المجلد
│   ├── links.json
│   ├── settings.json
│   ├── users.json
│   ├── approval_queue.json
│   └── backups/              ← نسخ احتياطية تلقائية (آخر 5)
│
└── dmn/                      ← لوحة التحكم (مخفية عن المحركات)
    ├── dmn.php               ← الواجهة الرئيسية للوحة التحكم
    ├── admin.css
    └── admin.js
```

---

## 🚀 خطوات الرفع على Hosting

### 1. رفع الملفات
ارفع محتويات هذا الزيب مباشرة داخل `public_html` باستخدام FTP أو File Manager.  
إذا كان الموقع في مجلد فرعي (مثل `qr.atoz.ps`) ارفعها داخل ذلك المجلد.

### 2. صلاحيات الملفات
تأكد من الصلاحيات التالية عبر File Manager أو SSH:

```bash
chmod 755 api/ assets/ dmn/ data/
chmod 644 data/*.json
chmod 755 data/backups/
chmod 644 assets/img/icons/*
```

### 3. التحقق من عمل mod_rewrite
يجب أن يكون `mod_rewrite` مفعّلاً على السيرفر (مفعّل افتراضياً على cPanel/LiteSpeed).

### 4. دخول لوحة التحكم
```
https://qr.atoz.ps/AdmN
```
- **المستخدم الافتراضي:** `admin`
- **كلمة المرور:** `admin1234`  ← **غيّرها فوراً من لوحة التحكم**

---

## 🔒 الأمان

| الميزة | التفاصيل |
|--------|----------|
| CSRF Protection | توكن عشوائي في كل طلب POST |
| Password Hashing | bcrypt cost=12 |
| Rate Limiting | 5 محاولات → إيقاف 15 دقيقة |
| Remember-Me | هاش SHA-256، انتهاء 30 يوم، HttpOnly Secure Cookie |
| File Upload | فحص MIME حقيقي + اسم عشوائي + حظر PHP |
| Data Access | `/data/` محجوب تماماً من الويب |
| XSS | strip_tags + escapeAttr في كل مكان |
| SQL Injection | لا توجد قاعدة بيانات — ملفات JSON فقط |

---

## 👥 نظام الأدوار (RBAC)

| الدور | الصلاحيات |
|-------|-----------|
| `superadmin` | كل شيء + إدارة المستخدمين + الموافقة |
| `admin` | روابط، محتوى، فروع، مظهر، استيراد/تصدير |
| `editor` | روابط + محتوى فقط → تذهب للموافقة |
| `viewer` | قراءة فقط (لوحة تحكم فارغة حالياً) |

---

## ✨ المميزات الجديدة في v3

- **Glassmorphism Dark Mode** — خلفية داكنة مع تأثير الزجاج المضبب
- **Tab Switcher** — روابطنا / فروعنا بدون إعادة تحميل
- **Branch Cards** — بطاقة لكل فرع مع زر الخريطة + واتساب (مشروط)
- **App Badges 2-Column** — شارتا المتجر دائماً جنباً إلى جنب
- **Logo Controls** — شكل (دائري/مربع/أصلي) + توهج glow
- **Header Micro-buttons** — رابط الموقع + رقم الهاتف كأزرار أنيقة
- **Multi-User RBAC** — إنشاء مستخدمين بأدوار مختلفة
- **Approval Queue** — تعديلات المحررين تنتظر موافقة المدير
- **Remember Me** — تسجيل دخول آمن لمدة 30 يوم
- **Password Eye Toggle** — عرض/إخفاء كلمة المرور
- **Tracking Scripts** — حقن Google Analytics / Meta Pixel / Tawk.to
- **Branch Drag & Drop** — ترتيب الفروع بالسحب والإفلات
- **Footer / Tagline Controls** — تحكم كامل في نصوص الترويسة والتذييل

---

## 🛠 تغيير كلمة المرور الافتراضية

1. ادخل `/AdmN`
2. تبويب **المستخدمون**
3. عدّل كلمة مرور `admin`

أو عبر SSH:
```php
php -r "echo password_hash('كلمتك_الجديدة', PASSWORD_BCRYPT, ['cost'=>12]);"
```
ثم ضع الناتج في `data/users.json` → `password_hash`.

---

*AtoZ Store © 2026 — أبو زهرة للإلكترونيات*
