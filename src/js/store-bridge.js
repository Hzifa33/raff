'use strict';

const RAFF_STATE = {
  books: [],
  meta: { authors: [], publishers: [], categories: [] },
  stats: {},
};

const _subscribers = [];

function onStateChange(fn) {
  _subscribers.push(fn);
}

async function refreshState() {
  const [books, meta, stats] = await Promise.all([
    window.raff.getAll(),
    window.raff.getMeta(),
    window.raff.getStats(),
  ]);
  RAFF_STATE.books = books;
  RAFF_STATE.meta = meta;
  RAFF_STATE.stats = stats;
  _subscribers.forEach((fn) => fn(RAFF_STATE));
  return RAFF_STATE;
}

/* A stable, warm palette that stands in for leather book-spine colors.
   Category names hash deterministically to one of these so the same
   category always renders the same "spine" tone across the app. */
const SPINE_PALETTE = [
  '#a17c22', '#732e2e', '#3b4f3f', '#6b4226',
  '#8a5a34', '#5c2323', '#7d5f18', '#4a2f1a',
];

function spineColorFor(seed) {
  const s = (seed || 'عام').toString();
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return SPINE_PALETTE[hash % SPINE_PALETTE.length];
}
