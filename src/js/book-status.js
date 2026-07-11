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

  const LOAN_FULL = 'full';       // one whole copy (all volumes) is out
  const LOAN_VOLUME = 'volume';   // a single volume of one copy is out

  const MS_PER_DAY = 86400000;

  function totalCopies(book) {
    const n = Number(book && book.copiesTotal);
    return n > 0 ? n : 1;
  }

  function totalVolumes(book) {
    const n = Number(book && book.volumes);
    return n > 0 ? Math.floor(n) : 1;
  }

  function isMultiVolume(book) {
    return totalVolumes(book) > 1;
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

  function isVolumeLoan(loan) {
    return loan.type === LOAN_VOLUME || (loan.volume != null && loan.type !== LOAN_FULL);
  }

  /** Active full-copy loans (each occupies one copy across every volume). */
  function activeFullLoans(book) {
    return activeLoans(book).filter((l) => !isVolumeLoan(l));
  }

  /** Active single-volume loans for a specific volume number. */
  function activeVolumeLoans(book, volumeNo) {
    return activeLoans(book).filter((l) => isVolumeLoan(l) && Number(l.volume) === Number(volumeNo));
  }

  /**
   * How many copies of a given volume are out. A full-copy loan removes one
   * copy of *every* volume; a volume loan removes one copy of just that volume.
   */
  function borrowedOfVolume(book, volumeNo) {
    return activeFullLoans(book).length + activeVolumeLoans(book, volumeNo).length;
  }

  function availableOfVolume(book, volumeNo) {
    const avail = totalCopies(book) - borrowedOfVolume(book, volumeNo);
    return avail > 0 ? avail : 0;
  }

  /** A whole copy is free only if every single volume still has a copy free. */
  function borrowedFullCopies(book) {
    return activeFullLoans(book).length;
  }

  function availableFullCopies(book) {
    const vols = totalVolumes(book);
    let minFree = totalCopies(book) - borrowedFullCopies(book);
    // A complete set also needs every volume to have a free copy, so any
    // outstanding volume loan reduces how many whole sets remain lendable.
    for (let v = 1; v <= vols; v++) {
      const free = totalCopies(book) - borrowedOfVolume(book, v);
      if (free < minFree) minFree = free;
    }
    return minFree > 0 ? minFree : 0;
  }

  // ---- Backwards-compatible copy-level helpers (single-volume books) ----
  function borrowedCopies(book) {
    return activeLoans(book).length;
  }

  function availableCopies(book) {
    const avail = totalCopies(book) - borrowedCopies(book);
    return avail > 0 ? avail : 0;
  }

  /**
   * Whole-book status. For a multi-volume title we look at every volume: if no
   * volume has any copy out it's available; if some volume has every copy out
   * it's fully borrowed; otherwise partially borrowed.
   */
  function bookStatus(book) {
    const vols = totalVolumes(book);
    const copies = totalCopies(book);
    if (vols <= 1) {
      const out = borrowedCopies(book);
      if (out === 0) return STATUS_AVAILABLE;
      if (out >= copies) return STATUS_FULL;
      return STATUS_PARTIAL;
    }
    let anyOut = false;
    let anyVolumeFull = false;
    for (let v = 1; v <= vols; v++) {
      const out = borrowedOfVolume(book, v);
      if (out > 0) anyOut = true;
      if (out >= copies) anyVolumeFull = true;
    }
    if (!anyOut) return STATUS_AVAILABLE;
    // Every volume fully out (and thus no whole set free) → fully borrowed.
    if (anyVolumeFull && availableFullCopies(book) === 0) {
      let allFull = true;
      for (let v = 1; v <= vols; v++) {
        if (borrowedOfVolume(book, v) < copies) { allFull = false; break; }
      }
      if (allFull) return STATUS_FULL;
    }
    return STATUS_PARTIAL;
  }

  /** True when at least one whole copy can be lent out right now. */
  function canBorrow(book) {
    return availableFullCopies(book) > 0;
  }

  /** True when a given volume still has a copy free. */
  function canBorrowVolume(book, volumeNo) {
    const v = Number(volumeNo);
    if (!(v >= 1 && v <= totalVolumes(book))) return false;
    return availableOfVolume(book, v) > 0;
  }

  /** Whole days a loan has been (or was) held. Never negative. */
  function loanDurationDays(loan, now) {
    const start = Date.parse(loan.borrowedAt);
    if (!start) return 0;
    const end = loan.returnedAt ? Date.parse(loan.returnedAt) : (now || Date.now());
    const days = Math.floor((end - start) / MS_PER_DAY);
    return days > 0 ? days : 0;
  }

  /** Days remaining until due (negative if overdue). Null if no due date. */
  function daysUntilDue(loan, now) {
    if (!loan.dueAt) return null;
    const due = Date.parse(loan.dueAt);
    if (!due) return null;
    return Math.ceil((due - (now || Date.now())) / MS_PER_DAY);
  }

  function isOverdue(loan, limitDays, now) {
    if (loan.returnedAt) return false;
    if (loan.dueAt) return (now || Date.now()) > Date.parse(loan.dueAt);
    // Legacy loans without a due date fall back to a fixed limit.
    return loanDurationDays(loan, now) > (limitDays || 30);
  }

  /** An open loan due within `windowDays` (and not already overdue). */
  function isDueSoon(loan, windowDays, now) {
    if (loan.returnedAt || !loan.dueAt) return false;
    const d = daysUntilDue(loan, now);
    return d !== null && d >= 0 && d <= (windowDays || 7);
  }

  /** Distinct names currently holding any copy or volume of this book. */
  function currentBorrowers(book) {
    return activeLoans(book).map((l) => l.borrowerName).filter(Boolean);
  }

  /** Human label for a loan: "نسخة كاملة" or "الجزء N". */
  function loanScopeLabel(loan) {
    return isVolumeLoan(loan) ? ('الجزء ' + loan.volume) : 'نسخة كاملة';
  }

  return {
    STATUS_AVAILABLE,
    STATUS_PARTIAL,
    STATUS_FULL,
    ALL_STATUSES: [STATUS_AVAILABLE, STATUS_PARTIAL, STATUS_FULL],
    LOAN_FULL,
    LOAN_VOLUME,
    totalCopies,
    totalVolumes,
    isMultiVolume,
    activeLoans,
    activeFullLoans,
    activeVolumeLoans,
    isVolumeLoan,
    borrowedOfVolume,
    availableOfVolume,
    borrowedFullCopies,
    availableFullCopies,
    borrowedCopies,
    availableCopies,
    bookStatus,
    canBorrow,
    canBorrowVolume,
    loanDurationDays,
    daysUntilDue,
    isOverdue,
    isDueSoon,
    currentBorrowers,
    loanScopeLabel,
  };
}));
