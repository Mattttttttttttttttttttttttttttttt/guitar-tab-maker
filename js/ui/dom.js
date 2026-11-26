export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === false || value == null) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.flat(Infinity).filter(c => c !== false && c != null));
  return el;
}

export function svg(markup) {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup.trim();
  return tpl.content.firstElementChild;
}

const STROKE = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const ICONS = {
  chevron: `<svg ${STROKE}><path d="m6 9 6 6 6-6"/></svg>`,
  close: `<svg ${STROKE}><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  plus: `<svg ${STROKE}><path d="M12 5v14M5 12h14"/></svg>`,
  library: `<svg ${STROKE}><path d="M4 5h16M4 12h16M4 19h10"/></svg>`,
};

export const icon = name => svg(ICONS[name]);
