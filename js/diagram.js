import { svg } from './ui/dom.js';

const CELL_X = 8;
const CELL_Y = 11;
const SIDE = 12;
const TOP = 7;
const BOTTOM = 3;
const SYMBOL_Y = 3.5;
const MIN_ROWS = 3;

function geometry(chord) {
  const frets = [...chord.frets].reverse();
  const pressed = frets.filter(f => f > 0);
  const lowest = pressed.length ? Math.min(...pressed) : 1;
  const highest = pressed.length ? Math.max(...pressed) : 1;
  const base = highest <= MIN_ROWS ? 1 : lowest;
  const rows = Math.max(MIN_ROWS, highest - base + 1);
  return { frets, base, rows };
}

export function diagramHeight(chord) {
  return TOP + geometry(chord).rows * CELL_Y + BOTTOM;
}

export function chordDiagram(chord) {
  const { frets, base, rows } = geometry(chord);
  const right = SIDE + CELL_X * 5;
  const bottom = TOP + rows * CELL_Y;
  const width = right + SIDE;
  const height = bottom + BOTTOM;

  const parts = [];
  for (let r = 0; r <= rows; r++) {
    const y = TOP + r * CELL_Y;
    parts.push(`<line x1="${SIDE}" y1="${y}" x2="${right}" y2="${y}" stroke-width="${r === 0 && base === 1 ? 2 : 1}"/>`);
  }
  for (let i = 0; i < 6; i++) {
    const x = SIDE + i * CELL_X;
    parts.push(`<line x1="${x}" y1="${TOP}" x2="${x}" y2="${bottom}"/>`);
  }
  frets.forEach((fret, i) => {
    const x = SIDE + i * CELL_X;
    if (fret == null) {
      parts.push(`<path d="M${x - 2.4} ${SYMBOL_Y - 2.4}l4.8 4.8M${x + 2.4} ${SYMBOL_Y - 2.4}l-4.8 4.8"/>`);
    } else if (fret === 0) {
      parts.push(`<circle cx="${x}" cy="${SYMBOL_Y}" r="2.5"/>`);
    } else {
      const y = TOP + (fret - base + 0.5) * CELL_Y;
      parts.push(`<circle cx="${x}" cy="${y}" r="3.4" fill="currentColor" stroke="none"/>`);
    }
  });
  if (base > 1) {
    parts.push(`<text x="${SIDE - 4}" y="${TOP + CELL_Y / 2 + 3}" text-anchor="end" font-size="7" fill="currentColor" stroke="none">${base}</text>`);
  }

  return svg(`<svg class="diagram" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">${parts.join('')}</svg>`);
}
