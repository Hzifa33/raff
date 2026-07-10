'use strict';

const ROUTES = {
  dashboard: { title: 'لوحة المعلومات', subtitle: 'نظرة عامة على مكتبتك', render: (root) => renderDashboard(root) },
  search: { title: 'البحث المتقدم', subtitle: 'ابحث حسب العنوان، المؤلف، دار النشر، أو الرقم المرجعي', render: (root, ctx) => renderBookBrowser(root, ctx) },
  add: { title: 'إضافة كتاب جديد', subtitle: 'سجّل بيانات كتاب جديد في المكتبة', render: (root) => renderAddForm(root, null) },
  library: { title: 'السجل الكامل', subtitle: 'جميع الكتب المسجلة في المكتبة', render: (root) => renderBookBrowser(root, { presetQuery: '' }) },
  stats: { title: 'الإحصائيات', subtitle: 'أرقام وتحليلات حول مكتبتك', render: (root) => renderStats(root) },
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
    if (!book) return;
    const ok = await confirmModal({
      title: 'حذف هذا الكتاب؟',
      message: `سيتم حذف "${escapeHtml(book.title)}" نهائياً من سجل المكتبة.`,
      confirmLabel: 'حذف',
    });
    if (!ok) return;
    await window.raff.removeBook(book.id);
    await refreshState();
    renderNavCounts();
    renderRoute();
    toast('تم حذف الكتاب', 'success');
    return;
  }
});

/* ---- Topbar quick search: jumps to the search view ---- */
document.getElementById('quickSearchInput').addEventListener('input', (e) => {
  _browserFilters.field = 'all';
  navigateTo('search', { presetQuery: e.target.value });
});

document.getElementById('quickAddBtn').addEventListener('click', () => navigateTo('add'));

document.getElementById('devCreditLink').addEventListener('click', (e) => {
  e.preventDefault();
  window.raff.openExternal('https://Hzifa33.github.io');
});

/* ---- Keyboard shortcuts ---- */
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    document.getElementById('quickSearchInput').focus();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    navigateTo('add');
  }
});

/* ---- Init ---- */
(async function init() {
  await refreshState();
  renderNavCounts();
  renderRoute();
})();
