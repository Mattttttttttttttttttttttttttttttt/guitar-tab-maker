import { h } from './ui/dom.js';
import { DEFAULT_TUNING } from './model.js';
import { arrangeTab } from './arrange.js';
import { chordDiagram, diagramHeight } from './diagram.js';

const BEAT_MIN_PX = 56;
const BAR_PAD_PX = 26;
const LEAD_PX = 44;
const LYRIC_PX = 14.4;
const LYRIC_GAP_PX = 8;
const LYRIC_EDGE_PX = 6;
const FALLBACK_WIDTH = 900;
const ROW_PX = 14;
const STEM_H_PX = 20;
const STEM_GAP_PX = 5;
const STAFF_ROWS = 5;
const DIAGRAM_NAME_PX = 13;
const DIAGRAM_GAP_PX = 9;

/* ── Sizing ── */

let measureContext = null;
function textWidth(text) {
  measureContext ??= document.createElement('canvas').getContext('2d');
  measureContext.font = `${LYRIC_PX}px ${getComputedStyle(document.body).fontFamily}`;
  return measureContext.measureText(text).width;
}

function measureBar(bar) {
  const lines = bar.lyricLines.map(line => [...line].sort((a, b) => a.ratio - b.ratio));
  let span = bar.beats * BEAT_MIN_PX;
  for (const lyrics of lines) {
    for (let i = 1; i < lyrics.length; i++) {
      const gap = lyrics[i].ratio - lyrics[i - 1].ratio;
      if (gap <= 0) continue;
      const needed = ((textWidth(lyrics[i - 1].text) + textWidth(lyrics[i].text)) / 2 + LYRIC_GAP_PX) / gap;
      span = Math.max(span, needed);
    }
  }

  let padLeft = BAR_PAD_PX;
  let padRight = BAR_PAD_PX;
  for (const lyrics of lines) {
    if (!lyrics.length) continue;
    const first = lyrics[0];
    const last = lyrics[lyrics.length - 1];
    padLeft = Math.max(padLeft, Math.ceil(textWidth(first.text) / 2) + LYRIC_EDGE_PX - Math.floor(first.ratio * span));
    padRight = Math.max(padRight, Math.ceil(textWidth(last.text) / 2) + LYRIC_EDGE_PX - Math.floor((1 - last.ratio) * span));
  }
  bar.padLeft = padLeft;
  bar.padRight = padRight;
  bar.minWidth = Math.ceil(span) + padLeft + padRight;
}

function breakRows(bars, width) {
  const available = width - LEAD_PX;
  const rows = [];
  let row = [];
  let used = 0;
  for (const bar of bars) {
    if (row.length && used + bar.minWidth > available) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push(bar);
    used += bar.minWidth;
  }
  if (row.length) rows.push(row);
  return rows;
}

/* ── Bar rows ── */

const vars = values => Object.entries(values).map(([k, v]) => `--${k}:${v}`).join(';');
const at = (className, values, ...children) => h('span', { class: className, style: vars(values) }, ...children);

function stemSegments(rows) {
  const gap = `${STEM_GAP_PX}px`;
  const tail = { a: STAFF_ROWS, ga: '0px', b: STAFF_ROWS, gb: 'var(--stem-h)' };
  if (!rows.length) return [tail];

  const segments = [];
  rows.slice(0, -1).forEach((row, i) => {
    const next = rows[i + 1];
    if ((next - row) * ROW_PX - STEM_GAP_PX * 2 > 3) {
      segments.push({ a: row, ga: gap, b: next, gb: `-${gap}` });
    }
  });
  segments.push({ ...tail, a: rows[rows.length - 1], ga: gap });
  return segments;
}

const staffLines = () => Array.from({ length: STAFF_ROWS + 1 }, (_, i) => at('staff-line', { i }));

const edgeClass = edge => (edge ? ` edge-${edge}` : '');

function renderStaff(bar, signature) {
  const classes = ['bar-staff', bar.repeatStart && 'rep-start', bar.repeatEnd && 'rep-end'];
  return h('div', { class: classes.filter(Boolean).join(' ') },
    staffLines(),
    bar.stems.flatMap(s => stemSegments(s.rows).map(seg => at('stem', { r: s.ratio, ...seg }))),
    bar.beams.map(b => at('beam', { r1: b.r1, r2: b.r2, lvl: b.level })),
    bar.flags.map(f => at('flag', { r: f.ratio, lvl: f.level })),
    bar.arcs.map(a => at(`tab-arc${edgeClass(a.edge)}`, { r1: a.r1, r2: a.r2, i: a.string },
      a.label && h('span', { class: 'tab-arc-label' }, a.label))),
    bar.strums.map(s => at(`tab-strum ${s.dir}`, { r: s.ratio, from: s.from, to: s.to })),
    bar.marks.map(m => at(`tab-mark ${m.kind}`, { r: m.ratio, i: m.string }, m.kind === 'fret' && m.text)),
    signature && renderSignature(signature));
}

function renderSignature(signature) {
  return h('span', { class: 'tab-ts' }, h('span', {}, signature[0]), h('span', {}, signature[1]));
}

