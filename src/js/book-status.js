/**
 * Copy-aware loan logic, shared by the main-process store and the renderer.
 *
 * A book is not "borrowed" or "available" as a whole — each *copy* is. A title
 * with 3 copies and 1 out on loan still has 2 copies a reader can take today.
 * Status is therefore never stored; it is derived from the loan ledger so the
 * two can never disagree.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RaffBook = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STATUS_AVAILABLE = 'متاح';
  const STATUS_PARTIAL = 'معار جزئياً';
  const STATUS_FULL = 'معار بالكامل';

  const MS_PER_DAY = 86400000;

  function totalCopies(book) {
    const n = Number(book && book.copiesTotal);
    return n > 0 ? n : 1;
  }

  /** Loans that have not been returned yet. */
  function activeLoans(book) {
    const loans = (book && book.loans) || [];
    const out = [];
    for (let i = 0; i < loans.length; i++) {
      if (!loans[i].returnedAt) out.push(loans[i]);
    }
    return out;
  }

  function borrowedCopies(book) {
    return activeLoans(book).length;
  }

  function availableCopies(book) {
    const avail = totalCopies(book) - borrowedCopies(book);
    return avail > 0 ? avail : 0;
  }

  /**
   * The third state the model was missing: a title can be partially out.
   * Only when every copy is on loan is the title truly unavailable.
   */
  function bookStatus(book) {
    const out = borrowedCopies(book);
    if (out === 0) return STATUS_AVAILABLE;
    if (out >= totalCopies(book)) return STATUS_FULL;
    return STATUS_PARTIAL;
  }

  /** True when at least one copy can be lent out right now. */
  function canBorrow(book) {
    return availableCopies(book) > 0;
  }

  /** Whole days a loan has been (or was) held. Never negative. */
  function loanDurationDays(loan, now) {
    const start = Date.parse(loan.borrowedAt);
    if (!start) return 0;
    const end = loan.returnedAt ? Date.parse(loan.returnedAt) : (now || Date.now());
    const days = Math.floor((end - start) / MS_PER_DAY);
    return days > 0 ? days : 0;
  }

  function isOverdue(loan, limitDays, now) {
    if (loan.returnedAt) return false;
    return loanDurationDays(loan, now) > (limitDays || 30);
  }

  /** Distinct names currently holding a copy of this book. */
  function currentBorrowers(book) {
    return activeLoans(book).map((l) => l.borrowerName).filter(Boolean);
  }

  return {
    STATUS_AVAILABLE,
    STATUS_PARTIAL,
    STATUS_FULL,
    ALL_STATUSES: [STATUS_AVAILABLE, STATUS_PARTIAL, STATUS_FULL],
    totalCopies,
    activeLoans,
    borrowedCopies,
    availableCopies,
    bookStatus,
    canBorrow,
    loanDurationDays,
    isOverdue,
    currentBorrowers,
  };
}));
