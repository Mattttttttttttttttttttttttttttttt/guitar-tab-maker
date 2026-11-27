import { mountNav } from '../nav.js';
import { h } from '../ui/dom.js';
import { mountTab } from '../render.js';
import { duplicateTab, isLocalId, loadTab } from '../store.js';

const EDITOR = new URL('../../edit/', import.meta.url);
const VIEWER = new URL('../../tab/', import.meta.url);

const urlFor = (base, id) => {
  const url = new URL(base);
  url.searchParams.set('id', id);
  return url.href;
};

mountNav();

const actions = document.getElementById('actions');
const root = document.getElementById('tab-root');
const id = new URLSearchParams(location.search).get('id');
const tab = id ? await loadTab(id) : null;

if (!tab) {
  root.append(h('p', { class: 'view-missing' }, 'Tab not found.'));
} else {
  document.title = `${tab.title || 'Untitled'} · Guitar Tab Maker`;
  if (isLocalId(id)) {
    actions.append(h('a', { class: 'btn', href: urlFor(EDITOR, id) }, 'Edit'));
  }
  actions.append(h('button', {
    class: 'btn',
    type: 'button',
    onclick: () => {
      const copy = duplicateTab(tab);
      if (copy) location.href = urlFor(VIEWER, copy.id);
    },
  }, 'Duplicate'));
  mountTab(root, tab);
}
