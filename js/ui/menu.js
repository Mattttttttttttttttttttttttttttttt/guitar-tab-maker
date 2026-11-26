import { h } from './dom.js';

let current = null;

export function closeMenu() {
  if (current) current();
}

export function showMenu({ x, y, items, label = 'Actions' }) {
  closeMenu();
  const opener = document.activeElement;

  const buttons = items.map(item => h('button', {
    class: 'menu-item',
    type: 'button',
    role: 'menuitem',
    disabled: !!item.disabled,
    onclick: () => { close(); item.onSelect(); },
  }, item.label));
  const menu = h('div', { class: 'menu', role: 'menu', 'aria-label': label }, buttons);

  document.body.append(menu);
  const { width, height } = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - height - 8))}px`;

  const enabled = buttons.filter(b => !b.disabled);
  enabled[0]?.focus({ preventScroll: true });

  function onPointerDown(e) { if (!menu.contains(e.target)) close(); }
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    } else if (e.key === 'Tab') {
      close();
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) && enabled.length) {
      e.preventDefault();
      const i = enabled.indexOf(document.activeElement);
      const next = e.key === 'Home' ? 0
        : e.key === 'End' ? enabled.length - 1
        : (i + (e.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length;
      enabled[next].focus({ preventScroll: true });
    }
  }

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('blur', close);
  window.addEventListener('resize', close);
  window.addEventListener('scroll', close, true);

  function close() {
    if (current !== close) return;
    current = null;
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('blur', close);
    window.removeEventListener('resize', close);
    window.removeEventListener('scroll', close, true);
    menu.remove();
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  }
  current = close;
  return close;
}
