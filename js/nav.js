import { h, icon, svg } from './ui/dom.js';
import { openModal } from './ui/modal.js';
import { LOGO } from './logo.js';
import { CAT } from './cat.js';

const ROOT = new URL('../', import.meta.url);

const LINKS = [
  { label: 'github', href: 'https://github.com/Mattttttttttttttttttttttttttttttt', tip: 'go to my Github page!' },
  { label: 'wca', href: 'https://worldcubeassociation.org/persons/2023MAOS01', tip: 'go to my WCA profile!' },
  { label: 'youtube', href: 'https://youtube.com/@Matt-er', tip: 'check out my Youtube channel :D' },
];

function buildAbout() {
  return h('div', { class: 'about' },
    h('div', { class: 'about-content' },
      h('div', { class: 'about-eyebrow' }, 'about me'),
      h('div', { class: 'about-title' }, 'Matt Mao'),
      h('div', { class: 'about-divider' }),
      h('p', { class: 'about-text' }, "Hiiii in case you can't tell, I like cats :3 (and all fluffiness alike)"),
      h('p', { class: 'about-text' }, "I'm a coober (which is why you are here, probably), but I'm also a programmer (also obvious) and ... damn i should get new hobbies i think"),
      h('p', { class: 'about-text' }, 'Ooo I also play guitar and throw frisbee. yayyyyyy'),
      h('p', { class: 'about-text' }, "Anyways I don't bite, so if you are chill, I'd love to make some friends :3"),
      h('div', { class: 'about-links' }, LINKS.map(l => h('a', {
        class: 'about-link',
        href: l.href,
        target: '_blank',
        rel: 'noopener',
        'data-tip': l.tip,
      }, l.label)))),
    h('div', { class: 'about-image' },
      h('img', { src: '/icons/panda.jpg', alt: 'Mr. Panda' }),
      h('div', { class: 'about-caption' }, 'say hi to Mr. Panda!!')));
}

function wireTips(root) {
  let tip = null;
  const hide = () => { tip?.remove(); tip = null; };
  root.querySelectorAll('[data-tip]').forEach(el => {
    el.addEventListener('mouseenter', () => {
      hide();
      tip = h('div', { class: 'tip' }, el.dataset.tip);
      document.body.append(tip);
      const r = el.getBoundingClientRect();
      tip.style.left = `${r.left}px`;
      tip.style.top = `${r.bottom + 8}px`;
      requestAnimationFrame(() => tip?.classList.add('show'));
    });
    el.addEventListener('mouseleave', hide);
  });
}

export function mountNav({ logo = LOGO } = {}) {
  const aboutBtn = h('button', { class: 'nav-btn', type: 'button' }, 'about');
  const nav = h('nav', { id: 'nav' },
    h('div', { class: 'nav-inner' },
      h('div', { class: 'nav-brand' },
        h('a', { class: 'nav-cat', href: new URL('../', ROOT).href, 'aria-label': "Matt's corner" }, svg(CAT)),
        h('span', { class: 'nav-sep' }),
        h('a', { class: 'nav-logo', href: ROOT.href, 'aria-label': 'Guitar Tab Maker' }, svg(logo))),
      h('div', { class: 'nav-actions' },
        h('a', { class: 'nav-btn icon', href: new URL('library/', ROOT).href, 'aria-label': 'Library', title: 'Library' }, icon('library')),
        aboutBtn)));
  document.body.prepend(nav);

  aboutBtn.addEventListener('click', () => {
    const content = buildAbout();
    wireTips(content);
    openModal({ content, label: 'About' });
  });
}
