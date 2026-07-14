<!-- markdownlint-disable MD033 MD041 MD013 -->
<!--
╔════════════════════════════════════════════════════════════════════╗
║                           رَفّ · RAFF                              ║
║              نظام عربي لفهرسة المكتبات وإدارتها                    ║
║                         الإصدار 2.7.0                              ║
╚════════════════════════════════════════════════════════════════════╝
-->

<a id="top"></a>

<div align="center" dir="rtl">

<img src="assets/icon.png" alt="شعار رَفّ" width="118">

<h1>رَفّ</h1>

<h3>نظام عربي متكامل لفهرسة المكتبات وإدارتها</h3>

<p><strong>أضف الكتاب مرة، امنحه رقمًا مرجعيًا وباركودًا، ثم اعثر عليه وأعِره وأدِر أجزاءه في ثوانٍ.</strong></p>

<p>
  <img src="https://img.shields.io/badge/الإصدار-2.7.0-B0894B?style=for-the-badge&labelColor=3E2C1C" alt="الإصدار 2.7.0">
  <img src="https://img.shields.io/badge/النظام-Windows_64--bit-6F4E37?style=for-the-badge&logo=windows&logoColor=white&labelColor=2A1E17" alt="Windows 64-bit">
  <img src="https://img.shields.io/badge/Electron-31-47848F?style=for-the-badge&logo=electron&logoColor=white&labelColor=263238" alt="Electron 31">
  <img src="https://img.shields.io/badge/الترخيص-MIT-4B6350?style=for-the-badge&labelColor=2F3E33" alt="MIT License">
</p>

<p>
  <img src="https://img.shields.io/badge/Offline_First-Local-4B6350?style=flat-square&labelColor=2F3E33" alt="Offline First">
  <img src="https://img.shields.io/badge/Arabic_RTL-Full-B0894B?style=flat-square&labelColor=5B432C" alt="Arabic RTL">
  <img src="https://img.shields.io/badge/Light_·_Dark-Themes-7A6248?style=flat-square&labelColor=34261C" alt="Light and Dark">
  <img src="https://img.shields.io/badge/Barcode_·_PDF-Ready-8B5E34?style=flat-square&labelColor=3E2C1C" alt="Barcode and PDF">
  <img src="https://img.shields.io/badge/Multi--Volume_Loans-Supported-986C2E?style=flat-square&labelColor=4A3217" alt="Multi-volume loans">
  <img src="https://img.shields.io/badge/No_Ads_·_No_Tracking-Private-4A5568?style=flat-square&labelColor=2D3748" alt="No ads or tracking">
</p>

<p><sub>واجهة عربية كاملة · يعمل محليًا بلا إنترنت · تصميم Minimalist بنّي وذهبي · خصوصية كاملة · مفتوح المصدر</sub></p>

<br>

<a href="https://github.com/Hzifa33/raff/releases/latest">
  <img src="https://img.shields.io/badge/تحميل_أحدث_إصدار-GitHub_Releases-B0894B?style=for-the-badge&labelColor=3E2C1C" alt="تحميل أحدث إصدار">
</a>
&nbsp;
<a href="https://github.com/Hzifa33/raff/issues">
  <img src="https://img.shields.io/badge/الإبلاغ_عن_مشكلة-GitHub_Issues-6F4E37?style=for-the-badge&labelColor=2A1E17" alt="الإبلاغ عن مشكلة">
</a>

</div>

<br>

<div align="center" dir="rtl">

> ### <img src="https://icongr.am/feather/book-open.svg?size=64&color=b0894b" width="21" align="center" alt=""> المعرفة تستحق نظامًا يحفظها،
> ### والكتاب الذي لا يُعثَر عليه كأنه غير موجود.

</div>

<details>
<summary><b><img src="https://icongr.am/feather/compass.svg?size=64&color=b0894b" width="16" align="center" alt=""> فهرس سريع</b></summary>

<div dir="rtl">

