import { clone, defaultLibrary, uid } from './model.js';

const LIBRARY_KEY = 'gtm.library';
const TAB_PREFIX = 'gtm.tab.';
const TABS_DIR = new URL('../tabs/', import.meta.url);

export const isLocalId = id => id.startsWith('local-');

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* ── Library ── */

export function getLibrary() {
  const stored = read(LIBRARY_KEY);
  if (stored?.v === 1) return stored;
  const fresh = defaultLibrary();
  write(LIBRARY_KEY, fresh);
  return fresh;
}

export const saveLibrary = library => write(LIBRARY_KEY, library);

/* ── Tabs ── */

export function listLocalTabs() {
  const tabs = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key.startsWith(TAB_PREFIX)) continue;
    const tab = read(key);
    if (tab) tabs.push({ id: tab.id, title: tab.title, artist: tab.artist, updated: tab.updated || 0 });
  }
  return tabs.sort((a, b) => b.updated - a.updated);
}

export async function listMattTabs() {
  try {
    const res = await fetch(new URL('index.json', TABS_DIR));
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

export async function loadTab(id) {
  if (!/^[\w-]+$/.test(id)) return null;
  if (isLocalId(id)) return read(TAB_PREFIX + id);
  try {
    const res = await fetch(new URL(`${id}.json`, TABS_DIR));
    return res.ok ? { ...(await res.json()), id } : null;
  } catch {
    return null;
  }
}

export function saveTab(tab) {
  const saved = { ...tab, id: tab.id || uid('local'), updated: Date.now() };
  return write(TAB_PREFIX + saved.id, saved) ? saved : null;
}

export function deleteTab(id) {
  localStorage.removeItem(TAB_PREFIX + id);
}

export function duplicateTab(tab) {
  const copy = clone(tab);
  copy.id = uid('local');
  copy.title = `${tab.title} copy`.trim();
  return saveTab(copy);
}

/* ── Import / export ── */

export function downloadTab(tab) {
  const { id, updated, ...data } = tab;
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: `${(tab.title || 'untitled').toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'untitled'}.json`,
  });
  link.click();
  URL.revokeObjectURL(url);
}

export async function readTabFile(file) {
  try {
    const data = JSON.parse(await file.text());
    const valid = data?.v === 1 && ['chords', 'progressions', 'basics', 'parts'].every(k => Array.isArray(data[k]));
    return valid ? data : null;
  } catch {
    return null;
  }
}
