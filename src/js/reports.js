'use strict';

/**
 * Reporting engine.
 *
 * The reports view answers two kinds of question:
 *   1. "Who/what are the top N?"        -> rankDimension()
 *   2. "Tell me everything about X."    -> reportFor()
 *
 * Both are served from indexes built once per data change (buildReportIndex),
 * so switching dimensions or typing a name never rescans the whole library.
 */

const DIMENSIONS = {
  borrower: { key: 'borrower', label: 'المستعيرون', singular: 'المستعير', icon: 'user' },
  publisher: { key: 'publisher', label: 'دور النشر', singular: 'دار النشر', icon: 'building' },
  author: { key: 'author', label: 'المؤلفون', singular: 'المؤلف', icon: 'user' },
  category: { key: 'category', label: 'المجالات', singular: 'المجال', icon: 'tag' },
  year: { key: 'year', label: 'سنوات النشر', singular: 'سنة النشر', icon: 'calendar' },
};

function _push(map, key, value) {
  if (!key) return;
  let arr = map.get(key);
  if (!arr) { arr = []; map.set(key, arr); }
  arr.push(value);
}

/**
 * Groups every book (and every loan) by each reporting dimension exactly once.
 * A loan is stored alongside its book so borrower reports never have to search
 * for which title a loan belongs to.
 */
function buildReportIndex(books) {
  const borrower = new Map();   // name -> [{ book, loan }]
  const publisher = new Map();  // value -> [book]
  const author = new Map();
  const category = new Map();
  const year = new Map();

  for (const book of books) {
    _push(publisher, (book.publisher || '').trim(), book);
    _push(author, (book.author || '').trim(), book);
    _push(category, (book.category || '').trim(), book);
    _push(year, (book.publishYear || '').toString().trim(), book);

    for (const loan of book.loans || []) {
      const name = (loan.borrowerName || '').trim();
      _push(borrower, name, { book, loan });
    }
  }

  return { borrower, publisher, author, category, year, books };
}

function _avg(nums) {
  if (!nums.length) return 0;
  let sum = 0;
  for (const n of nums) sum += n;
  return Math.round(sum / nums.length);
}

function _sumCopies(books) {
  let total = 0, borrowed = 0;
  for (const b of books) {
    total += RaffBook.totalCopies(b);
    borrowed += RaffBook.borrowedCopies(b);
  }
  return { total, borrowed, available: total - borrowed };
}

/** Top values for a dimension, ordered by the most meaningful metric. */
function rankDimension(index, dim, { limit = 100 } = {}) {
  const map = index[dim];
  if (!map) return [];
  const rows = [];

  if (dim === 'borrower') {
    for (const [name, entries] of map) {
      const active = entries.filter((e) => !e.loan.returnedAt);
      const durations = entries.map((e) => RaffBook.loanDurationDays(e.loan));
      rows.push({
        value: name,
        primary: active.length,
        totalLoans: entries.length,
        activeLoans: active.length,
        avgDays: _avg(durations),
        maxDays: durations.length ? Math.max(...durations) : 0,
      });
    }
    rows.sort((a, b) => b.activeLoans - a.activeLoans || b.totalLoans - a.totalLoans);
  } else {
    for (const [value, books] of map) {
      const copies = _sumCopies(books);
      rows.push({
        value,
        primary: books.length,
        titles: books.length,
        copies: copies.total,
        borrowed: copies.borrowed,
        available: copies.available,
      });
    }
    rows.sort((a, b) => b.titles - a.titles || b.copies - a.copies);
  }

  return rows.slice(0, limit);
}

/**
 * Full drill-down for one value of one dimension: headline numbers plus the
 * rows that back them up.
 */
function reportFor(index, dim, value) {
  const map = index[dim];
  if (!map) return null;
  const bucket = map.get(value);
  if (!bucket || !bucket.length) return null;

  if (dim === 'borrower') {
    const entries = [...bucket].sort(
      (a, b) => Date.parse(b.loan.borrowedAt) - Date.parse(a.loan.borrowedAt)
    );
    const active = entries.filter((e) => !e.loan.returnedAt);
    const returned = entries.filter((e) => e.loan.returnedAt);
    const durations = entries.map((e) => RaffBook.loanDurationDays(e.loan));
    const overdue = active.filter((e) => RaffBook.isOverdue(e.loan, 30));

    return {
      dim,
      value,
      kpis: [
        { label: 'كتب بحوزته الآن', value: active.length, tone: active.length ? 'warn' : 'ok' },
        { label: 'إجمالي الإعارات', value: entries.length },
        { label: 'متوسط مدة الاحتفاظ', value: _avg(durations), suffix: 'يوم' },
        { label: 'أطول مدة', value: durations.length ? Math.max(...durations) : 0, suffix: 'يوم' },
        { label: 'تجاوز 30 يوماً', value: overdue.length, tone: overdue.length ? 'danger' : 'ok' },
        { label: 'كتب أُرجعت', value: returned.length },
      ],
      columns: ['الكتاب', 'الرقم المرجعي', 'تاريخ الإعارة', 'تاريخ الإرجاع', 'المدة'],
      rows: entries.map((e) => ({
        bookId: e.book.id,
        cells: [
          e.book.title || 'بدون عنوان',
          e.book.referenceNumber,
          formatDate(e.loan.borrowedAt),
          e.loan.returnedAt ? formatDate(e.loan.returnedAt) : '—',
          `${RaffBook.loanDurationDays(e.loan)} يوم`,
        ],
        state: e.loan.returnedAt ? 'returned' : (RaffBook.isOverdue(e.loan, 30) ? 'overdue' : 'active'),
      })),
    };
  }

  const books = [...bucket].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ar'));
  const copies = _sumCopies(books);
  let loanCount = 0;
  for (const b of books) loanCount += (b.loans || []).length;

  return {
    dim,
    value,
    kpis: [
      { label: 'عدد العناوين', value: books.length },
      { label: 'إجمالي النسخ', value: copies.total },
      { label: 'نسخ متاحة', value: copies.available, tone: 'ok' },
      { label: 'نسخ معارة', value: copies.borrowed, tone: copies.borrowed ? 'warn' : 'ok' },
      { label: 'إجمالي الإعارات', value: loanCount },
      { label: 'نسبة الإتاحة', value: copies.total ? Math.round((copies.available / copies.total) * 100) : 0, suffix: '%' },
    ],
    columns: ['الكتاب', 'الرقم المرجعي', 'متاح / الكل', 'الحالة'],
    rows: books.map((b) => ({
      bookId: b.id,
      cells: [
        b.title || 'بدون عنوان',
        b.referenceNumber,
        `${RaffBook.availableCopies(b)} / ${RaffBook.totalCopies(b)}`,
        RaffBook.bookStatus(b),
      ],
      state: RaffBook.availableCopies(b) === 0 ? 'overdue' : 'active',
    })),
  };
}

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
