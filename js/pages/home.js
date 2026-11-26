import { mountNav } from '../nav.js';
import { h } from '../ui/dom.js';
import { collapsible } from '../ui/collapse.js';
import { listLocalTabs, listMattTabs } from '../store.js';

const VIEWER = new URL('../../tab/', import.meta.url);

function card(tab) {
  const href = new URL(VIEWER);
  href.searchParams.set('id', tab.id);
  return h('a', { class: 'tab-card', href: href.href },
    h('div', { class: 'tab-card-title' }, tab.title || 'Untitled'),
    tab.artist && h('div', { class: 'tab-card-artist' }, tab.artist));
}

function section(label, tabs) {
  return collapsible({ label, body: h('div', { class: 'card-grid' }, tabs.map(card)) }).el;
}

mountNav();

const sections = document.getElementById('sections');
sections.append(section('my tabs', listLocalTabs()));
listMattTabs().then(tabs => sections.append(section("matt's tabs", tabs)));
