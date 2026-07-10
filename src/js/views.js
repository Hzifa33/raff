'use strict';

/* =========================================================
   Shared helpers
   ========================================================= */
function escapeHtml(str) {
  return (str ?? '').toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sortBooks(books, sortKey) {
  const arr = [...books];
  switch (sortKey) {
    case 'oldest': return arr.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    case 'newest':
    default: return arr.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
}

function statusBadgeHtml(book) {
  const status = RaffBook.bookStatus(book);
  const cls = status === RaffBook.STATUS_AVAILABLE ? 'badge-available'
    : status === RaffBook.STATUS_PARTIAL ? 'badge-partial'
    : 'badge-borrowed';
  return `<span class="badge ${cls}">${status}</span>`;
}

function copiesMeterHtml(book) {
  const total = RaffBook.totalCopies(book);
  const avail = RaffBook.availableCopies(book);
  const pct = total ? (avail / total) * 100 : 0;
  return `
    <div class="copies-cell" title="${avail} متاحة من ${total}">
      <div class="copies-text"><strong>${avail}</strong> / ${total}</div>
      <div class="copies-track"><div class="copies-fill" style="width:${pct}%;"></div></div>
    </div>`;
}

function renderBookRow(book) {
  const spine = spineColorFor(book.category || book.author);
  return `
    <div class="book-row" data-id="${book.id}" data-action="details" role="button" tabindex="0">
      <div class="spine" style="background:${spine};"></div>
      <div class="book-title-cell">
        <div class="book-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title) || 'بدون عنوان'}</div>
        <div class="book-ref">${icon('hash')}<span>${escapeHtml(book.referenceNumber)}</span></div>
      </div>
      <div class="book-meta-cell">
        <span class="book-meta-label">المؤلف</span>
        <span class="book-meta-value">${escapeHtml(book.author) || '—'}</span>
      </div>
      <div class="book-meta-cell hide-narrow">
        <span class="book-meta-label">دار النشر</span>
        <span class="book-meta-value">${escapeHtml(book.publisher) || '—'}</span>
      </div>
      <div class="book-meta-cell hide-narrow hide-md">
        <span class="book-meta-label">المجال</span>
        <span class="book-meta-value">${escapeHtml(book.category) || '—'}</span>
      </div>
      ${copiesMeterHtml(book)}
      <div class="book-status-cell">${statusBadgeHtml(book)}</div>
      <div class="row-actions">
        <button class="btn btn-outline btn-icon" data-action="edit" data-id="${book.id}" title="تعديل" aria-label="تعديل">${icon('edit')}</button>
        <button class="btn btn-outline btn-icon" data-action="delete" data-id="${book.id}" title="حذف" aria-label="حذف">${icon('trash')}</button>
      </div>
    </div>`;
}

/**
 * Confirms, deletes, then offers a real undo. Deleting a catalogued book is
 * destructive and easy to do by mistake, so the record is kept in memory and
 * restored verbatim (same id and reference number) if the user undoes.
 */
async function deleteBookWithUndo(book) {
  const ok = await confirmModal({
    title: 'حذف هذا الكتاب؟',
    message: `سيتم حذف "${escapeHtml(book.title)}" من سجل المكتبة. يمكنك التراجع مباشرة بعد الحذف.`,
    confirmLabel: 'حذف',
  });
  if (!ok) return false;

  const snapshot = { ...book };
  await window.raff.removeBook(book.id);
  await refreshState();
  renderNavCounts();
  renderRoute();

  toast('تم حذف الكتاب', 'success', 6000, {
    label: 'تراجع',
    onClick: async () => {
      await window.raff.restoreBook(snapshot);
      await refreshState();
      renderNavCounts();
      renderRoute();
      toast('تمت استعادة الكتاب', 'success', 2200);
    },
  });
  return true;
}

/* =========================================================
   Book details modal
   ========================================================= */
function showBookDetails(bookId) {
  const book = RAFF_STATE.books.find((b) => b.id === bookId);
  if (!book) return;

  const spine = spineColorFor(book.category || book.author);
  const total = RaffBook.totalCopies(book);
  const avail = RaffBook.availableCopies(book);
  const loans = [...(book.loans || [])].sort(
    (a, b) => Date.parse(b.borrowedAt) - Date.parse(a.borrowedAt)
  );
  const openLoans = loans.filter((l) => !l.returnedAt);
  const canBorrow = RaffBook.canBorrow(book);
  const today = new Date().toISOString().slice(0, 10);

  const metaRow = (label, value, iconName) => value
    ? `<div class="detail-row">
         <span class="detail-label">${icon(iconName)} ${label}</span>
         <span class="detail-value">${escapeHtml(value)}</span>
       </div>`
    : '';

  const loanRow = (l) => {
    const days = RaffBook.loanDurationDays(l);
    const overdue = RaffBook.isOverdue(l, 30);
    return `
      <div class="loan-row ${l.returnedAt ? 'is-returned' : overdue ? 'is-overdue' : ''}">
        <div class="loan-who">
          <span class="loan-name">${escapeHtml(l.borrowerName)}</span>
          <span class="loan-dates">
            ${reportFormatDate(l.borrowedAt)}
            ${l.returnedAt ? ` ← ${reportFormatDate(l.returnedAt)}` : ''}
          </span>
        </div>
        <span class="loan-days ${overdue ? 'overdue' : ''}">${days} يوم</span>
        ${l.returnedAt
          ? `<span class="loan-state returned">أُرجع</span>`
          : `<button class="btn btn-outline btn-sm" data-return-loan="${l.id}">${icon('refresh')} إرجاع</button>`}
      </div>`;
  };

  const html = `
    <div class="detail-header" style="border-top: 4px solid ${spine};">
      <div class="detail-title-wrap">
        <h3 class="detail-title">${escapeHtml(book.title) || 'بدون عنوان'}</h3>
        <p class="detail-author">${escapeHtml(book.author) || 'مؤلف غير محدد'}</p>
      </div>
      <button class="btn btn-ghost btn-icon" id="detailClose" aria-label="إغلاق">${icon('x')}</button>
    </div>
    <div class="modal-body">
      <div class="detail-topline">
        <div class="detail-ref">
          <span class="detail-ref-label">الرقم المرجعي</span>
          <span class="detail-ref-value">${escapeHtml(book.referenceNumber)}</span>
        </div>
        <div class="availability-card ${avail === 0 ? 'is-none' : avail < total ? 'is-partial' : 'is-full'}">
          <div class="availability-head">
            <span class="availability-count"><strong>${avail}</strong> من ${total}</span>
            ${statusBadgeHtml(book)}
          </div>
          <div class="copies-track"><div class="copies-fill" style="width:${total ? (avail / total) * 100 : 0}%;"></div></div>
          <div class="availability-note">${avail > 0 ? 'نسخ متاحة للإعارة الآن' : 'كل النسخ معارة حالياً'}</div>
        </div>
      </div>

      <div class="detail-grid">
        ${metaRow('دار النشر', book.publisher, 'building')}
        ${metaRow('المجال / التصنيف', book.category, 'tag')}
        ${metaRow('الطبعة', book.edition, 'layers')}
        ${metaRow('سنة النشر', book.publishYear, 'calendar')}
      </div>

      ${book.notes ? `<div class="detail-notes"><span class="detail-label">${icon('note')} ملاحظات</span><p>${escapeHtml(book.notes)}</p></div>` : ''}

      <div class="loans-section">
        <div class="loans-head">
          <h4 class="loans-title">${icon('user')} سجل الإعارة <span class="loans-count">${openLoans.length} مفتوحة من ${loans.length}</span></h4>
        </div>

        <div class="borrow-form ${canBorrow ? '' : 'disabled'}">
          <div class="ac-anchor borrow-name-wrap">
            <input type="text" id="borrowName" placeholder="اسم المستعير" ${canBorrow ? '' : 'disabled'} />
          </div>
          <input type="date" id="borrowDate" value="${today}" max="${today}" ${canBorrow ? '' : 'disabled'} />
          <button class="btn btn-primary btn-sm" id="borrowBtn" ${canBorrow ? '' : 'disabled'}>${icon('plus')} إعارة نسخة</button>
        </div>
        ${canBorrow ? '' : '<p class="borrow-blocked">لا توجد نسخ متاحة. أرجِع نسخة أو زد عدد النسخ من التعديل.</p>'}

        <div class="loans-list">
          ${loans.length ? loans.map(loanRow).join('') : '<p class="loans-empty">لم تُسجَّل أي إعارة لهذا الكتاب بعد.</p>'}
        </div>
      </div>

      <div class="form-actions" style="position:static; margin:16px 0 0; padding:14px 0 0; border-radius:0;">
        <button class="btn btn-outline" id="detailEdit">${icon('edit')} تعديل البيانات</button>
        <button class="btn btn-outline" id="detailCopyRef">${icon('hash')} نسخ الرقم</button>
        <button class="btn btn-danger" id="detailDelete">${icon('trash')} حذف</button>
      </div>
    </div>`;

  openModal(html, {
    onMount: (overlay) => {
      overlay.querySelector('#detailClose').addEventListener('click', closeModal);

      const nameInput = overlay.querySelector('#borrowName');
      if (nameInput && !nameInput.disabled) {
        // Suggest people who have borrowed before, so names stay consistent.
        createAutocomplete(nameInput, {
          getPool: () => RAFF_STATE.suggestions.filter((s) => s.type === 'borrower'),
          onSelect: () => {},
          typeLabels: SUGGESTION_TYPE_LABELS,
        });
        nameInput.focus();
      }

      const doBorrow = async () => {
        const name = nameInput.value.trim();
        const date = overlay.querySelector('#borrowDate').value;
        if (!name) { toast('اسم المستعير مطلوب', 'error'); nameInput.focus(); return; }
        const res = await window.raff.borrowCopy(book.id, {
          borrowerName: name,
          borrowedAt: date ? new Date(date + 'T12:00:00').toISOString() : undefined,
        });
        if (!res.ok) { toast(res.error, 'error'); return; }
        await refreshState();
        renderNavCounts();
        refreshCurrentView();
        toast(`تمت إعارة نسخة إلى ${name}`, 'success');
        showBookDetails(book.id);
      };

      overlay.querySelector('#borrowBtn')?.addEventListener('click', doBorrow);
      nameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); doBorrow(); }
      });

      overlay.querySelectorAll('[data-return-loan]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const res = await window.raff.returnLoan(book.id, btn.dataset.returnLoan);
          if (!res.ok) { toast(res.error, 'error'); return; }
          await refreshState();
          renderNavCounts();
          refreshCurrentView();
          toast('تم تسجيل إرجاع النسخة', 'success');
          showBookDetails(book.id);
        });
      });

      overlay.querySelector('#detailEdit').addEventListener('click', () => {
        closeModal();
        navigateTo('edit', { book });
      });
      overlay.querySelector('#detailCopyRef').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(book.referenceNumber);
          toast('تم نسخ الرقم المرجعي', 'success', 1800);
        } catch (_) { toast('تعذّر نسخ الرقم', 'error'); }
      });
      overlay.querySelector('#detailDelete').addEventListener('click', async () => {
        closeModal();
        await deleteBookWithUndo(book);
      });
    },
  });
}

function reportFormatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/* =========================================================
   Dashboard
   ========================================================= */
function renderDashboard(root) {
  const { stats, books } = RAFF_STATE;
  const recent = sortBooks(books, 'newest').slice(0, 6);
  const topCategories = Object.entries(stats.byCategory || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCat = Math.max(1, ...topCategories.map((c) => c[1]));
  const isEmpty = books.length === 0;

  const statCard = (value, label, iconName, variant = '') => `
    <div class="stat-card ${variant}">
      <div class="stat-icon">${icon(iconName, 18)}</div>
      <div>
        <div class="stat-value">${value ?? 0}</div>
        <div class="stat-label">${label}</div>
      </div>
    </div>`;

  if (isEmpty) {
    root.innerHTML = `
      <div class="welcome-panel">
        <div class="welcome-mark">${icon('stack', 44)}</div>
        <h2 class="welcome-title">أهلاً بك في رَفّ</h2>
        <p class="welcome-desc">
          مكتبتك فارغة حتى الآن. أضف أول كتاب وسيمنحه النظام رقماً مرجعياً تلقائياً
          لتدوّنه عليه، ثم يمكنك البحث في مكتبتك كاملة في أي وقت.
        </p>
        <div class="welcome-actions">
          <button class="btn btn-primary" data-nav="add">${icon('plus')} إضافة أول كتاب</button>
          <button class="btn btn-outline" data-nav="settings">${icon('upload')} استيراد نسخة احتياطية</button>
        </div>
        <div class="welcome-tips">
          <div class="welcome-tip">${icon('hash', 14)}<span>رقم مرجعي تلقائي لكل كتاب</span></div>
          <div class="welcome-tip">${icon('search', 14)}<span>بحث لا يتأثر باختلاف الهمزات</span></div>
          <div class="welcome-tip">${icon('download', 14)}<span>تصدير PDF وExcel وJSON</span></div>
        </div>
      </div>`;
    return;
  }

  root.innerHTML = `
    <div class="stat-grid">
      ${statCard(stats.totalBooks, 'إجمالي العناوين', 'book')}
      ${statCard(stats.availableCopies, 'نسخ متاحة', 'check', 'stat-success')}
      ${statCard(stats.borrowedCopies, 'نسخ معارة', 'copies', 'stat-danger')}
      ${statCard(stats.activeBorrowers, 'مستعيرون حالياً', 'user')}
    </div>

    <div class="dash-grid">
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">أحدث الإضافات</h2>
            <p class="panel-desc">اضغط على أي كتاب لعرض بياناته كاملة</p>
          </div>
          <button class="btn btn-outline btn-sm" data-nav="library">عرض الكل</button>
        </div>
        <div class="book-list">
          ${recent.map(renderBookRow).join('')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">توزيع المجالات</h2>
            <p class="panel-desc">أكثر التصنيفات عدداً</p>
          </div>
        </div>
        ${topCategories.length ? `
        <div class="bar-chart">
          ${topCategories.map(([cat, count]) => `
            <div class="bar-row">
              <div class="bar-row-label" title="${escapeHtml(cat)}">${escapeHtml(cat)}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${(count / maxCat) * 100}%;"></div></div>
              <div class="bar-row-value">${count}</div>
            </div>`).join('')}
        </div>` : `<p class="text-muted" style="font-size:12.5px;">لم تُضف مجالات بعد.</p>`}
      </div>
    </div>
  `;
}

/* =========================================================
   Browse / Search
   ========================================================= */
let _browserFilters = { query: '', field: 'all', status: 'all', sort: 'newest' };

// Must match the CSS in .vlist-rows .book-row
const ROW_HEIGHT = 62;
const ROW_GAP = 8;
const ROW_STEP = ROW_HEIGHT + ROW_GAP;

let _vlist = null;
let _queryDebounce = null;

/**
 * Rebuilding the whole panel on every keystroke destroyed the input element,
 * which is why focus was lost after each character. The shell is now rendered
 * once; typing only feeds new items into the virtual list.
 */
function renderBookBrowser(root, { presetQuery } = {}) {
  if (presetQuery !== undefined) _browserFilters.query = presetQuery;
  const f = _browserFilters;

  if (_vlist) { _vlist.destroy(); _vlist = null; }

  root.innerHTML = `
    <div class="panel browser-panel">
      <div class="filters-row">
        <select id="filterField">
          <option value="all">كل الحقول</option>
          <option value="title">العنوان</option>
          <option value="author">المؤلف</option>
          <option value="publisher">دار النشر</option>
          <option value="referenceNumber">الرقم المرجعي</option>
          <option value="category">المجال</option>
          <option value="borrowers">المستعير</option>
        </select>
        <div class="ac-anchor filter-query-wrap">
          <input type="text" id="filterQuery" placeholder="اكتب كلمة البحث..." autocomplete="off" />
        </div>
        <div class="chip-toggle" id="statusToggle">
          <button data-val="all">الكل</button>
          <button data-val="${RaffBook.STATUS_AVAILABLE}">متاح</button>
          <button data-val="${RaffBook.STATUS_PARTIAL}">معار جزئياً</button>
          <button data-val="${RaffBook.STATUS_FULL}">معار بالكامل</button>
        </div>
        <select id="filterSort">
          <option value="newest">الأحدث أولاً</option>
          <option value="oldest">الأقدم أولاً</option>
          <option value="title-asc">ترتيب حسب العنوان</option>
          <option value="author-asc">ترتيب حسب المؤلف</option>
        </select>
        <span class="result-count" id="resultCount"></span>
      </div>

      <div class="vlist-scroll" id="bookScroll"></div>
    </div>
  `;

  const fieldSel = root.querySelector('#filterField');
  const queryInput = root.querySelector('#filterQuery');
  const sortSel = root.querySelector('#filterSort');
  const statusToggle = root.querySelector('#statusToggle');
  const scrollEl = root.querySelector('#bookScroll');

  // Set values via properties, never by re-rendering markup.
  fieldSel.value = f.field;
  queryInput.value = f.query;
  sortSel.value = f.sort;
  syncStatusToggle(statusToggle, f.status);

  _vlist = createVirtualList(scrollEl, {
    rowStep: ROW_STEP,
    rowHeight: ROW_HEIGHT,
    renderRow: (book) => renderBookRow(book),
    emptyHtml: `
      <div class="empty-state">
        ${icon('book')}
        <h3>لا توجد نتائج مطابقة</h3>
        <p>جرّب كلمة بحث مختلفة أو غيّر الفلاتر المستخدمة.</p>
      </div>`,
  });

  fieldSel.addEventListener('change', () => {
    _browserFilters.field = fieldSel.value;
    updateBookResults({ resetScroll: true });
  });
  sortSel.addEventListener('change', () => {
    _browserFilters.sort = sortSel.value;
    updateBookResults({ resetScroll: true });
  });
  statusToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-val]');
    if (!btn) return;
    _browserFilters.status = btn.dataset.val;
    syncStatusToggle(statusToggle, _browserFilters.status);
    updateBookResults({ resetScroll: true });
  });
  queryInput.addEventListener('input', () => {
    _browserFilters.query = queryInput.value;
    syncQuickSearchValue(queryInput.value);
    scheduleBookResults();
  });

  // Suggestions narrow to whichever field the user is filtering on.
  createAutocomplete(queryInput, {
    getPool: () => suggestionPoolForField(_browserFilters.field),
    onSelect: (label) => {
      _browserFilters.query = label;
      syncQuickSearchValue(label);
      updateBookResults({ resetScroll: true });
    },
    typeLabels: SUGGESTION_TYPE_LABELS,
  });

  updateBookResults({ resetScroll: true });
}