function renderMelody(bar) {
  return h('div', { class: 'bar-melody' },
    bar.melody.map(m => at('jp', { r: m.ratio, lines: m.lines },
      m.digit,
      m.acc !== 0 && h('span', { class: 'jp-acc' }, m.acc > 0 ? '♯' : '♭'),
      Array.from({ length: Math.abs(m.octave) }, (_, k) => at(`jp-oct ${m.octave > 0 ? 'up' : 'down'}`, { k })),
      m.dot && h('span', { class: 'jp-aug' }))),
    bar.melodyTies.map(t => at(`jp-tie${edgeClass(t.edge)}`, { r1: t.r1, r2: t.r2 })),
    bar.dashes.map(d => at('jp-dash', { r: d.ratio }, d.dot && h('span', { class: 'jp-aug' }))),
    bar.underlines.map(u => at('jp-line', { r1: u.r1, r2: u.r2, lvl: u.level })));
}

function renderVolta({ number, first, last }) {
  const classes = ['volta', first && 'first', last && 'last'];
  return h('div', { class: classes.filter(Boolean).join(' ') }, first && h('span', { class: 'volta-label' }, `${number}.`));
}

function renderLyricLines(count, bar) {
  return Array.from({ length: count }, (_, k) =>
    h('div', { class: 'bar-lyrics' }, (bar?.lyricLines[k] ?? []).map(l => at('lyric', { r: l.ratio }, l.text))));
}

function renderBar(bar, rows, stretch, showSignature) {
  const flex = stretch ? `${bar.minWidth} 0 ${bar.minWidth}px` : `0 0 ${bar.minWidth}px`;
  return h('div', { class: 'tab-bar', style: `flex:${flex};--pad-l:${bar.padLeft}px;--pad-r:${bar.padRight}px` },
    h('div', { class: 'bar-diagrams' },
      bar.volta && renderVolta(bar.volta),
      bar.chords.map(c => at('diagram-box', { r: c.ratio },
        h('span', { class: 'diagram-name' }, c.chord.name),
        chordDiagram(c.chord)))),
    h('div', { class: 'bar-body' },
      renderStaff(bar, showSignature ? bar.signature : null),
      rows.melody && renderMelody(bar),
      renderLyricLines(rows.lyrics, bar)));
}

function renderLead(rows, signature) {
  return h('div', { class: 'tab-lead' },
    h('div', { class: 'bar-diagrams' }),
    h('div', { class: 'bar-body lead-body' },
      h('div', { class: 'bar-staff' },
        staffLines(),
        h('span', { class: 'tab-clef' }, h('span', {}, 'T'), h('span', {}, 'A'), h('span', {}, 'B')),
        signature && renderSignature(signature)),
      rows.melody && h('div', { class: 'bar-melody' }),
      renderLyricLines(rows.lyrics)));
}

function renderSystem(bars, isLast) {
  const rows = {
    melody: bars.some(b => b.melody.length > 0),
    lyrics: Math.max(0, ...bars.flatMap(b => b.lyricLines.map((line, k) => (line.length ? k + 1 : 0)))),
  };
  const [first] = bars;
  const classes = ['tab-system', bars.some(b => b.arcs.length > 0) && 'has-arcs', bars.some(b => b.volta) && 'has-volta'];
  const tallest = Math.max(0, ...bars.flatMap(b => b.chords.map(c => diagramHeight(c.chord))));
  const diagramsHeight = tallest ? tallest + DIAGRAM_NAME_PX + DIAGRAM_GAP_PX : 0;
  return h('div', { class: classes.filter(Boolean).join(' '), style: `--diagrams-h:${diagramsHeight}px` },
    renderLead(rows, first.showSignature ? first.signature : null),
    bars.map((bar, i) => renderBar(bar, rows, !isLast, i > 0 && bar.showSignature)));
}

function renderHead(tab) {
  const standard = tab.tuning.join() === DEFAULT_TUNING.join();
  const lines = [
    tab.key && `1 = ${tab.key}`,
    tab.capo && `Capo: ${tab.capo}`,
    tab.bpm && `BPM: ${tab.bpm}`,
    !standard && `Tuning: ${[...tab.tuning].reverse().join(' ')}`,
  ].filter(Boolean);
  return h('header', { class: 'tab-head' },
    h('h1', { class: 'tab-title' }, tab.title || 'Untitled'),
    tab.artist && h('p', { class: 'tab-artist' }, tab.artist),
    lines.length > 0 && h('div', { class: 'tab-meta' }, lines.map(text => h('div', {}, text))));
}

export function mountTab(container, tab) {
  const root = h('article', { class: 'tab', style: `--row:${ROW_PX}px;--stem-h:${STEM_H_PX}px` });
  container.append(root);

  const bars = arrangeTab(tab);
  bars.forEach((bar, i) => {
    bar.showSignature = i === 0 || bars[i - 1].signature.join() !== bar.signature.join();
  });

  const width = () => root.clientWidth || FALLBACK_WIDTH;
  const rowsFor = () => {
    bars.forEach(measureBar);
    return breakRows(bars, width());
  };

  let drawnKey = '';
  function draw() {
    const rows = rowsFor();
    drawnKey = rows.map(r => r.length).join();
    root.replaceChildren(renderHead(tab), ...rows.map((row, i) => renderSystem(row, i === rows.length - 1)));
  }

  new ResizeObserver(() => {
    if (rowsFor().map(r => r.length).join() !== drawnKey) draw();
  }).observe(root);
  draw();
  document.fonts?.ready.then(draw);
}
