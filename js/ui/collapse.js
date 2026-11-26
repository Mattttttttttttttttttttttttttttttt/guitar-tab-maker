import { h, icon } from './dom.js';

let counter = 0;

export function collapsible({ label, body, collapsed = false }) {
  const bodyId = `section-body-${++counter}`;
  const bodyEl = h('div', { class: 'section-body', id: bodyId }, body);
  const toggle = h('button', {
    class: 'section-toggle',
    type: 'button',
    'aria-controls': bodyId,
  }, h('span', {}, label), icon('chevron'));

  function set(value) {
    bodyEl.hidden = value;
    toggle.setAttribute('aria-expanded', String(!value));
  }
  toggle.addEventListener('click', () => set(!bodyEl.hidden));
  set(collapsed);

  const el = h('section', {}, h('div', { class: 'section-head' }, toggle), bodyEl);
  return { el, bodyEl, set };
}