/** Maps a search field onto the suggestion types worth offering for it. */
function suggestionPoolForField(field) {
  const map = {
    all: null,
    title: 'title',
    author: 'author',
    publisher: 'publisher',
    referenceNumber: 'reference',
    category: 'category',
    borrowers: 'borrower',
  };
  const type = map[field];
  if (!type) return RAFF_STATE.suggestions;
  return RAFF_STATE.suggestions.filter((s) => s.type === type);
}

function syncStatusToggle(toggleEl, status) {
  toggleEl.querySelectorAll('button[data-val]').forEach((b) => {
    b.classList.toggle('active', b.dataset.val === status);
  });
}

/** Keeps the topbar field and the in-view field showing the same text
 *  without either one stealing focus from the other. */
function syncQuickSearchValue(value) {
  const quick = document.getElementById('quickSearchInput');
  if (quick && quick.value !== value && document.activeElement !== quick) quick.value = value;
}
function syncFilterInputValue(value) {
  const inView = document.getElementById('filterQuery');
  if (inView && inView.value !== value && document.activeElement !== inView) inView.value = value;
}

/** Coalesces bursts of keystrokes into a single filter pass per frame. */
function scheduleBookResults() {
  if (_queryDebounce) clearTimeout(_queryDebounce);
  _queryDebounce = setTimeout(() => {
    _queryDebounce = null;
    updateBookResults({ resetScroll: true });
  }, 50);
}

