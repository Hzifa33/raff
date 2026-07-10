'use strict';

const fs = require('fs');
const path = require('path');
const B = require('./book-status');

const DB_FILE = 'raff-library.json';
const SCHEMA_VERSION = 2;

function nowIso() {
  return new Date().toISOString();
}

function genId() {
  return 'b_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function genLoanId() {
  return 'l_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function escapeXml(str) {
  return (str ?? '').toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function emptyDb() {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: nowIso(),
    nextRefSeq: 1,
    books: [],
  };
}

/**
 * A minimal, dependency-free JSON datastore. Chosen over a native SQLite
 * binding so the packaged app never has to rebuild native modules per
 * platform/Electron ABI — a common source of broken installers.
 */
class Store {
  constructor(userDataDir) {
    this.filePath = path.join(userDataDir, DB_FILE);
    this._load();
  }

  _load() {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.db = emptyDb();
        this._save();
        return;
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      this.db = JSON.parse(raw);
      if (!this.db.books) this.db.books = [];
      if (!this.db.nextRefSeq) {
        // Upgrading an older database: start the counter past any existing
        // numeric suffixes so newly generated numbers can't collide.
        let maxSeq = 0;
        for (const b of this.db.books) {
          const m = /(\d+)\s*$/.exec(b.referenceNumber || '');
          if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
        }
        this.db.nextRefSeq = maxSeq + 1;
      }
      this._migrate();
    } catch (err) {
      // Corrupt file safety net: back it up and start fresh rather than crash.
      try {
        if (fs.existsSync(this.filePath)) {
          fs.copyFileSync(this.filePath, this.filePath + '.corrupt-' + Date.now());
        }
      } catch (_) {}
      this.db = emptyDb();
      this._save();
    }
  }

  _save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2), 'utf-8');
    fs.renameSync(tmp, this.filePath);
  }

  /**
   * v1 stored a single `status` string plus one `borrowerName`. v2 stores a
   * loan ledger and derives status from it. Convert in place, once, and keep
   * the old borrower as an open loan dated to the record's creation.
   */
  _migrate() {
    if ((this.db.schemaVersion || 1) >= SCHEMA_VERSION) return;

    for (const book of this.db.books) {
      if (!Array.isArray(book.loans)) book.loans = [];
      const wasBorrowed = book.status === 'معار';
      if (wasBorrowed && book.loans.length === 0) {
        book.loans.push({
          id: genLoanId(),
          borrowerName: (book.borrowerName || 'غير معروف').trim(),
          borrowedAt: book.updatedAt || book.createdAt || nowIso(),
          returnedAt: null,
        });
      }
      delete book.status;
      delete book.borrowerName;
    }
    this.db.schemaVersion = SCHEMA_VERSION;
    this._save();
  }

  getAll() {
    return this.db.books;
  }

  getMeta() {
    const authors = new Set();
    const publishers = new Set();
    const categories = new Set();
    const borrowers = new Set();
    const years = new Set();
    for (const b of this.db.books) {
      if (b.author) authors.add(b.author.trim());
      if (b.publisher) publishers.add(b.publisher.trim());
      if (b.category) categories.add(b.category.trim());
      if (b.publishYear) years.add(b.publishYear.trim());
      for (const loan of b.loans || []) {
        if (loan.borrowerName) borrowers.add(loan.borrowerName.trim());
      }
    }
    const arSort = (a, c) => a.localeCompare(c, 'ar');
    return {
      authors: [...authors].sort(arSort),
      publishers: [...publishers].sort(arSort),
      categories: [...categories].sort(arSort),
      borrowers: [...borrowers].sort(arSort),
      years: [...years].sort(arSort),
      filePath: this.filePath,
    };
  }

  _nextReferenceNumber() {
    const seq = this.db.nextRefSeq || 1;
    this.db.nextRefSeq = seq + 1;
    return 'raf-' + String(seq).padStart(4, '0');
  }

  addBook(book, { keepReferenceNumber = false, defer = false } = {}) {
    const referenceNumber = (keepReferenceNumber && (book.referenceNumber || '').trim())
      ? book.referenceNumber.trim()
      : this._nextReferenceNumber();

    const record = {
      id: genId(),
      title: (book.title || '').trim(),
      author: (book.author || '').trim(),
      publisher: (book.publisher || '').trim(),
      referenceNumber,
      category: (book.category || '').trim(),
      edition: (book.edition || '').trim(),
      publishYear: (book.publishYear || '').toString().trim(),
      copiesTotal: Number(book.copiesTotal) > 0 ? Number(book.copiesTotal) : 1,
      // Status is derived from this ledger; it is never stored.
      loans: Array.isArray(book.loans) ? book.loans : [],
      notes: (book.notes || '').trim(),
      language: (book.language || 'العربية').trim(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.db.books.unshift(record);
    // Bulk paths (import) defer the write; persisting the whole file once per
    // inserted book turns an import of N books into O(N^2) disk work.
    if (!defer) this._save();
    return record;
  }

  updateBook(id, patch) {
    const idx = this.db.books.findIndex((b) => b.id === id);
    if (idx === -1) return null;
    const current = this.db.books[idx];

    const safePatch = { ...patch };
    // The ledger is only ever changed through borrowCopy/returnLoan.
    delete safePatch.loans;
    delete safePatch.id;
    delete safePatch.status;
    delete safePatch.borrowerName;

    if (safePatch.copiesTotal !== undefined) {
      const requested = Number(safePatch.copiesTotal);
      const out = B.borrowedCopies(current);
      // Refuse to record fewer copies than are currently on loan.
      safePatch.copiesTotal = Math.max(out || 1, requested > 0 ? requested : 1);
    }

    const updated = { ...current, ...safePatch, id: current.id, loans: current.loans, updatedAt: nowIso() };
    this.db.books[idx] = updated;
    this._save();
    return updated;
  }

  /** Lends one copy, if one is free. Returns { ok, error?, book? }. */
  borrowCopy(bookId, { borrowerName, borrowedAt } = {}) {
    const book = this.db.books.find((b) => b.id === bookId);
    if (!book) return { ok: false, error: 'الكتاب غير موجود' };

    const name = (borrowerName || '').trim();
    if (!name) return { ok: false, error: 'اسم المستعير مطلوب' };
    if (!B.canBorrow(book)) return { ok: false, error: 'لا توجد نسخ متاحة للإعارة' };

    const when = borrowedAt ? new Date(borrowedAt) : new Date();
    if (isNaN(when.getTime())) return { ok: false, error: 'تاريخ الإعارة غير صالح' };
    if (when.getTime() > Date.now() + 86400000) return { ok: false, error: 'لا يمكن أن يكون تاريخ الإعارة في المستقبل' };

    book.loans.push({
      id: genLoanId(),
      borrowerName: name,
      borrowedAt: when.toISOString(),
      returnedAt: null,
    });
    book.updatedAt = nowIso();
    this._save();
    return { ok: true, book };
  }

  /** Marks one open loan as returned. */
  returnLoan(bookId, loanId, returnedAt) {
    const book = this.db.books.find((b) => b.id === bookId);
    if (!book) return { ok: false, error: 'الكتاب غير موجود' };
    const loan = (book.loans || []).find((l) => l.id === loanId && !l.returnedAt);
    if (!loan) return { ok: false, error: 'الإعارة غير موجودة أو أُرجعت مسبقاً' };

    const when = returnedAt ? new Date(returnedAt) : new Date();
    if (isNaN(when.getTime())) return { ok: false, error: 'تاريخ الإرجاع غير صالح' };
    if (when.getTime() < Date.parse(loan.borrowedAt)) {
      return { ok: false, error: 'تاريخ الإرجاع أسبق من تاريخ الإعارة' };
    }

    loan.returnedAt = when.toISOString();
    book.updatedAt = nowIso();
    this._save();
    return { ok: true, book };
  }

  removeBook(id) {
    const before = this.db.books.length;
    this.db.books = this.db.books.filter((b) => b.id !== id);
    this._save();
    return before !== this.db.books.length;
  }

  /**
   * Puts a previously deleted record back exactly as it was — same id,
   * same reference number, same timestamps — so an undo is a true undo
   * rather than a re-add under a new number.
   */
  restoreBook(book) {
    if (!book || !book.id) return null;
    if (this.db.books.some((b) => b.id === book.id)) return book;
    this.db.books.unshift(book);
    this._save();
    return book;
  }

  getStats() {
    const books = this.db.books;
    const byCategory = {};
    const byPublisher = {};
    let totalCopies = 0;
    let borrowedCopies = 0;
    let fullyBorrowed = 0;
    let partiallyBorrowed = 0;
    let activeBorrowers = new Set();

    for (const b of books) {
      const cat = b.category || 'غير مصنف';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
      const pub = b.publisher || 'غير محدد';
      byPublisher[pub] = (byPublisher[pub] || 0) + 1;

      totalCopies += B.totalCopies(b);
      const out = B.borrowedCopies(b);
      borrowedCopies += out;
      const status = B.bookStatus(b);
      if (status === B.STATUS_FULL) fullyBorrowed += 1;
      else if (status === B.STATUS_PARTIAL) partiallyBorrowed += 1;
      for (const name of B.currentBorrowers(b)) activeBorrowers.add(name);
    }

    return {
      totalBooks: books.length,
      totalAuthors: new Set(books.map((b) => b.author).filter(Boolean)).size,
      totalPublishers: new Set(books.map((b) => b.publisher).filter(Boolean)).size,
      totalCategories: new Set(books.map((b) => b.category).filter(Boolean)).size,
      totalCopies,
      borrowedCopies,
      availableCopies: totalCopies - borrowedCopies,
      fullyBorrowed,
      partiallyBorrowed,
      activeBorrowers: activeBorrowers.size,
      byCategory,
      byPublisher,
    };
  }

  exportJson(filePath) {
    fs.writeFileSync(filePath, JSON.stringify(this.db, null, 2), 'utf-8');
  }

  exportCsv(filePath) {
    const headers = [
      'العنوان', 'المؤلف', 'دار النشر', 'الرقم المرجعي', 'المجال',
      'الطبعة', 'سنة النشر', 'إجمالي النسخ', 'نسخ معارة', 'نسخ متاحة',
      'الحالة', 'المستعيرون الحاليون', 'ملاحظات',
    ];
    const rows = this.db.books.map((b) => [
      b.title, b.author, b.publisher, b.referenceNumber, b.category,
      b.edition, b.publishYear,
      B.totalCopies(b), B.borrowedCopies(b), B.availableCopies(b),
      B.bookStatus(b), B.currentBorrowers(b).join(' | '), b.notes,
    ]);
    const escape = (v) => {
      const s = (v === undefined || v === null) ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [headers, ...rows].map((r) => r.map(escape).join(','));
    // BOM so Excel opens Arabic UTF-8 correctly.
    fs.writeFileSync(filePath, '\uFEFF' + lines.join('\r\n'), 'utf-8');
  }

  exportTxt(filePath) {
    const lines = this.db.books.map((b, i) => {
      const open = B.activeLoans(b).map((l) =>
        `      - ${l.borrowerName} (منذ ${B.loanDurationDays(l)} يوماً)`);
      return [
        `${i + 1}. ${b.title || 'بدون عنوان'}`,
        `   المؤلف: ${b.author || '—'}`,
        `   دار النشر: ${b.publisher || '—'}`,
        `   المجال/التصنيف: ${b.category || '—'}`,
        `   الرقم المرجعي: ${b.referenceNumber || '—'}`,
        `   الطبعة: ${b.edition || '—'}    سنة النشر: ${b.publishYear || '—'}`,
        `   النسخ: ${B.totalCopies(b)} (متاح: ${B.availableCopies(b)}، معار: ${B.borrowedCopies(b)})`,
        `   الحالة: ${B.bookStatus(b)}`,
        open.length ? '   الإعارات المفتوحة:' : null,
        ...(open.length ? open : []),
        b.notes ? `   ملاحظات: ${b.notes}` : null,
        '',
      ].filter((l) => l !== null).join('\n');
    });
    const header = `فهرس مكتبة رَفّ\nتاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')}\nإجمالي الكتب: ${this.db.books.length}\n${'='.repeat(40)}\n\n`;
    fs.writeFileSync(filePath, header + lines.join('\n'), 'utf-8');
  }

  buildPrintableHtml() {
    const rows = this.db.books.map((b, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeXml(b.title)}</td>
        <td>${escapeXml(b.author)}</td>
        <td>${escapeXml(b.publisher)}</td>
        <td>${escapeXml(b.category)}</td>
        <td class="ltr">${escapeXml(b.referenceNumber)}</td>
        <td>${B.availableCopies(b)} / ${B.totalCopies(b)}</td>
        <td>${B.bookStatus(b)}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<style>
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 24px; color: #23150a; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .sub { color: #6b5644; font-size: 12px; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ddc9a3; padding: 6px 8px; text-align: right; }
  th { background: #f5eddb; }
  .ltr { direction: ltr; text-align: left; font-family: monospace; }
</style></head>
<body>
  <h1>فهرس مكتبة رَفّ</h1>
  <div class="sub">تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')} — إجمالي الكتب: ${this.db.books.length}</div>
  <table>
    <thead><tr><th>#</th><th>العنوان</th><th>المؤلف</th><th>دار النشر</th><th>المجال</th><th>الرقم المرجعي</th><th>متاح / الكل</th><th>الحالة</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;
  }

  importJson(filePath) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const incoming = Array.isArray(parsed) ? parsed : parsed.books;
    if (!Array.isArray(incoming)) throw new Error('صيغة الملف غير صالحة');

    const existingRefs = new Set(
      this.db.books.map((b) => b.referenceNumber).filter(Boolean)
    );
    let added = 0;
    let skipped = 0;

    for (const item of incoming) {
      if (item.referenceNumber && existingRefs.has(item.referenceNumber)) {
        skipped += 1;
        continue;
      }
      const record = this.addBook(item, { keepReferenceNumber: true, defer: true });
      const m = /(\d+)\s*$/.exec(record.referenceNumber || '');
      if (m) this.db.nextRefSeq = Math.max(this.db.nextRefSeq, parseInt(m[1], 10) + 1);
      if (record.referenceNumber) existingRefs.add(record.referenceNumber);
      added += 1;
    }
    this._save();
    return { added, skipped };
  }

  resetAll() {
    this.db = emptyDb();
    this._save();
  }
}

module.exports = Store;