- [عن رَفّ](#overview)
- [ما الجديد في 2.7.0](#whats-new)
- [المميزات](#features)
- [الإعارة متعددة الأجزاء](#multi-volume)
- [سلامة البيانات والإصلاح الآمن](#data-integrity)
- [الباركود والطباعة](#barcode)
- [التحميل والتشغيل](#download)
- [الخصوصية والنسخ الاحتياطية](#privacy)
- [المعمارية](#architecture)
- [للمطوّرين](#developers)
- [الأسئلة الشائعة](#faq)
- [الترخيص والمطوّر](#license)

</div>

</details>

<div align="right" dir="rtl">

---

<a id="overview"></a>

## <img src="https://icongr.am/feather/book-open.svg?size=64&color=b0894b" width="19" align="center" alt=""> عن رَفّ

**رَفّ** تطبيق مكتبي عربي لإدارة وفهرسة المكتبات، صُمّم للمكتبات العامة والخاصة، والمدارس والمراكز التعليمية، ومكتبات المساجد والأوقاف، ودور النشر، والباحثين وأمناء المكتبات.

يجمع البرنامج الفهرسة، والجرد، والإعارة، وإدارة الكتب متعددة الأجزاء، والبحث، والباركود، والطباعة، والتقارير، والنسخ الاحتياطية داخل واجهة عربية حديثة تعمل **محليًا بالكامل**.

<table>
<tr>
<td align="center" width="25%"><img src="https://icongr.am/feather/archive.svg?size=64&color=b0894b" width="17" align="center" alt=""><br><b>مكتبات عامة وخاصة</b><br><sub>إدارة آلاف العناوين</sub></td>
<td align="center" width="25%"><img src="https://icongr.am/feather/award.svg?size=64&color=b0894b" width="17" align="center" alt=""><br><b>مدارس ومراكز</b><br><sub>فهرسة وإعارة منظمة</sub></td>
<td align="center" width="25%"><img src="https://icongr.am/feather/bookmark.svg?size=64&color=b0894b" width="17" align="center" alt=""><br><b>مساجد وأوقاف</b><br><sub>حفظ الكتب وتتبعها</sub></td>
<td align="center" width="25%"><img src="https://icongr.am/feather/search.svg?size=64&color=b0894b" width="17" align="center" alt=""><br><b>باحثون وأمناء مكتبات</b><br><sub>وصول سريع ودقيق</sub></td>
</tr>
</table>

### لماذا رَفّ؟

<table>
<tr><td width="31%"><b><img src="https://icongr.am/feather/zap.svg?size=64&color=b0894b" width="17" align="center" alt=""> سريع</b></td><td>بحث فوري، وعرض منظم، وأداء ثابت مع المكتبات الكبيرة.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/compass.svg?size=64&color=b0894b" width="17" align="center" alt=""> واضح</b></td><td>واجهة Minimalist عربية كاملة، وقائمة جانبية قابلة للطي، ووضعان نهاري وليلي.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/lock.svg?size=64&color=b0894b" width="17" align="center" alt=""> خاص</b></td><td>لا حسابات، ولا خوادم، ولا إعلانات، ولا تتبّع؛ بياناتك تبقى على جهازك.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/layers.svg?size=64&color=b0894b" width="17" align="center" alt=""> مرن</b></td><td>كتب مفردة أو متعددة الأجزاء، وإعارة نسخة كاملة أو أجزاء مختارة، وإرجاع جزئي.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/shield.svg?size=64&color=b0894b" width="17" align="center" alt=""> آمن</b></td><td>كتابة ذرية، ونسخ احتياطية، وفحص سلامة، وإصلاح آمن لا يحذف بياناتك بصمت.</td></tr>
</table>

---

<a id="whats-new"></a>

## <img src="https://icongr.am/feather/gift.svg?size=64&color=b0894b" width="19" align="center" alt=""> الجديد في الإصدار 2.7.0

<div align="center" dir="rtl">
<table>
<tr><td align="center">

### إصدار يركّز على الدقة، والاستقرار، وتجربة الاستخدام

**ثيم Minimalist مستوحى من shadcn/ui** · **إعارة عدة أجزاء** · **إرجاع جزء محدد** · **سجل كامل متجاوب** · **ترتيب حسب وقت الإضافة** · **فحص سلامة أكثر ذكاءً** · **إصلاح آمن مع نسخة احتياطية**

</td></tr>
</table>
</div>

### <img src="https://icongr.am/feather/layout.svg?size=64&color=b0894b" width="18" align="center" alt=""> واجهة جديدة أكثر نضجًا
- لغة بصرية Minimalist مستوحاة من **shadcn/ui** مع الحفاظ على هوية رَفّ البنية والذهبية.
- وضع نهاري عاجي هادئ ووضع ليلي بني داكن غير فاحم.
- قائمة جانبية قابلة للطي والفتح بسلاسة، مع شعار مخصص وتلميحات كاملة غير مقطوعة.
- أيقونات ومحاذاة ومسافات موحّدة في جميع الأقسام.
- نوافذ منبثقة متجاوبة، وتمرير داخلي صحيح للمحتوى الطويل.
- نموذج إضافة الكتاب أكثر كثافة وتنظيمًا لتقليل الحاجة إلى التمرير.
- تحسين أحجام لوحة المعلومات والجداول والبطاقات لتناسب الشاشات المكتبية الصغيرة والكبيرة.
- احترام إعداد النظام **تقليل الحركة** لتحسين إمكانية الوصول.

### <img src="https://icongr.am/feather/repeat.svg?size=64&color=b0894b" width="18" align="center" alt=""> إعارة الأجزاء وإرجاعها
- اختيار **جزء واحد أو عدة أجزاء** من الكتاب في إعارة واحدة.
- زر **تحديد كل المتاح** للأجزاء.
- تعطيل الأجزاء غير المتاحة تلقائيًا.
- إرجاع **جزء واحد أو عدة أجزاء** مع بقاء بقية الأجزاء مع المستعير.
- تاريخ إرجاع مستقل لكل جزء، ولا تُغلق الإعارة إلا بعد إعادة آخر جزء.
- احتساب الإتاحة لكل جزء بصورة مستقلة.
- ترقية بيانات الإصدارات القديمة تلقائيًا دون فقدان الإعارات السابقة.

### <img src="https://icongr.am/feather/grid.svg?size=64&color=b0894b" width="18" align="center" alt=""> السجل الكامل
- ترتيب بحسب **وقت الإضافة: الأحدث أو الأقدم**.
- ترتيب بحسب العنوان، والمؤلف، ودار النشر، والمجال، والسنة، والسعر، والأجزاء، والإتاحة، والحالة، والرقم المرجعي.
- تصميم متجاوب يمنع التمرير الأفقي غير الضروري.
- إخفاء الأعمدة الثانوية تدريجيًا على الشاشات الضيقة بدل قطع أسماء الأقسام.
- فلاتر للحالة: الكل، متاح، جزئي، معار، متأخر، ويستحق قريبًا.
- تصفية بمدى السعر، وبحث سريع داخل الجدول.
- ثبات المحتوى في حالتي طي القائمة الجانبية وتوسيعها.

### <img src="https://icongr.am/feather/shield.svg?size=64&color=b0894b" width="18" align="center" alt=""> سلامة البيانات 2.0
- مقارنة الرقم المرجعي **كاملًا** بدل الاعتماد على أجزائه الرقمية.
- الرقم `raf-0001` مختلف تمامًا عن `raf-1001` ولا يُعد تكرارًا.
- توحيد منطقي للحروف الكبيرة والصغيرة، والشرطات، والمسافات، والأرقام العربية والفارسية.
- تطبيق المنطق نفسه عند الإضافة، والتعديل، والاستيراد، والبحث، والباركود، والاستعادة.
- فصل الأخطاء البنيوية عن التحذيرات التشغيلية؛ فالتأخر في الإرجاع ليس تلفًا في قاعدة البيانات.
- زر **إصلاح آمن** ينشئ نسخة احتياطية قبل أي تعديل.
- عدم حذف كتاب أو إعارة تلقائيًا لمجرد الاشتباه في التكرار.

---

<a id="features"></a>

## <img src="https://icongr.am/feather/grid.svg?size=64&color=b0894b" width="19" align="center" alt=""> المميزات

> **رحلة الكتاب في رَفّ:** يُسجّل مرة، ثم يحصل على رقم مرجعي وباركود، ويُطبع له ملصق، ويُبحث عنه أو يُمسح، ويُعار كاملًا أو بأجزاء مختارة، ثم يظهر فورًا في اللوحة والسجل والتقارير.

### <img src="https://icongr.am/feather/book.svg?size=64&color=b0894b" width="18" align="center" alt=""> الفهرسة وبيانات الجرد
<table>
<tr><td width="31%"><b><img src="https://icongr.am/feather/file-text.svg?size=64&color=b0894b" width="17" align="center" alt=""> البيانات الأساسية</b></td><td>العنوان، المؤلف، دار النشر، المجال، الطبعة، سنة النشر، والملاحظات.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/folder.svg?size=64&color=b0894b" width="17" align="center" alt=""> بيانات جرد موسّعة</b></td><td>السلسلة، ترتيب الكتاب داخلها، الكلمات المفتاحية، حالة النسخة، جهة الاقتناء، والرف.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/dollar-sign.svg?size=64&color=b0894b" width="17" align="center" alt=""> السعر والمخزون</b></td><td>السعر، عدد النسخ، وعدد الأجزاء، مع احتساب المتاح والمعار تلقائيًا.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/zap.svg?size=64&color=b0894b" width="17" align="center" alt=""> اقتراحات تلقائية</b></td><td>اقتراح المؤلفين، ودور النشر، والمجالات، والسلاسل، والرفوف أثناء الكتابة.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/clock.svg?size=64&color=b0894b" width="17" align="center" alt=""> وقت الإضافة</b></td><td>تسجيل تاريخ ووقت إضافة كل كتاب، مع دعم الفرز الزمني في السجل الكامل.</td></tr>
</table>

### <img src="https://icongr.am/feather/search.svg?size=64&color=b0894b" width="18" align="center" alt=""> البحث والوصول
<table>
<tr><td width="31%"><b><img src="https://icongr.am/feather/zap.svg?size=64&color=b0894b" width="17" align="center" alt=""> بحث عربي ذكي</b></td><td>لا يتأثر بالتشكيل أو التطويل، ويتعامل مع اختلافات الهمزات والياء والألف المقصورة والتاء المربوطة.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/target.svg?size=64&color=b0894b" width="17" align="center" alt=""> بحث متقدم</b></td><td>العنوان، والمؤلف، ودار النشر، والرقم المرجعي، والمجال، والسلسلة، والرف، والكلمات المفتاحية، والمستعير.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/command.svg?size=64&color=b0894b" width="17" align="center" alt=""> بحث سريع</b></td><td>الوصول إلى البحث من الشريط العلوي واختصار <code>Ctrl + K</code>.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/bar-chart-2.svg?size=64&color=b0894b" width="17" align="center" alt=""> سجل كامل</b></td><td>جدول احترافي للفرز والتصفية والمراجعة الشاملة دون ازدحام أو قص للعناوين.</td></tr>
</table>

### <img src="https://icongr.am/feather/tag.svg?size=64&color=b0894b" width="18" align="center" alt=""> الأرقام المرجعية
<table>
<tr><td width="31%"><b><img src="https://icongr.am/feather/hash.svg?size=64&color=b0894b" width="17" align="center" alt=""> ترقيم ذكي</b></td><td>توليد رقم مرجعي بصيغة <code>raf-NNNN</code> بدءًا من أول رقم متاح مع ملء الفجوات.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/edit-2.svg?size=64&color=b0894b" width="17" align="center" alt=""> قابل للتعديل</b></td><td>تعديل الرقم بعد الإضافة ومن نافذة تفاصيل الكتاب مع حماية حقيقية من التكرار.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/cpu.svg?size=64&color=b0894b" width="17" align="center" alt=""> مطابقة دقيقة</b></td><td>توحيد الاختلافات التنسيقية فقط دون اعتبار أرقام مختلفة مثل <code>raf-0001</code> و<code>raf-1001</code> متكررة.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/globe.svg?size=64&color=b0894b" width="17" align="center" alt=""> أرقام متعددة</b></td><td>التعامل مع الأرقام العربية <code>١٢٣</code> والفارسية <code>۱۲۳</code> واللاتينية <code>123</code> بصورة موحدة.</td></tr>
</table>

<a id="multi-volume"></a>

### <img src="https://icongr.am/feather/repeat.svg?size=64&color=b0894b" width="18" align="center" alt=""> نظام الإعارة متعدد الأجزاء
<table>
<tr><td width="31%"><b><img src="https://icongr.am/feather/package.svg?size=64&color=b0894b" width="17" align="center" alt=""> إعارة كاملة</b></td><td>إعارة نسخة الكتاب كاملة عند الحاجة.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/layers.svg?size=64&color=b0894b" width="17" align="center" alt=""> اختيار عدة أجزاء</b></td><td>اختيار جزء واحد أو عدة أجزاء متاحة داخل عملية إعارة واحدة.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/corner-up-left.svg?size=64&color=b0894b" width="17" align="center" alt=""> إرجاع جزئي</b></td><td>إرجاع جزء أو عدة أجزاء مع إبقاء بقية الأجزاء مسجلة باسم المستعير.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/calendar.svg?size=64&color=b0894b" width="17" align="center" alt=""> تواريخ مستقلة</b></td><td>حفظ تاريخ إرجاع كل جزء على حدة وإغلاق الإعارة بعد اكتمال الإرجاع فقط.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/check-circle.svg?size=64&color=b0894b" width="17" align="center" alt=""> إتاحة مستقلة</b></td><td>احتساب المتاح لكل جزء ومنع إعارة جزء نفدت نسخه.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/clock.svg?size=64&color=b0894b" width="17" align="center" alt=""> مدة قابلة للضبط</b></td><td>7 أو 14 أو 30 أو 60 أو 90 يومًا، أو مدة مخصصة، مع حساب الاستحقاق تلقائيًا.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/user.svg?size=64&color=b0894b" width="17" align="center" alt=""> بيانات المستعير</b></td><td>اسم المستعير، وسيلة التواصل، وملاحظة مستقلة لكل إعارة.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/alert-triangle.svg?size=64&color=b0894b" width="17" align="center" alt=""> تنبيهات ذكية</b></td><td>تمييز المتأخر والمستحق قريبًا، وترتيب الحالات الأهم أولًا.</td></tr>
</table>

### <img src="https://icongr.am/feather/bar-chart-2.svg?size=64&color=b0894b" width="18" align="center" alt=""> لوحة المعلومات والاستدعاءات
<table>
<tr><td width="31%"><b><img src="https://icongr.am/feather/bar-chart-2.svg?size=64&color=b0894b" width="17" align="center" alt=""> نظرة فورية</b></td><td>إجمالي العناوين، والنسخ المتاحة والمعارة، والمستعيرون، والمتأخرات، والمستحق قريبًا.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/pie-chart.svg?size=64&color=b0894b" width="17" align="center" alt=""> جودة البيانات</b></td><td>نسبة اكتمال بيانات الجرد، وعدد الكتب متعددة الأجزاء، وقيمة الكتب المسعّرة، وأعلى كتاب سعرًا.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/compass.svg?size=64&color=b0894b" width="17" align="center" alt=""> استدعاءات متعددة</b></td><td>حسب المستعيرين، ودور النشر، والمؤلفين، والمجالات، والسنوات، والرفوف، والسلاسل، وحالة النسخ.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/file-text.svg?size=64&color=b0894b" width="17" align="center" alt=""> تقارير مجمعة</b></td><td>عرض كل مستعير وكتبه، أو كل تصنيف والقيم والكتب التابعة له، مع إمكان التصدير.</td></tr>
</table>

### <img src="https://icongr.am/feather/monitor.svg?size=64&color=b0894b" width="18" align="center" alt=""> تجربة الاستخدام
<table>
<tr><td width="31%"><b><img src="https://icongr.am/feather/moon.svg?size=64&color=b0894b" width="17" align="center" alt=""> نهاري وليلي</b></td><td>ثيمان هادئان يحافظان على التباين والهوية البنية والذهبية دون أبيض ناصع أو أسود حاد.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/columns.svg?size=64&color=b0894b" width="17" align="center" alt=""> قائمة قابلة للطي</b></td><td>قائمة جانبية منكمشة أو موسعة، مع اختصار <code>Ctrl + B</code> وحفظ الحالة.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/zap.svg?size=64&color=b0894b" width="17" align="center" alt=""> انتقالات محسوبة</b></td><td>حركات قصيرة ومهنية للنوافذ والتنقل دون إبطاء العمل.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/user-check.svg?size=64&color=b0894b" width="17" align="center" alt=""> قابلية وصول</b></td><td>حالات تركيز واضحة، وتنقل بلوحة المفاتيح، واحترام إعداد تقليل الحركة.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/monitor.svg?size=64&color=b0894b" width="17" align="center" alt=""> تصميم متجاوب</b></td><td>تحسين التوزيع على المقاسات المكتبية المختلفة ومنع خروج العناصر من النوافذ.</td></tr>
</table>

---

<a id="data-integrity"></a>

## <img src="https://icongr.am/feather/shield.svg?size=64&color=b0894b" width="19" align="center" alt=""> سلامة البيانات والإصلاح الآمن

صُممت أداة سلامة البيانات لتكون **أداة تشخيص وإصلاح محافظة**، لا أداة حذف تلقائي.

### ما الذي تفحصه؟

- معرّفات الكتب والإعارات المفقودة أو المكررة.
- الأرقام المرجعية الناقصة أو المكررة فعليًا بعد توحيد التنسيق.
- عدد النسخ، وعدد الأجزاء، والإعارات المفتوحة مقارنة بالمخزون.
- الأجزاء المعارة ومدى توافقها مع عدد أجزاء الكتاب.
- تواريخ الإعارة والاستحقاق والإرجاع.
- السجلات ذات البيانات الناقصة أو غير المتسقة.
- العناوين المتشابهة المحتملة بصفتها **تنبيهًا للمراجعة** لا دليلًا قاطعًا على التكرار.

### كيف تتم مقارنة الأرقام المرجعية؟

```text
raf-0001  ≠  raf-1001
```

أما الاختلافات التنسيقية التي تمثل الرقم نفسه فيمكن توحيدها، مثل اختلاف حالة الأحرف، أو نوع الشرطة، أو شكل الأرقام العربية والفارسية واللاتينية.

### ماذا يفعل «الإصلاح الآمن»؟

1. ينشئ نسخة احتياطية قبل أي تعديل.
2. يصلح المشكلات الحتمية والواضحة فقط.
3. يحافظ على أقدم سجل عند وجود تكرار حقيقي، ويولّد رقمًا متاحًا للسجل الآخر.
4. لا يحذف كتابًا أو إعارة بصمت.
5. يعرض نتيجة الإصلاح والتغييرات التي أُجريت.

> **مهم:** الإعارة المتأخرة حالة تشغيلية تحتاج متابعة، لكنها لا تعني أن ملف البيانات تالف.

---

<a id="barcode"></a>

## <img src="https://icongr.am/feather/maximize.svg?size=64&color=b0894b" width="19" align="center" alt=""> الباركود والمسح الضوئي والطباعة

<table>
<tr><td width="31%"><b><img src="https://icongr.am/feather/bar-chart.svg?size=64&color=b0894b" width="17" align="center" alt=""> باركود Code 128</b></td><td>يُولد محليًا من الرقم المرجعي لكل كتاب دون خدمة خارجية.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/maximize.svg?size=64&color=b0894b" width="17" align="center" alt=""> قارئ USB</b></td><td>يعمل كلوحة مفاتيح ويمكنه استدعاء بيانات الكتاب من أي شاشة.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/zap.svg?size=64&color=b0894b" width="17" align="center" alt=""> نتيجة فورية</b></td><td>إظهار العنوان، والمؤلف، والرقم، والسعر، والأجزاء، والإتاحة، والإعارات المفتوحة.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/printer.svg?size=64&color=b0894b" width="17" align="center" alt=""> طباعة مباشرة</b></td><td>طباعة ملصق الكتاب من نافذة التفاصيل أو بعد الإضافة.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/file-text.svg?size=64&color=b0894b" width="17" align="center" alt=""> حفظ PDF</b></td><td>ملصق مفرد أو دفعات حسب الرف أو المجال أو السلسلة أو نطاق الأرقام المرجعية.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/tag.svg?size=64&color=b0894b" width="17" align="center" alt=""> هوية المكتبة</b></td><td>إضافة اسم المؤسسة وشعارها إلى الملصق مع ضبط المقاسات على ورق A4.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/layout.svg?size=64&color=b0894b" width="17" align="center" alt=""> إعدادات مرنة</b></td><td>عدد أعمدة الملصقات وحجمها وتفاصيلها من قسم «الإعدادات والنسخ».</td></tr>
</table>

---

<a id="download"></a>

## <img src="https://icongr.am/feather/download.svg?size=64&color=b0894b" width="19" align="center" alt=""> التحميل والتشغيل

<div align="center" dir="rtl">

### حمّل النسخة الرسمية فقط من GitHub Releases

[![Download Latest Release](https://img.shields.io/badge/تحميل_رَفّ_2.7.0-GitHub_Releases-B0894B?style=for-the-badge&labelColor=3E2C1C)](https://github.com/Hzifa33/raff/releases/latest)

</div>

### <img src="https://icongr.am/feather/play-circle.svg?size=64&color=b0894b" width="18" align="center" alt=""> البدء في ثلاث خطوات
1. حمّل ملف التثبيت أو النسخة المحمولة من صفحة الإصدارات.
2. افتح رَفّ وأضف أول كتاب، أو استورد نسخة احتياطية سابقة.
3. اضبط اسم المكتبة، ومدة الإعارة، وخيارات الملصقات من **الإعدادات والنسخ**.

### متطلبات التشغيل

<table>
<tr><td width="31%"><b><img src="https://icongr.am/feather/monitor.svg?size=64&color=b0894b" width="17" align="center" alt=""> نظام التشغيل</b></td><td><b>Windows 10 أو Windows 11</b>، بنواة 64-بت.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/cpu.svg?size=64&color=b0894b" width="17" align="center" alt=""> الذاكرة</b></td><td>2 جيجابايت RAM على الأقل، ويُفضّل 4 جيجابايت أو أكثر للمكتبات الكبيرة.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/hard-drive.svg?size=64&color=b0894b" width="17" align="center" alt=""> مساحة القرص</b></td><td>نحو 250 ميجابايت للبرنامج، إضافة إلى مساحة صغيرة للبيانات والنسخ الاحتياطية.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/globe.svg?size=64&color=b0894b" width="17" align="center" alt=""> الإنترنت</b></td><td>غير مطلوب للتشغيل أو الفهرسة أو البحث أو الباركود أو الطباعة.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/maximize.svg?size=64&color=b0894b" width="17" align="center" alt=""> قارئ الباركود</b></td><td>اختياري؛ يعمل أي قارئ USB يتصرف كلوحة مفاتيح.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/printer.svg?size=64&color=b0894b" width="17" align="center" alt=""> الطابعة</b></td><td>اختيارية؛ تكفي طابعة مكتبية عادية تدعم ورق A4.</td></tr>
</table>

### <img src="https://icongr.am/feather/command.svg?size=64&color=b0894b" width="18" align="center" alt=""> اختصارات مفيدة
<table>
<tr><td><code>Ctrl + K</code></td><td>الانتقال إلى البحث السريع.</td></tr>
<tr><td><code>Ctrl + B</code></td><td>طي القائمة الجانبية أو توسيعها.</td></tr>
<tr><td><code>Ctrl + Shift + L</code></td><td>التبديل بين الوضع النهاري والليلي.</td></tr>
</table>

### <img src="https://icongr.am/feather/lock.svg?size=64&color=b0894b" width="18" align="center" alt=""> التحقق من سلامة ملف الإصدار
<details open>
<summary><b>حساب SHA256 على Windows PowerShell</b></summary>

<br>

```powershell
Get-FileHash ".\اسم-ملف-الإصدار.exe" -Algorithm SHA256
```

أو باستخدام الأداة المدمجة الأخرى:

```powershell
certutil -hashfile ".\اسم-ملف-الإصدار.exe" SHA256
```

قارن القيمة الناتجة بملف <code>.sha256</code> المنشور مع الإصدار نفسه على GitHub. يجب أن يتطابق النص كاملًا.

</details>

<details>
<summary><b><img src="https://icongr.am/feather/alert-triangle.svg?size=64&color=b0894b" width="17" align="center" alt=""> ملاحظة حول Windows SmartScreen</b></summary>

<br>

قد يعرض Windows تنبيه **Unknown Publisher** إذا لم يكن الإصدار موقّعًا بشهادة Code Signing مدفوعة. لا تعتمد على التنبيه وحده للحكم على الملف:

- حمّل من صفحة GitHub Releases الرسمية فقط.
- قارن قيمة SHA256.
- لا تستخدم نسخًا معاد رفعها من مصادر مجهولة.

</details>

---

<a id="privacy"></a>

## <img src="https://icongr.am/feather/lock.svg?size=64&color=b0894b" width="19" align="center" alt=""> الخصوصية والنسخ الاحتياطية

<div align="center" dir="rtl">

> ### بيانات مكتبتك تبقى على جهازك.

</div>

رَفّ لا يقوم بـ:

- إنشاء حساب مستخدم أو إجبارك على تسجيل الدخول.
- رفع بيانات الكتب أو المستعيرين إلى خادم خارجي.
- تتبع الاستخدام أو جمع التحليلات.
- عرض الإعلانات.
- بيع البيانات أو مشاركتها.

### مكان البيانات

تُحفظ بيانات المكتبة في ملف محلي داخل مجلد بيانات التطبيق:

```text
raff-library.json
```

وتُحفظ النسخ الاحتياطية داخل:

```text
backups/
```

يمكن الوصول إلى المجلد مباشرة من زر **فتح مجلد بيانات البرنامج** داخل قسم **الإعدادات والنسخ**.

### النسخ الاحتياطية

- نسخة تلقائية قبل الاستيراد.
- نسخة تلقائية قبل العمليات الحساسة.
- نسخة تلقائية قبل الإصلاح الآمن لسلامة البيانات.
- إنشاء نسخة فورية يدويًا.
- الاحتفاظ بأحدث النسخ وفق سياسة التطبيق لتجنب تراكم الملفات بلا حد.
- استيراد نسخة قديمة مع ترقية بنية البيانات تلقائيًا.

---

<a id="architecture"></a>

## <img src="https://icongr.am/feather/layers.svg?size=64&color=b0894b" width="19" align="center" alt=""> المعمارية

رَفّ تطبيق سطح مكتب مبني على **Electron**، بواجهة عربية من **HTML وCSS وJavaScript**، ومخزن بيانات محلي خفيف دون حاجة إلى خادم أو قاعدة بيانات خارجية.

<table>
<tr><td width="31%"><b><img src="https://icongr.am/feather/settings.svg?size=64&color=b0894b" width="17" align="center" alt=""> Electron 31</b></td><td>تطبيق Windows حديث يجمع Chromium وNode.js في حزمة مكتبية واحدة.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/layers.svg?size=64&color=b0894b" width="17" align="center" alt=""> واجهة خفيفة</b></td><td>HTML وCSS وJavaScript خالص، مع نظام تصميم دلالي مستوحى من shadcn/ui دون تحويل المشروع إلى إطار ثقيل.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/lock.svg?size=64&color=b0894b" width="17" align="center" alt=""> عزل العمليات</b></td><td><code>contextIsolation</code> وجسر <code>preload</code> محدود بدل إتاحة نظام الملفات مباشرة للواجهة.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/database.svg?size=64&color=b0894b" width="17" align="center" alt=""> تخزين محلي</b></td><td>ملف JSON قابل للنقل والنسخ، مع كتابة آمنة وترقية تلقائية للمخطط.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/zap.svg?size=64&color=b0894b" width="17" align="center" alt=""> أداء عملي</b></td><td>فهرسة في الذاكرة، وتقليل عمليات إعادة الرسم، وعرض منظم للبيانات الكبيرة.</td></tr>
<tr><td><b><img src="https://icongr.am/feather/shield.svg?size=64&color=b0894b" width="17" align="center" alt=""> حدود أمنية</b></td><td>سياسة أمان محتوى، والتحقق من الملفات والصور، وتوليد الباركود محليًا.</td></tr>
</table>

### تدفق البيانات

```text
واجهة المستخدم
     │
     v
Preload API آمن
     │
     v
Electron Main Process
     │
     ├── قراءة وكتابة ذرية
     ├── نسخ احتياطية
     ├── استيراد وتصدير
     └── طباعة وحفظ PDF
     │
     v
raff-library.json
```

---

<a id="developers"></a>

## <img src="https://icongr.am/feather/code.svg?size=64&color=b0894b" width="19" align="center" alt=""> للمطوّرين

### تشغيل المشروع محليًا

```bash
git clone https://github.com/Hzifa33/raff.git
cd raff
npm install
npm start
```

### بناء نسخة Windows

```bash
npm run dist:win
```

تظهر ملفات البناء داخل مجلد:

```text
release/
```

### بنية المشروع

<div dir="ltr">

```text
raff/
├── main.js
├── preload.js
├── package.json
├── src/
│   ├── index.html
│   ├── css/
│   └── js/
├── assets/
├── tests/
└── .github/
    └── workflows/
```

</div>

<table>
<tr><td><code>main.js</code></td><td>تشغيل Electron ومعالجات الملفات والطباعة والنسخ الاحتياطية.</td></tr>
<tr><td><code>preload.js</code></td><td>واجهة آمنة بين العملية الرئيسية وواجهة المستخدم.</td></tr>
<tr><td><code>src/index.html</code></td><td>البنية الأساسية للواجهة العربية.</td></tr>
<tr><td><code>src/css/</code></td><td>نظام التصميم، والثيمان، والاستجابة، والحركات.</td></tr>
<tr><td><code>src/js/</code></td><td>الفهرسة، والبحث، والإعارة، والأجزاء، والتقارير، والباركود، وسلامة البيانات.</td></tr>
<tr><td><code>assets/</code></td><td>الشعار، والأيقونات، والخطوط، والموارد البصرية.</td></tr>
<tr><td><code>tests/</code></td><td>اختبارات المنطق الحساس مثل الأرقام المرجعية وسلامة البيانات.</td></tr>
<tr><td><code>.github/workflows/</code></td><td>بناء إصدارات Windows آليًا عبر GitHub Actions.</td></tr>
</table>

### مبادئ المساهمة

- حافظ على دعم العربية واتجاه RTL في كل تغيير.
- لا تضف اتصالًا خارجيًا أو تتبعًا دون ضرورة وموافقة واضحة.
- أضف اختبارًا لأي تعديل يمس الأرقام المرجعية أو الإعارات أو إصلاح البيانات.
- لا تُصلح بيانات المستخدم بطريقة مدمرة أو صامتة.
- اختبر الواجهة في الوضعين النهاري والليلي، ومع القائمة المطوية والموسعة.
- حافظ على التوافق مع ملفات البيانات القديمة.

---

## <img src="https://icongr.am/feather/alert-circle.svg?size=64&color=b0894b" width="19" align="center" alt=""> الإبلاغ عن مشكلة

افتح Issue واضحًا يتضمن:

- إصدار رَفّ.
- إصدار Windows.
- وصف المشكلة والنتيجة المتوقعة.
- خطوات إعادة ظهور المشكلة.
- لقطة شاشة أو سجل الخطأ إن وجد.
- نسخة بيانات منزوعة المعلومات الحساسة عند ارتباط الخطأ بسلامة البيانات.

<div align="center" dir="rtl">

[![Open an Issue](https://img.shields.io/badge/فتح_Issue_جديدة-GitHub-6F4E37?style=for-the-badge&logo=github&logoColor=white&labelColor=2A1E17)](https://github.com/Hzifa33/raff/issues/new)

</div>

---

<a id="faq"></a>

## <img src="https://icongr.am/feather/help-circle.svg?size=64&color=b0894b" width="19" align="center" alt=""> الأسئلة الشائعة

<details>
<summary><b>هل يحتاج رَفّ إلى الإنترنت؟</b></summary>

<br>

لا. الفهرسة، والبحث، والإعارة، والباركود، والتقارير، والطباعة، والنسخ الاحتياطية تعمل محليًا.

</details>

<details>
<summary><b>هل يمكن إعارة أكثر من جزء من الكتاب نفسه؟</b></summary>

<br>

نعم. يمكن اختيار جزء واحد أو عدة أجزاء في إعارة واحدة، ثم إرجاع جزء أو عدة أجزاء مع بقاء البقية مسجلة على المستعير.

</details>

<details>
<summary><b>هل raf-0001 وraf-1001 رقمان متكرران؟</b></summary>

<br>

لا. هما رقمان مرجعيان مختلفان. يقارن رَفّ الرقم كاملًا، ويُوحّد فقط الاختلافات التنسيقية التي تمثل القيمة نفسها.

</details>

<details>
<summary><b>هل يفقد البرنامج بياناتي عند التحديث؟</b></summary>

<br>

صُممت ترقية المخطط للحفاظ على البيانات القديمة، وتُنشأ نسخ احتياطية قبل العمليات الحساسة. ومع ذلك يُنصح دائمًا بالاحتفاظ بنسخة خارجية دورية.

</details>

<details>
<summary><b>أين أجد النسخ الاحتياطية والإعدادات؟</b></summary>

<br>

داخل تبويب **الإعدادات والنسخ**، ويمكن فتح مجلد البيانات المحلي مباشرة من داخله.

</details>

<details>
<summary><b>هل البرنامج مناسب لمكتبة كبيرة؟</b></summary>

<br>

نعم؛ صُممت عمليات البحث والسجل الكامل والعرض على دفعات لتبقى عملية مع آلاف العناوين، مع اختلاف الأداء حسب مواصفات الجهاز وحجم البيانات.

</details>

---

<a id="license"></a>

## <img src="https://icongr.am/feather/award.svg?size=64&color=b0894b" width="19" align="center" alt=""> الترخيص والمطوّر

هذا المشروع مرخّص برخصة **MIT**، ومقدّم لخدمة المكتبات ومبادرات المعرفة.

<div align="center" dir="rtl">

### <img src="https://icongr.am/feather/code.svg?size=64&color=b0894b" width="18" align="center" alt=""> تطوير
## **Hzifa33**

[![Personal Website](https://img.shields.io/badge/الموقع_الشخصي-Hzifa33.github.io-B0894B?style=for-the-badge&logo=github&logoColor=white&labelColor=3E2C1C)](https://Hzifa33.github.io)

<br>

---

<br>

<em>المعرفة تستحق نظامًا يحفظها،<br>والكتاب الذي لا يُعثَر عليه كأنه غير موجود.</em>

<br>

<b>رَفّ</b> يجعل لكل كتاب مكانًا، ولكل باحث طريقًا أسرع إلى المعرفة.

<br><br>

<sub>يعمل محليًا · يحترم الخصوصية · مفتوح المصدر برخصة MIT</sub>

<br><br>

<img src="https://icongr.am/feather/star.svg?size=64&color=b0894b" width="17" align="center" alt=""> إن أعجبك المشروع، ادعمه بنجمة على GitHub.

<br><br>

<a href="#top">العودة إلى الأعلى</a>

</div>

</div>
