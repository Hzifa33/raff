'use strict';

const ROUTES = {
  dashboard: { title: 'لوحة المعلومات', subtitle: 'نظرة عامة على مكتبتك', render: (root) => renderDashboard(root) },
  search: { title: 'البحث المتقدم', subtitle: 'ابحث حسب العنوان، المؤلف، دار النشر، أو الرقم المرجعي', render: (root, ctx) => renderBookBrowser(root, ctx) },
  add: { title: 'إضافة كتاب جديد', subtitle: 'سجّل بيانات كتاب جديد في المكتبة', render: (root) => renderAddForm(root, null) },
  library: { title: 'السجل الكامل', subtitle: 'جميع الكتب المسجلة في المكتبة', render: (root) => {
    const quick = document.getElementById('quickSearchInput');
    if (quick) quick.value = '';
    renderBookBrowser(root, { presetQuery: '' });
  } },
  stats: { title: 'الإحصائيات', subtitle: 'أرقام وتحليلات حول مكتبتك', render: (root) => renderStats(root) },
  reports: { title: 'الاستدعاء', subtitle: 'استدعِ مستعيراً أو دار نشر أو مؤلفاً واحصل على تحليل كامل بالأرقام', render: (root) => renderReports(root) },
  settings: { title: 'النسخ الاحتياطي والإعدادات', subtitle: 'إدارة بيانات المكتبة وإعدادات النظام', render: (root) => renderSettings(root) },
  edit: { title: 'تعديل بيانات الكتاب', subtitle: '', render: (root, ctx) => renderAddForm(root, ctx.book) },
};

let currentRoute = 'dashboard';
let currentCtx = {};

function navigateTo(route, ctx = {}) {
  currentRoute = route;
  currentCtx = ctx;
  renderRoute();
}

function renderRoute() {
  const def = ROUTES[currentRoute] || ROUTES.dashboard;
  document.getElementById('pageTitle').textContent = def.title;
  document.getElementById('pageSubtitle').textContent = def.subtitle;

  document.querySelectorAll('.nav-item').forEach((el) => {
    const navRoute = el.dataset.route;
    el.classList.toggle('active', navRoute === currentRoute || (navRoute === 'library' && currentRoute === 'edit'));
  });

  const root = document.getElementById('viewRoot');
  def.render(root, currentCtx);
  root.scrollTop = 0;
}

function renderNavCounts() {
  document.getElementById('navLibraryCount').textContent = RAFF_STATE.books.length;
}

/* ---- Global click delegation: nav buttons, book row edit/delete, empty-state CTAs ---- */
document.addEventListener('click', async (e) => {
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) {
    navigateTo(navBtn.dataset.nav);
    return;
  }

  const navItem = e.target.closest('.nav-item[data-route]');
  if (navItem) {
    navigateTo(navItem.dataset.route);
    return;
  }

  const editBtn = e.target.closest('[data-action="edit"]');
  if (editBtn) {
    const book = RAFF_STATE.books.find((b) => b.id === editBtn.dataset.id);
    if (book) navigateTo('edit', { book });
    return;
  }

  const deleteBtn = e.target.closest('[data-action="delete"]');
  if (deleteBtn) {
    const book = RAFF_STATE.books.find((b) => b.id === deleteBtn.dataset.id);
    if (book) await deleteBookWithUndo(book);
    return;
  }

  // Clicking anywhere else on a row opens its details.
  const row = e.target.closest('.book-row[data-action="details"]');
  if (row) {
    showBookDetails(row.dataset.id);
  }
});

/** Re-renders the current view; browsing views update in place to keep scroll. */
function refreshCurrentView() {
  if (currentRoute === 'search' || currentRoute === 'library') {
    updateBookResults({ resetScroll: false });
  } else {
    renderRoute();
  }
}

/* ---- Keyboard access for book rows ---- */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const row = e.target.closest?.('.book-row[data-action="details"]');
  if (!row) return;
  e.preventDefault();
  showBookDetails(row.dataset.id);
});

/* ---- Topbar quick search ----
   Navigating on every keystroke would rebuild the view and pull focus out of
   this input. Once we're already on a browsing route we only refresh results. */
document.getElementById('quickSearchInput').addEventListener('input', (e) => {
  const value = e.target.value;
  _browserFilters.query = value;

  if (currentRoute === 'search' || currentRoute === 'library') {
    syncFilterInputValue(value);
    scheduleBookResults();
  } else {
    _browserFilters.field = 'all';
    navigateTo('search', { presetQuery: value });
  }
});

document.getElementById('quickAddBtn').addEventListener('click', () => navigateTo('add'));

/* ---- Predictive suggestions for the topbar search ---- */
createAutocomplete(document.getElementById('quickSearchInput'), {
  getPool: () => RAFF_STATE.suggestions,
  onSelect: (label) => {
    _browserFilters.query = label;
    _browserFilters.field = 'all';
    if (currentRoute === 'search' || currentRoute === 'library') {
      syncFilterInputValue(label);
      updateBookResults({ resetScroll: true });
    } else {
      navigateTo('search', { presetQuery: label });
    }
  },
  typeLabels: SUGGESTION_TYPE_LABELS,
});

document.getElementById('devCreditLink').addEventListener('click', (e) => {
  e.preventDefault();
  window.raff.openExternal('https://Hzifa33.github.io');
});

/* ---- Keyboard shortcuts ---- */
document.addEventListener('keydown', (e) => {
  const quick = document.getElementById('quickSearchInput');

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    quick.focus();
    quick.select();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    navigateTo('add');
    return;
  }
  // Ctrl+S saves whichever book form is open.
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    const form = document.getElementById('bookForm');
    if (form) {
      e.preventDefault();
      form.querySelector('button[type=submit]').click();
    }
    return;
  }
  // Escape clears the quick search when it holds focus.
  if (e.key === 'Escape' && document.activeElement === quick && quick.value) {
    quick.value = '';
    _browserFilters.query = '';
    if (currentRoute === 'search' || currentRoute === 'library') {
      syncFilterInputValue('');
      updateBookResults({ resetScroll: true });
    }
  }
});

/* ---- Custom title bar window controls ---- */
(function initWindowControls() {
  const root = document.querySelector('.app-root');
  const maxBtn = document.getElementById('winMaximize');

  const applyState = ({ maximized }) => {
    root.classList.toggle('is-maximized', !!maximized);
    maxBtn.title = maximized ? 'استعادة' : 'تكبير';
    maxBtn.setAttribute('aria-label', maxBtn.title);
  };

  document.getElementById('winMinimize').addEventListener('click', () => window.raff.minimize());
  maxBtn.addEventListener('click', () => window.raff.toggleMaximize());
  document.getElementById('winClose').addEventListener('click', () => window.raff.close());

  // Double-clicking the drag area toggles maximize, matching OS behaviour.
  document.querySelector('.titlebar-drag').addEventListener('dblclick', () => window.raff.toggleMaximize());

  window.raff.onWindowStateChange(applyState);
  window.raff.isMaximized().then((maximized) => applyState({ maximized }));
})();

/* ---- Init ---- */
(async function init() {
  await refreshState();
  renderNavCounts();
  renderRoute();
})();
