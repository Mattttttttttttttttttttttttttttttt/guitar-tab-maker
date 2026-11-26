import { h, icon } from './dom.js';

const stack = [];
const FADE_MS = 250;

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !stack.length) return;
  e.preventDefault();
  stack[stack.length - 1]();
});

function lockScroll() {
  const root = document.documentElement;
  root.style.setProperty('--sbw', `${window.innerWidth - root.clientWidth}px`);
  root.classList.add('modal-open');
}

function unlockScroll() {
  const root = document.documentElement;
  root.classList.remove('modal-open');
  root.style.removeProperty('--sbw');
}

export function openModal({ content, label }) {
  const opener = document.activeElement;
  const closeBtn = h('button', { class: 'modal-close', type: 'button', 'aria-label': 'Close' }, icon('close'));
  const dialog = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': label }, closeBtn, content);
  const backdrop = h('div', { class: 'modal-backdrop' }, dialog);

  const background = [...document.body.children].filter(el => !el.inert);
  background.forEach(el => { el.inert = true; });
  if (!stack.length) lockScroll();
  document.body.append(backdrop);
  backdrop.getBoundingClientRect();
  backdrop.classList.add('open');

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    stack.splice(stack.indexOf(close), 1);
    backdrop.inert = true;
    backdrop.classList.remove('open');
    background.forEach(el => { el.inert = false; });
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    setTimeout(() => {
      backdrop.remove();
      if (!stack.length) unlockScroll();
    }, FADE_MS);
  }
  stack.push(close);

  let pressedOnBackdrop = false;
  backdrop.addEventListener('mousedown', e => { pressedOnBackdrop = e.target === backdrop; });
  backdrop.addEventListener('click', e => { if (pressedOnBackdrop && e.target === backdrop) close(); });
  closeBtn.addEventListener('click', close);

  (dialog.querySelector('[data-autofocus]') || closeBtn).focus({ preventScroll: true });

  return { close, dialog };
}
