'use strict';

/* =========================================================
   Shared helpers
   ========================================================= */
function escapeHtml(str) {
  return (str ?? '').toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Normalizes Arabic text for forgiving search matching:
 * - strips diacritics (tashkeel) and the tatweel elongation mark
 * - unifies alef forms (أ إ آ ٱ) to ا
 * - unifies ta marbuta (ة) with ha (ه)
 * - unifies alef maqsura (ى) with ya (ي)
 * - unifies hamza-carrying waw/ya (ؤ ئ) with their base letter
 * So searching "ا" also matches "أ", "إ", "آ", and so on across the text.
 */
function normalizeArabic(str) {
  return (str ?? '').toString()
    .replace(/[\u064B-\u0652\u0670\u06D6-\u06ED\u0640]/g, '') // tashkeel + tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .trim();
}

function bookMatchesQuery(book, query, field) {
  if (!query) return true;
  const q = normalizeArabic(query);
  const hay = {
    all: [book.title, book.author, book.publisher, book.referenceNumber, book.category].join(' '),
    title: book.title,
    author: book.author,
    publisher: book.publisher,
    referenceNumber: book.referenceNumber,
    category: book.category,
  };
  return normalizeArabic(hay[field] || hay.all).includes(q);
}

function sortBooks(books, sortKey) {
  const arr = [...books];
  switch (sortKey) {
    case 'title-asc': return arr.sort((a, b) => a.title.localeCompare(b.title, 'ar'));
    case 'author-asc': return arr.sort((a, b) => a.author.localeCompare(b.author, 'ar'));
    case 'oldest': return arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    case 'newest':
    default: return arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

function renderBookRow(book) {
  const spine = spineColorFor(book.category || book.author);
  const statusBadge = book.status === 'معار'
    ? `<span class="badge badge-borrowed">معار${book.borrowerName ? ' — ' + escapeHtml(book.borrowerName) : ''}</span>`
    : `<span class="badge badge-available">متاح</span>`;

  return `
    <div class="book-row" data-id="${book.id}">
      <div class="spine" style="background:${spine};"></div>
      <div class="book-title-cell">
        <div class="book-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title) || 'بدون عنوان'}</div>
        <div class="book-ref">${icon('hash')} ${escapeHtml(book.referenceNumber) || 'بدون رقم مرجعي'}</div>
      </div>
      <div class="book-meta-cell">
        <span class="book-meta-label">المؤلف</span>
        ${escapeHtml(book.author) || '—'}
      </div>
      <div class="book-meta-cell hide-narrow">
        <span class="book-meta-label">دار النشر</span>
        ${escapeHtml(book.publisher) || '—'}
      </div>
      <div class="book-meta-cell hide-narrow">
        <span class="book-meta-label">التصنيف</span>
        ${escapeHtml(book.category) || '—'}
      </div>
      <div>${statusBadge}</div>
      <div class="row-actions">
        <button class="btn btn-outline btn-icon" data-action="edit" data-id="${book.id}" title="تعديل">${icon('edit')}</button>
        <button class="btn btn-outline btn-icon" data-action="delete" data-id="${book.id}" title="حذف">${icon('trash')}</button>
      </div>
    </div>`;
}

function renderEmptyState({ title, desc, actionLabel, actionRoute }) {
  return `
    <div class="empty-state">
      ${icon('book')}
      <h3>${title}</h3>
      <p>${desc}</p>
      ${actionRoute ? `<button class="btn btn-primary" data-nav="${actionRoute}">${icon('plus')} ${actionLabel}</button>` : ''}
    </div>`;
}

/* =========================================================
   Dashboard
   ========================================================= */
function renderDashboard(root) {
  const { stats, books } = RAFF_STATE;
  const recent = sortBooks(books, 'newest').slice(0, 5);
  const topCategories = Object.entries(stats.byCategory || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCat = Math.max(1, ...topCategories.map((c) => c[1]));

  root.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-value">${stats.totalBooks ?? 0}</div>
        <div class="stat-label">إجمالي الكتب</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalAuthors ?? 0}</div>
        <div class="stat-label">عدد المؤلفين</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalPublishers ?? 0}</div>
        <div class="stat-label">دور النشر</div>
      </div>
      <div class="stat-card stat-danger">
        <div class="stat-value">${stats.borrowed ?? 0}</div>
        <div class="stat-label">كتب معارة حالياً</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">أحدث الإضافات</h2>
          <p class="panel-desc">آخر الكتب التي أُضيفت إلى المكتبة</p>
        </div>
        <button class="btn btn-outline btn-sm" data-nav="library">عرض السجل الكامل</button>
      </div>
      <div class="book-list">
        ${recent.length ? recent.map(renderBookRow).join('') : renderEmptyState({
          title: 'المكتبة فارغة حتى الآن',
          desc: 'ابدأ ببناء فهرسك عبر إضافة أول كتاب.',
          actionLabel: 'إضافة كتاب جديد',
          actionRoute: 'add',
        })}
      </div>
    </div>

    ${topCategories.length ? `
    <div class="panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">توزيع التصنيفات</h2>
          <p class="panel-desc">أكثر التصنيفات عدداً في المكتبة</p>
        </div>
      </div>
      <div class="bar-chart">
        ${topCategories.map(([cat, count]) => `
          <div class="bar-row">
            <div class="bar-row-label">${escapeHtml(cat)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${(count / maxCat) * 100}%;"></div></div>
            <div class="bar-row-value">${count}</div>
          </div>`).join('')}
      </div>
    </div>` : ''}
  `;
}

/* =========================================================
   Browse / Search (shared component, two entry points)
   ========================================================= */
let _browserFilters = { query: '', field: 'all', status: 'all', sort: 'newest' };

function renderBookBrowser(root, { presetQuery } = {}) {
  if (presetQuery !== undefined) _browserFilters.query = presetQuery;
  const f = _browserFilters;

  let results = RAFF_STATE.books.filter((b) => bookMatchesQuery(b, f.query, f.field));
  if (f.status !== 'all') results = results.filter((b) => b.status === f.status);
  results = sortBooks(results, f.sort);

  root.innerHTML = `
    <div class="panel">
      <div class="filters-row">
        <select id="filterField">
          <option value="all" ${f.field === 'all' ? 'selected' : ''}>كل الحقول</option>
          <option value="title" ${f.field === 'title' ? 'selected' : ''}>العنوان</option>
          <option value="author" ${f.field === 'author' ? 'selected' : ''}>المؤلف</option>
          <option value="publisher" ${f.field === 'publisher' ? 'selected' : ''}>دار النشر</option>
          <option value="referenceNumber" ${f.field === 'referenceNumber' ? 'selected' : ''}>الرقم المرجعي</option>
          <option value="category" ${f.field === 'category' ? 'selected' : ''}>التصنيف</option>
        </select>
        <input type="text" id="filterQuery" placeholder="اكتب كلمة البحث..." value="${escapeHtml(f.query)}" />
        <div class="chip-toggle" id="statusToggle">
          <button data-val="all" class="${f.status === 'all' ? 'active' : ''}">الكل</button>
          <button data-val="متاح" class="${f.status === 'متاح' ? 'active' : ''}">متاح</button>
          <button data-val="معار" class="${f.status === 'معار' ? 'active' : ''}">معار</button>
        </div>
        <select id="filterSort">
          <option value="newest" ${f.sort === 'newest' ? 'selected' : ''}>الأحدث أولاً</option>
          <option value="oldest" ${f.sort === 'oldest' ? 'selected' : ''}>الأقدم أولاً</option>
          <option value="title-asc" ${f.sort === 'title-asc' ? 'selected' : ''}>ترتيب حسب العنوان</option>
          <option value="author-asc" ${f.sort === 'author-asc' ? 'selected' : ''}>ترتيب حسب المؤلف</option>
        </select>
        <span class="text-muted" style="font-size:12.5px; margin-inline-start:auto;">${results.length} نتيجة</span>
      </div>

      <div class="book-list">
        ${results.length ? results.map(renderBookRow).join('') : renderEmptyState({
          title: 'لا توجد نتائج مطابقة',
          desc: 'جرّب كلمة بحث مختلفة أو غيّر الفلاتر المستخدمة.',
        })}
      </div>
    </div>
  `;

  root.querySelector('#filterField').addEventListener('change', (e) => {
    _browserFilters.field = e.target.value;
    renderBookBrowser(root);
  });
  root.querySelector('#filterQuery').addEventListener('input', (e) => {
    _browserFilters.query = e.target.value;
    renderBookBrowser(root);
  });
  root.querySelector('#filterSort').addEventListener('change', (e) => {
    _browserFilters.sort = e.target.value;
    renderBookBrowser(root);
  });
  root.querySelector('#statusToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-val]');
    if (!btn) return;
    _browserFilters.status = btn.dataset.val;
    renderBookBrowser(root);
  });
}

function showSavedBookModal(record, { andNew = false } = {}) {
  const html = `
    <div class="modal-body">
      <div class="ref-modal-icon">${icon('check')}</div>
      <p class="ref-book-title">${escapeHtml(record.title)}</p>
      <p class="ref-book-author">${escapeHtml(record.author) || 'بدون مؤلف محدد'}</p>

      <div class="ref-number-box">
        <div class="ref-number-label">الرقم المرجعي للكتاب</div>
        <div class="ref-number-value" id="refNumberValue">${escapeHtml(record.referenceNumber)}</div>
      </div>
      <p class="ref-hint">دوّن هذا الرقم على الكتاب لتحديد موقعه على الرف لاحقاً</p>

      <div class="form-actions" style="justify-content:center;">
        <button class="btn btn-outline" id="copyRefBtn">${icon('hash')} نسخ الرقم</button>
        <button class="btn btn-primary" id="closeRefModal">${icon('check')} تم</button>
      </div>
    </div>`;

  openModal(html, {
    onMount: (overlay) => {
      overlay.querySelector('#copyRefBtn').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(record.referenceNumber);
          toast('تم نسخ الرقم المرجعي', 'success', 1800);
        } catch (_) {
          toast('تعذّر نسخ الرقم', 'error');
        }
      });
      overlay.querySelector('#closeRefModal').addEventListener('click', closeModal);
    },
  });
}

/* =========================================================
   Add / Edit form
   ========================================================= */
function renderAddForm(root, editingBook) {
  const b = editingBook || {};
  const isEdit = !!editingBook;
  const meta = RAFF_STATE.meta;

  root.innerHTML = `
    <div class="panel" style="max-width:840px;">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">${isEdit ? 'تعديل بيانات الكتاب' : 'إضافة كتاب جديد'}</h2>
          <p class="panel-desc">الحقول المميزة بعلامة * إلزامية</p>
        </div>
      </div>

      <form id="bookForm" novalidate>
        <div class="form-grid">
          <div class="field span-2" id="field-title">
            <label>${icon('book')} اسم الكتاب <span class="required">*</span></label>
            <input type="text" name="title" value="${escapeHtml(b.title)}" placeholder="مثال: مقدمة ابن خلدون" />
            <span class="error-msg hidden">هذا الحقل مطلوب</span>
          </div>

          <div class="field" id="field-author">
            <label>${icon('user')} المؤلف <span class="required">*</span></label>
            <input type="text" name="author" list="authorsList" value="${escapeHtml(b.author)}" placeholder="اسم المؤلف" />
            <datalist id="authorsList">${meta.authors.map((a) => `<option value="${escapeHtml(a)}">`).join('')}</datalist>
            <span class="error-msg hidden">هذا الحقل مطلوب</span>
          </div>

          <div class="field" id="field-publisher">
            <label>${icon('building')} دار النشر</label>
            <input type="text" name="publisher" list="publishersList" value="${escapeHtml(b.publisher)}" placeholder="اسم دار النشر" />
            <datalist id="publishersList">${meta.publishers.map((p) => `<option value="${escapeHtml(p)}">`).join('')}</datalist>
          </div>

          ${isEdit ? `
          <div class="field" id="field-referenceNumber">
            <label>${icon('hash')} الرقم المرجعي</label>
            <input type="text" name="referenceNumber" value="${escapeHtml(b.referenceNumber)}" />
            <span class="hint">أُنشئ تلقائياً عند الإضافة، ويمكن تعديله يدوياً عند الحاجة فقط</span>
          </div>` : `
          <div class="field">
            <label>${icon('hash')} الرقم المرجعي</label>
            <input type="text" value="سيُنشأ تلقائياً بعد الحفظ" disabled />
            <span class="hint">سيظهر لك في نافذة منبثقة بعد الحفظ لتدوينه على الكتاب</span>
          </div>`}

          <div class="field">
            <label>${icon('tag')} المجال / التصنيف</label>
            <input type="text" name="category" list="categoriesList" value="${escapeHtml(b.category)}" placeholder="مثال: أدب، لغة عربية، تفسير، فقه" />
            <datalist id="categoriesList">
              ${['تفسير', 'حديث', 'فقه', 'عقيدة', 'أدب', 'لغة عربية', 'تاريخ', 'سيرة', 'تزكية وأخلاق', ...meta.categories]
                .filter((v, i, arr) => v && arr.indexOf(v) === i)
                .map((c) => `<option value="${escapeHtml(c)}">`).join('')}
            </datalist>
          </div>

          <div class="field">
            <label>${icon('layers')} الطبعة</label>
            <input type="text" name="edition" value="${escapeHtml(b.edition)}" placeholder="مثال: الطبعة الثالثة" />
          </div>

          <div class="field">
            <label>${icon('calendar')} سنة النشر</label>
            <input type="text" name="publishYear" value="${escapeHtml(b.publishYear)}" placeholder="مثال: 1432هـ" />
          </div>

          <div class="field">
            <label>${icon('copies')} عدد النسخ</label>
            <input type="number" name="copiesTotal" min="1" value="${b.copiesTotal || 1}" />
          </div>

          <div class="field">
            <label>حالة الكتاب</label>
            <select name="status" id="statusSelect">
              <option value="متاح" ${b.status !== 'معار' ? 'selected' : ''}>متاح</option>
              <option value="معار" ${b.status === 'معار' ? 'selected' : ''}>معار</option>
            </select>
          </div>

          <div class="field" id="borrowerField" style="${b.status === 'معار' ? '' : 'display:none;'}">
            <label>${icon('user')} اسم المستعير</label>
            <input type="text" name="borrowerName" value="${escapeHtml(b.borrowerName)}" placeholder="اسم الشخص المستعير" />
          </div>

          <div class="field span-2">
            <label>${icon('note')} ملاحظات</label>
            <textarea name="notes" placeholder="أي تفاصيل إضافية عن الكتاب أو نسخته...">${escapeHtml(b.notes)}</textarea>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${icon('check')} ${isEdit ? 'حفظ التعديلات' : 'إضافة إلى المكتبة'}</button>
          <button type="button" class="btn btn-ghost" id="cancelForm">إلغاء</button>
          ${!isEdit ? `<button type="button" class="btn btn-outline" id="saveAndNew">${icon('plus')} حفظ وإضافة آخر</button>` : ''}
        </div>
      </form>
    </div>
  `;

  const form = root.querySelector('#bookForm');
  form.querySelector('#statusSelect').addEventListener('change', (e) => {
    root.querySelector('#borrowerField').style.display = e.target.value === 'معار' ? '' : 'none';
  });

  function validate(data) {
    let valid = true;
    [['title', 'field-title'], ['author', 'field-author']].forEach(([key, id]) => {
      const fieldEl = root.querySelector('#' + id);
      const ok = (data[key] || '').trim().length > 0;
      fieldEl.classList.toggle('invalid', !ok);
      fieldEl.querySelector('.error-msg')?.classList.toggle('hidden', ok);
      if (!ok) valid = false;
    });
    return valid;
  }

  async function submitHandler(andNew) {
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    if (!validate(data)) {
      toast('الرجاء إكمال الحقول الإلزامية', 'error');
      return;
    }
    try {
      if (isEdit) {
        await window.raff.updateBook(editingBook.id, data);
        toast('تم تحديث بيانات الكتاب بنجاح', 'success');
        await refreshState();
        renderNavCounts();
        navigateTo('library');
      } else {
        const record = await window.raff.addBook(data);
        await refreshState();
        renderNavCounts();
        navigateTo(andNew ? 'add' : 'library');
        showSavedBookModal(record, { andNew });
      }
    } catch (err) {
      toast('حدث خطأ أثناء الحفظ: ' + err.message, 'error');
    }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); submitHandler(false); });
  root.querySelector('#cancelForm').addEventListener('click', () => navigateTo(isEdit ? 'library' : 'dashboard'));
  root.querySelector('#saveAndNew')?.addEventListener('click', () => submitHandler(true));
}

/* =========================================================
   Statistics
   ========================================================= */
function renderStats(root) {
  const { stats } = RAFF_STATE;
  const cats = Object.entries(stats.byCategory || {}).sort((a, b) => b[1] - a[1]);
  const pubs = Object.entries(stats.byPublisher || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxCat = Math.max(1, ...cats.map((c) => c[1]));
  const maxPub = Math.max(1, ...pubs.map((c) => c[1]));

  root.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-value">${stats.totalBooks ?? 0}</div><div class="stat-label">إجمالي الكتب</div></div>
      <div class="stat-card"><div class="stat-value">${stats.totalCopies ?? 0}</div><div class="stat-label">إجمالي النسخ</div></div>
      <div class="stat-card stat-success"><div class="stat-value">${stats.available ?? 0}</div><div class="stat-label">نسخ متاحة</div></div>
      <div class="stat-card stat-danger"><div class="stat-value">${stats.borrowed ?? 0}</div><div class="stat-label">كتب معارة</div></div>
    </div>

    <div class="settings-grid">
      <div class="panel">
        <div class="panel-header"><h2 class="panel-title">حسب التصنيف</h2></div>
        ${cats.length ? `<div class="bar-chart">${cats.map(([k, v]) => `
          <div class="bar-row">
            <div class="bar-row-label">${escapeHtml(k)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${(v / maxCat) * 100}%;"></div></div>
            <div class="bar-row-value">${v}</div>
          </div>`).join('')}</div>` : `<p class="text-muted">لا توجد بيانات كافية بعد.</p>`}
      </div>

      <div class="panel">
        <div class="panel-header"><h2 class="panel-title">أكثر دور النشر</h2></div>
        ${pubs.length ? `<div class="bar-chart">${pubs.map(([k, v]) => `
          <div class="bar-row">
            <div class="bar-row-label">${escapeHtml(k)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${(v / maxPub) * 100}%;"></div></div>
            <div class="bar-row-value">${v}</div>
          </div>`).join('')}</div>` : `<p class="text-muted">لا توجد بيانات كافية بعد.</p>`}
      </div>
    </div>
  `;
}

/* =========================================================
   Settings / Backup
   ========================================================= */
function renderSettings(root) {
  const meta = RAFF_STATE.meta;
  root.innerHTML = `
    <div class="settings-grid">
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">النسخ الاحتياطي</h2>
            <p class="panel-desc">احفظ نسخة من مكتبتك أو استرجعها لاحقاً</p>
          </div>
        </div>
        <div class="setting-action">
          <div>
            <div class="setting-action-title">تصدير نسخة احتياطية (JSON)</div>
            <div class="setting-action-desc">ملف كامل يمكن استيراده لاحقاً على هذا الجهاز أو غيره</div>
          </div>
          <button class="btn btn-outline btn-sm" id="exportJsonBtn">${icon('download')} تصدير</button>
        </div>
        <div class="setting-action">
          <div>
            <div class="setting-action-title">تصدير كجدول بيانات (CSV)</div>
            <div class="setting-action-desc">مناسب لفتحه في Excel أو مشاركته كتقرير</div>
          </div>
          <button class="btn btn-outline btn-sm" id="exportCsvBtn">${icon('download')} تصدير</button>
        </div>
        <div class="setting-action">
          <div>
            <div class="setting-action-title">تصدير كملف نصي (TXT)</div>
            <div class="setting-action-desc">قائمة مقروءة بجميع الكتب وبياناتها</div>
          </div>
          <button class="btn btn-outline btn-sm" id="exportTxtBtn">${icon('download')} تصدير</button>
        </div>
        <div class="setting-action">
          <div>
            <div class="setting-action-title">تصدير كملف PDF</div>
            <div class="setting-action-desc">تقرير جاهز للطباعة بجدول منسّق لكل الكتب</div>
          </div>
          <button class="btn btn-outline btn-sm" id="exportPdfBtn">${icon('download')} تصدير</button>
        </div>
        <div class="setting-action">
          <div>
            <div class="setting-action-title">استيراد نسخة احتياطية</div>
            <div class="setting-action-desc">إضافة كتب من ملف JSON محفوظ مسبقاً (بدون تكرار الأرقام المرجعية)</div>
          </div>
          <button class="btn btn-outline btn-sm" id="importJsonBtn">${icon('upload')} استيراد</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">معلومات النظام</h2>
            <p class="panel-desc">تفاصيل حول المكتبة الحالية</p>
          </div>
        </div>
        <div class="setting-action">
          <div class="setting-action-title">عدد الكتب</div>
          <div class="text-muted">${RAFF_STATE.books.length}</div>
        </div>
        <div class="setting-action">
          <div class="setting-action-title">عدد المؤلفين</div>
          <div class="text-muted">${meta.authors.length}</div>
        </div>
        <div class="setting-action">
          <div class="setting-action-title">عدد دور النشر</div>
          <div class="text-muted">${meta.publishers.length}</div>
        </div>
        <div class="setting-action">
          <div class="setting-action-title">مسار ملف قاعدة البيانات</div>
          <div class="text-muted" style="font-size:11px; word-break:break-all; direction:ltr; text-align:left;">${escapeHtml(meta.filePath)}</div>
        </div>

        <div class="panel-header" style="margin-top:22px;">
          <div>
            <h2 class="panel-title" style="color:var(--danger);">منطقة الخطر</h2>
            <p class="panel-desc">هذا الإجراء لا يمكن التراجع عنه</p>
          </div>
        </div>
        <div class="setting-action">
          <div>
            <div class="setting-action-title">حذف جميع بيانات المكتبة</div>
            <div class="setting-action-desc">سيتم مسح جميع الكتب المسجلة نهائياً</div>
          </div>
          <button class="btn btn-danger btn-sm" id="resetAllBtn">${icon('trash')} حذف الكل</button>
        </div>
      </div>
    </div>
  `;

  root.querySelector('#exportJsonBtn').addEventListener('click', async () => {
    const res = await window.raff.exportJson();
    if (res.ok) toast('تم حفظ النسخة الاحتياطية بنجاح', 'success');
  });
  root.querySelector('#exportCsvBtn').addEventListener('click', async () => {
    const res = await window.raff.exportCsv();
    if (res.ok) toast('تم تصدير الملف بصيغة CSV', 'success');
  });
  root.querySelector('#exportTxtBtn').addEventListener('click', async () => {
    const res = await window.raff.exportTxt();
    if (res.ok) toast('تم تصدير الملف النصي بنجاح', 'success');
  });
  root.querySelector('#exportPdfBtn').addEventListener('click', async () => {
    const btn = root.querySelector('#exportPdfBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'جارٍ التصدير...';
    try {
      const res = await window.raff.exportPdf();
      if (res.ok) toast('تم تصدير ملف PDF بنجاح', 'success');
      else if (res.error) toast('فشل تصدير PDF: ' + res.error, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  });
  root.querySelector('#importJsonBtn').addEventListener('click', async () => {
    const res = await window.raff.importJson();
    if (res.ok) {
      toast(`تم استيراد ${res.added} كتاب${res.skipped ? ` (تم تجاهل ${res.skipped} مكرر)` : ''}`, 'success');
      await refreshState();
      renderNavCounts();
      renderRoute();
    } else if (res.error) {
      toast('فشل الاستيراد: ' + res.error, 'error');
    }
  });
  root.querySelector('#resetAllBtn').addEventListener('click', async () => {
    const ok = await confirmModal({
      title: 'حذف جميع بيانات المكتبة؟',
      message: 'سيتم حذف جميع الكتب المسجلة بشكل نهائي ولا يمكن استرجاعها إلا من نسخة احتياطية. هل تريد المتابعة؟',
      confirmLabel: 'حذف كل شيء',
    });
    if (!ok) return;
    await window.raff.resetAll();
    await refreshState();
    renderNavCounts();
    toast('تم حذف جميع البيانات', 'success');
    navigateTo('dashboard');
  });
}