function updateBookResults({ resetScroll = false } = {}) {
  if (!_vlist) return;
  const results = queryBooks(RAFF_STATE.index, _browserFilters);
  _vlist.setItems(results, { resetScroll });
  const counter = document.getElementById('resultCount');
  if (counter) {
    counter.textContent = results.length === RAFF_STATE.books.length
      ? `${results.length} كتاب`
      : `${results.length} نتيجة من ${RAFF_STATE.books.length}`;
  }
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
    <div class="panel form-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">${isEdit ? 'تعديل بيانات الكتاب' : 'إضافة كتاب جديد'}</h2>
          <p class="panel-desc">الحقول المميزة بعلامة <span class="required">*</span> إلزامية، وبقية الحقول اختيارية</p>
        </div>
      </div>

      <form id="bookForm" novalidate>
        <div class="form-grid">
          <div class="field span-2" id="field-title">
            <label>${icon('book')} اسم الكتاب <span class="required">*</span></label>
            <input type="text" name="title" value="${escapeHtml(b.title)}" placeholder="مثال: مقدمة ابن خلدون" autofocus />
            <span class="error-msg hidden">هذا الحقل مطلوب</span>
          </div>

          <div class="field" id="field-author">
            <label>${icon('user')} المؤلف <span class="required">*</span></label>
            <div class="ac-anchor"><input type="text" name="author" value="${escapeHtml(b.author)}" placeholder="اسم المؤلف" /></div>
            <span class="error-msg hidden">هذا الحقل مطلوب</span>
          </div>

          <div class="field">
            <label>${icon('building')} دار النشر</label>
            <div class="ac-anchor"><input type="text" name="publisher" value="${escapeHtml(b.publisher)}" placeholder="اسم دار النشر" /></div>
          </div>

          <div class="field">
            <label>${icon('tag')} المجال / التصنيف</label>
            <div class="ac-anchor"><input type="text" name="category" value="${escapeHtml(b.category)}" placeholder="مثال: أدب، تفسير، فقه" /></div>
          </div>

          ${isEdit ? `
          <div class="field">
            <label>${icon('hash')} الرقم المرجعي</label>
            <input type="text" name="referenceNumber" value="${escapeHtml(b.referenceNumber)}" />
          </div>` : `
          <div class="field">
            <label>${icon('hash')} الرقم المرجعي</label>
            <input type="text" value="يُنشأ تلقائياً بعد الحفظ" disabled />
          </div>`}

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
            <input type="number" name="copiesTotal" min="${isEdit ? Math.max(1, RaffBook.borrowedCopies(b)) : 1}" value="${b.copiesTotal || 1}" />
            ${isEdit && RaffBook.borrowedCopies(b) > 0
              ? `<span class="hint">لا يمكن أن يقل عن ${RaffBook.borrowedCopies(b)} (نسخ معارة حالياً)</span>`
              : ''}
          </div>

          <div class="field span-2">
            <label>${icon('note')} ملاحظات</label>
            <input type="text" name="notes" value="${escapeHtml(b.notes)}" placeholder="أي تفاصيل إضافية عن الكتاب أو نسخته..." />
          </div>
        </div>

        ${isEdit ? '' : `<p class="form-note">${icon('info', 13)} تُسجَّل الإعارات لاحقاً من نافذة تفاصيل الكتاب، وتُحتسب حالة الكتاب تلقائياً حسب النسخ المتاحة.</p>`}

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${icon('check')} ${isEdit ? 'حفظ التعديلات' : 'حفظ الكتاب'}</button>
          ${!isEdit ? `<button type="button" class="btn btn-outline" id="saveAndNew">${icon('plus')} حفظ وإضافة آخر</button>` : ''}
          <button type="button" class="btn btn-ghost" id="cancelForm">إلغاء</button>
          <span class="form-hint-inline">${isEdit ? '' : 'سيظهر الرقم المرجعي في نافذة بعد الحفظ'}</span>
        </div>
      </form>
    </div>
  `;

  const form = root.querySelector('#bookForm');

  // Predictive suggestions on the fields where consistency matters most.
  [['author', 'author'], ['publisher', 'publisher'], ['category', 'category']].forEach(([name, type]) => {
    const input = form.querySelector(`[name=${name}]`);
    if (!input) return;
    createAutocomplete(input, {
      getPool: () => (type === 'category' ? categoryPool() : RAFF_STATE.suggestions.filter((s) => s.type === type)),
      onSelect: () => {},
      typeLabels: SUGGESTION_TYPE_LABELS,
    });
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

/** Common categories, offered even before any book uses them. */
const DEFAULT_CATEGORIES = [
  'تفسير', 'حديث', 'فقه', 'أصول الفقه', 'عقيدة',
  'سيرة', 'تاريخ', 'أدب', 'لغة عربية', 'تزكية وأخلاق',
];

function categoryPool() {
  const used = RAFF_STATE.suggestions.filter((s) => s.type === 'category');
  const seen = new Set(used.map((s) => s.label));
  const defaults = DEFAULT_CATEGORIES
    .filter((c) => !seen.has(c))
    .map((c) => ({ label: c, type: 'category', norm: normalizeArabic(c) }));
  // Categories already in the library rank first; defaults fill the rest.
  return used.concat(defaults);
}

/* =========================================================
   Reports / lookup console
   ========================================================= */
let _reportState = { dim: 'borrower', value: '' };
let _reportAc = null;

function renderReports(root) {
  const { dim, value } = _reportState;
  const dimDef = DIMENSIONS[dim];

  root.innerHTML = `
    <div class="panel reports-panel">
      <div class="reports-toolbar">
        <div class="dim-chips" id="dimChips">
          ${Object.values(DIMENSIONS).map((d) => `
            <button class="dim-chip ${d.key === dim ? 'active' : ''}" data-dim="${d.key}">
              ${icon(d.icon, 14)}<span>${d.label}</span>
            </button>`).join('')}
        </div>

        <div class="reports-lookup ac-anchor">
          ${icon('search', 15)}
          <input type="text" id="reportLookup" placeholder="اكتب ${escapeHtml(dimDef.singular)} للاستدعاء..." />
          ${value ? `<button class="lookup-clear" id="lookupClear" aria-label="مسح">${icon('x', 13)}</button>` : ''}
        </div>
      </div>

      <div class="reports-body" id="reportsBody"></div>
    </div>`;

  const chips = root.querySelector('#dimChips');
  chips.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-dim]');
    if (!btn) return;
    _reportState = { dim: btn.dataset.dim, value: '' };
    renderReports(root);
  });

  const lookup = root.querySelector('#reportLookup');
  lookup.value = value;

  if (_reportAc) { _reportAc.destroy(); _reportAc = null; }
  _reportAc = createAutocomplete(lookup, {
    getPool: () => reportPoolFor(dim),
    onSelect: (label) => {
      _reportState.value = label;
      renderReports(root);
    },
    typeLabels: SUGGESTION_TYPE_LABELS,
    minChars: 1,
  });

  lookup.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && lookup.value.trim()) {
      _reportState.value = lookup.value.trim();
      renderReports(root);
    }
  });

  root.querySelector('#lookupClear')?.addEventListener('click', () => {
    _reportState.value = '';
    renderReports(root);
  });

  renderReportsBody(root.querySelector('#reportsBody'), root);
}

/** The suggestion pool for the currently selected dimension. */
function reportPoolFor(dim) {
  const typeByDim = {
    borrower: 'borrower', publisher: 'publisher',
    author: 'author', category: 'category',
  };
  if (dim === 'year') {
    return RAFF_STATE.meta.years.map((y) => ({ label: y, type: 'year', norm: normalizeArabic(y) }));
  }
  const type = typeByDim[dim];
  return RAFF_STATE.suggestions.filter((s) => s.type === type);
}

function renderReportsBody(body, root) {
  const { dim, value } = _reportState;
  const index = RAFF_STATE.reportIndex;
  const dimDef = DIMENSIONS[dim];

  if (!value) {
    const ranked = rankDimension(index, dim, { limit: 200 });
    if (!ranked.length) {
      body.innerHTML = `<div class="empty-state">${icon('stack')}<h3>لا توجد بيانات</h3>
        <p>لم تُسجَّل بعد أي ${escapeHtml(dimDef.label)} في المكتبة.</p></div>`;
      return;
    }

    const isBorrower = dim === 'borrower';
    const totals = ranked.reduce((acc, r) => {
      if (isBorrower) { acc.a += r.activeLoans; acc.b += r.totalLoans; }
      else { acc.a += r.titles; acc.b += r.borrowed; }
      return acc;
    }, { a: 0, b: 0 });

    body.innerHTML = `
      <div class="report-summary">
        <span class="report-summary-title">${icon(dimDef.icon, 15)} ترتيب ${escapeHtml(dimDef.label)}</span>
        <span class="report-summary-meta">
          ${ranked.length} ${isBorrower ? 'مستعيراً' : 'قيمة'} ·
          ${isBorrower ? `${totals.a} إعارة مفتوحة` : `${totals.a} عنوان`}
        </span>
      </div>
      <div class="report-table-wrap">
        <table class="report-table">
          <thead>
            <tr>
              <th style="width:36px;">#</th>
              <th>${escapeHtml(dimDef.singular)}</th>
              ${isBorrower
                ? '<th>بحوزته الآن</th><th>إجمالي الإعارات</th><th>متوسط المدة</th><th>أطول مدة</th>'
                : '<th>العناوين</th><th>إجمالي النسخ</th><th>معارة</th><th>متاحة</th>'}
            </tr>
          </thead>
          <tbody>
            ${ranked.map((r, i) => `
              <tr class="report-clickable" data-value="${escapeHtml(r.value)}">
                <td class="rank-num">${i + 1}</td>
                <td class="rank-value">${escapeHtml(r.value) || 'غير محدد'}</td>
                ${isBorrower
                  ? `<td><span class="num ${r.activeLoans ? 'num-warn' : ''}">${r.activeLoans}</span></td>
                     <td>${r.totalLoans}</td>
                     <td>${r.avgDays} يوم</td>
                     <td>${r.maxDays} يوم</td>`
                  : `<td><strong>${r.titles}</strong></td>
                     <td>${r.copies}</td>
                     <td><span class="num ${r.borrowed ? 'num-warn' : ''}">${r.borrowed}</span></td>
                     <td><span class="num num-ok">${r.available}</span></td>`}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    body.querySelectorAll('.report-clickable').forEach((tr) => {
      tr.addEventListener('click', () => {
        _reportState.value = tr.dataset.value;
        renderReports(root);
      });
    });
    return;
  }

  const report = reportFor(index, dim, value);
  if (!report) {
    body.innerHTML = `<div class="empty-state">${icon('search')}<h3>لا توجد نتائج</h3>
      <p>لم يُعثر على "${escapeHtml(value)}" ضمن ${escapeHtml(dimDef.label)}.</p></div>`;
    return;
  }

  body.innerHTML = `
    <div class="report-header">
      <div>
        <span class="report-eyebrow">${icon(dimDef.icon, 13)} ${escapeHtml(dimDef.singular)}</span>
        <h3 class="report-value">${escapeHtml(report.value) || 'غير محدد'}</h3>
      </div>
      <button class="btn btn-ghost btn-sm" id="backToRank">${icon('refresh')} عرض الترتيب الكامل</button>
    </div>

    <div class="kpi-grid">
      ${report.kpis.map((k) => `
        <div class="kpi-card ${k.tone ? 'kpi-' + k.tone : ''}">
          <div class="kpi-value">${k.value}${k.suffix ? `<span class="kpi-suffix">${k.suffix}</span>` : ''}</div>
          <div class="kpi-label">${k.label}</div>
        </div>`).join('')}
    </div>

    <div class="report-table-wrap">
      <table class="report-table">
        <thead><tr>${report.columns.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>
          ${report.rows.map((r) => `
            <tr class="report-row-${r.state} report-book" data-book="${r.bookId}">
              ${r.cells.map((c, i) => `<td class="${i === 0 ? 'cell-title' : ''} ${i === 1 ? 'cell-ref' : ''}">${escapeHtml(String(c))}</td>`).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  body.querySelector('#backToRank').addEventListener('click', () => {
    _reportState.value = '';
    renderReports(root);
  });
  body.querySelectorAll('.report-book').forEach((tr) => {
    tr.addEventListener('click', () => showBookDetails(tr.dataset.book));
  });
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
      <div class="stat-card"><div class="stat-icon">${icon('book', 18)}</div><div><div class="stat-value">${stats.totalBooks ?? 0}</div><div class="stat-label">إجمالي العناوين</div></div></div>
      <div class="stat-card"><div class="stat-icon">${icon('copies', 18)}</div><div><div class="stat-value">${stats.totalCopies ?? 0}</div><div class="stat-label">إجمالي النسخ</div></div></div>
      <div class="stat-card stat-success"><div class="stat-icon">${icon('check', 18)}</div><div><div class="stat-value">${stats.availableCopies ?? 0}</div><div class="stat-label">نسخ متاحة</div></div></div>
      <div class="stat-card stat-danger"><div class="stat-icon">${icon('user', 18)}</div><div><div class="stat-value">${stats.borrowedCopies ?? 0}</div><div class="stat-label">نسخ معارة</div></div></div>
    </div>

    <div class="settings-grid">
      <div class="panel">
        <div class="panel-header"><h2 class="panel-title">حسب المجال</h2></div>
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
  const exportRow = (title, desc, id) => `
    <div class="setting-action">
      <div>
        <div class="setting-action-title">${title}</div>
        <div class="setting-action-desc">${desc}</div>
      </div>
      <button class="btn btn-outline btn-sm" id="${id}">${icon('download')} تصدير</button>
    </div>`;

  root.innerHTML = `
    <div class="settings-grid">
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">تصدير المكتبة</h2>
            <p class="panel-desc">احفظ فهرسك بالصيغة التي تناسبك</p>
          </div>
        </div>
        ${exportRow('نسخة احتياطية كاملة (JSON)', 'قابلة للاستيراد لاحقاً على أي جهاز', 'exportJsonBtn')}
        ${exportRow('جدول بيانات (CSV)', 'لفتحه في Excel', 'exportCsvBtn')}
        ${exportRow('ملف نصي (TXT)', 'قائمة مقروءة بجميع الكتب', 'exportTxtBtn')}
        ${exportRow('تقرير (PDF)', 'جدول منسّق جاهز للطباعة', 'exportPdfBtn')}
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">الاستيراد والنظام</h2>
            <p class="panel-desc">استرجاع البيانات ومعلومات المكتبة</p>
          </div>
        </div>
        <div class="setting-action">
          <div>
            <div class="setting-action-title">استيراد نسخة احتياطية</div>
            <div class="setting-action-desc">من ملف JSON، مع تجاهل الأرقام المرجعية المكررة</div>
          </div>
          <button class="btn btn-outline btn-sm" id="importJsonBtn">${icon('upload')} استيراد</button>
        </div>

        <div class="system-stats">
          <div class="system-stat"><span class="system-stat-value">${RAFF_STATE.books.length}</span><span class="system-stat-label">كتاب</span></div>
          <div class="system-stat"><span class="system-stat-value">${meta.authors.length}</span><span class="system-stat-label">مؤلف</span></div>
          <div class="system-stat"><span class="system-stat-value">${meta.publishers.length}</span><span class="system-stat-label">دار نشر</span></div>
          <div class="system-stat"><span class="system-stat-value">${meta.categories.length}</span><span class="system-stat-label">مجال</span></div>
        </div>

        <div class="db-path">
          <span class="setting-action-desc">مسار ملف البيانات</span>
          <code title="${escapeHtml(meta.filePath)}">${escapeHtml(meta.filePath)}</code>
        </div>

        <div class="danger-zone">
          <div>
            <div class="setting-action-title" style="color:var(--danger);">حذف جميع بيانات المكتبة</div>
            <div class="setting-action-desc">إجراء نهائي لا يمكن التراجع عنه</div>
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
