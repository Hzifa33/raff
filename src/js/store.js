'use strict';

const fs = require('fs');
const path = require('path');

const DB_FILE = 'raff-library.json';
const SCHEMA_VERSION = 1;

function nowIso() {
  return new Date().toISOString();
}

function genId() {
  return 'b_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function emptyDb() {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: nowIso(),
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

  getAll() {
    return this.db.books;
  }

  getMeta() {
    const authors = new Set();
    const publishers = new Set();
    const categories = new Set();
    for (const b of this.db.books) {
      if (b.author) authors.add(b.author.trim());
      if (b.publisher) publishers.add(b.publisher.trim());
      if (b.category) categories.add(b.category.trim());
    }
    return {
      authors: [...authors].sort((a, c) => a.localeCompare(c, 'ar')),
      publishers: [...publishers].sort((a, c) => a.localeCompare(c, 'ar')),
      categories: [...categories].sort((a, c) => a.localeCompare(c, 'ar')),
      filePath: this.filePath,
    };
  }

  addBook(book) {
    const record = {
      id: genId(),
      title: (book.title || '').trim(),
      author: (book.author || '').trim(),
      publisher: (book.publisher || '').trim(),
      referenceNumber: (book.referenceNumber || '').trim(),
      category: (book.category || '').trim(),
      edition: (book.edition || '').trim(),
      publishYear: (book.publishYear || '').toString().trim(),
      copiesTotal: Number(book.copiesTotal) > 0 ? Number(book.copiesTotal) : 1,
      status: book.status === 'معار' ? 'معار' : 'متاح',
      borrowerName: (book.borrowerName || '').trim(),
      notes: (book.notes || '').trim(),
      language: (book.language || 'العربية').trim(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.db.books.unshift(record);
    this._save();
    return record;
  }

  updateBook(id, patch) {
    const idx = this.db.books.findIndex((b) => b.id === id);
    if (idx === -1) return null;
    const current = this.db.books[idx];
    const updated = { ...current, ...patch, id: current.id, updatedAt: nowIso() };
    this.db.books[idx] = updated;
    this._save();
    return updated;
  }

  removeBook(id) {
    const before = this.db.books.length;
    this.db.books = this.db.books.filter((b) => b.id !== id);
    this._save();
    return before !== this.db.books.length;
  }

  getStats() {
    const books = this.db.books;
    const byCategory = {};
    const byPublisher = {};
    let borrowed = 0;
    let totalCopies = 0;

    for (const b of books) {
      const cat = b.category || 'غير مصنف';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
      const pub = b.publisher || 'غير محدد';
      byPublisher[pub] = (byPublisher[pub] || 0) + 1;
      if (b.status === 'معار') borrowed += 1;
      totalCopies += Number(b.copiesTotal) || 0;
    }

    return {
      totalBooks: books.length,
      totalAuthors: new Set(books.map((b) => b.author).filter(Boolean)).size,
      totalPublishers: new Set(books.map((b) => b.publisher).filter(Boolean)).size,
      totalCategories: new Set(books.map((b) => b.category).filter(Boolean)).size,
      totalCopies,
      borrowed,
      available: books.length - borrowed,
      byCategory,
      byPublisher,
    };
  }

  exportJson(filePath) {
    fs.writeFileSync(filePath, JSON.stringify(this.db, null, 2), 'utf-8');
  }

  exportCsv(filePath) {
    const headers = [
      'العنوان', 'المؤلف', 'دار النشر', 'الرقم المرجعي', 'التصنيف',
      'الطبعة', 'سنة النشر', 'عدد النسخ', 'الحالة', 'المستعير', 'ملاحظات',
    ];
    const rows = this.db.books.map((b) => [
      b.title, b.author, b.publisher, b.referenceNumber, b.category,
      b.edition, b.publishYear, b.copiesTotal, b.status, b.borrowerName, b.notes,
    ]);
    const escape = (v) => {
      const s = (v === undefined || v === null) ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [headers, ...rows].map((r) => r.map(escape).join(','));
    // BOM so Excel opens Arabic UTF-8 correctly.
    fs.writeFileSync(filePath, '\uFEFF' + lines.join('\r\n'), 'utf-8');
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
      const record = this.addBook(item);
      if (record.referenceNumber) existingRefs.add(record.referenceNumber);
      added += 1;
    }
    return { added, skipped };
  }

  resetAll() {
    this.db = emptyDb();
    this._save();
  }
}

module.exports = Store;
