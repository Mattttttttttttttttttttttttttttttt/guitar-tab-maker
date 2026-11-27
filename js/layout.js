import { beatsPerBar, resolvePart } from './model.js';

const EPS = 1e-9;
const LINK_LABELS = { hammer: 'H', pull: 'P', slide: 'S' };
const SUFFIXES = { bend: '↑', vibrato: '~' };

const key = (string, at) => `${string}@${at}`;

function splitSpan(from, to) {
  if (from.bar === to.bar) return [{ bar: from.bar, r1: from.ratio, r2: to.ratio }];
  return [
    { bar: from.bar, r1: from.ratio, r2: 1, edge: 'right' },
    { bar: to.bar, r1: 0, r2: to.ratio, edge: 'left' },
  ];
}

function rhythm(quarters) {
  if (quarters >= 1 - EPS) {
    const whole = Math.floor(quarters + EPS);
    return { lines: 0, dot: quarters - whole > 0.25, dashes: whole - 1 };
  }
  if (quarters >= 0.75 - EPS) return { lines: 1, dot: true, dashes: 0 };
  if (quarters >= 0.5 - EPS) return { lines: 1, dot: false, dashes: 0 };
  if (quarters >= 0.375 - EPS) return { lines: 2, dot: true, dashes: 0 };
  if (quarters >= 0.25 - EPS) return { lines: 2, dot: false, dashes: 0 };
  return { lines: 3, dot: false, dashes: 0 };
}

function flagsFor(quarters) {
  if (quarters <= 0.375 + EPS) return 2;
  return quarters <= 0.75 + EPS ? 1 : 0;
}

export function layoutPart(tab, part) {
  const signature = part.timeSignature || tab.timeSignature;
  const beats = beatsPerBar(signature);
  const denominator = signature[1];
  const groupLength = denominator >= 8 ? (beats % 3 === 0 ? 3 : 2) : 1;
  const groupOf = at => Math.floor(at / groupLength + EPS);

  const bars = Array.from({ length: part.bars }, () => ({
    chords: [], marks: [], arcs: [], strums: [],
    stems: [], beams: [], flags: [],
    melody: [], melodyTies: [], dashes: [], underlines: [], lyrics: [],
  }));
  const locate = at => {
    const bar = Math.floor(at / beats + EPS);
    return bar >= 0 && bar < bars.length ? { bar, ratio: (at - bar * beats) / beats } : null;
  };

  const { notes, techniques } = resolvePart(tab, part);

  /* Chord diagrams, only where the chord changes */
  const chords = new Map(tab.chords.map(c => [c.id, c]));
  let previous = null;
  for (const event of [...part.chords].sort((a, b) => a.at - b.at)) {
    const chord = chords.get(event.chord);
    if (!chord || event.chord === previous) continue;
    previous = event.chord;
    const spot = locate(event.at);
    if (spot) bars[spot.bar].chords.push({ ratio: spot.ratio, chord });
  }

  /* Techniques decide which notes must show their fret number */
  const numeric = new Set();
  const suffixes = new Map();
  for (const t of techniques) {
    const isTie = t.type === 'tie';
    if (!isTie) numeric.add(key(t.string, t.at));
    if (SUFFIXES[t.type]) {
      suffixes.set(key(t.string, t.at), SUFFIXES[t.type]);
      continue;
    }
    if (!isTie) numeric.add(key(t.string, t.fromAt));
    const from = locate(t.fromAt);
    const to = locate(t.at);
    if (!from || !to) continue;
    splitSpan(from, to).forEach(({ bar, ...arc }, i) => {
      bars[bar].arcs.push({ ...arc, string: t.string - 1, label: i === 0 ? LINK_LABELS[t.type] ?? '' : '' });
    });
  }

  /* Marks on the staff: x = chord tone, number = explicit fret, circled x = mute */
  const unique = new Map();
  for (const note of notes) {
    const k = key(note.string, note.at);
    const existing = unique.get(k);
    if (!existing || (note.explicit && !existing.explicit)) unique.set(k, note);
  }

  const strumGroups = new Map();
  const plain = [];
  for (const note of unique.values()) {
    if (!note.strum || note.mute) { plain.push(note); continue; }
    const id = `${note.at}@${note.strum}`;
    if (!strumGroups.has(id)) strumGroups.set(id, { at: note.at, dir: note.strum, notes: [] });
    strumGroups.get(id).notes.push(note);
  }
  for (const group of strumGroups.values()) {
    const rows = group.notes.map(n => n.string - 1);
    const from = Math.min(...rows);
    const to = Math.max(...rows);
    const spot = locate(group.at);
    if (to > from) {
      if (spot) bars[spot.bar].strums.push({ ratio: spot.ratio, from, to, dir: group.dir });
    } else {
      plain.push(...group.notes);
    }
  }

  const stemRows = new Map();
  for (const note of plain) {
    const spot = locate(note.at);
    if (!spot) continue;
    const k = key(note.string, note.at);
    let kind = 'x';
    let text = '';
    if (note.mute) {
      kind = 'mute';
    } else if (note.explicit || numeric.has(k)) {
      kind = 'fret';
      text = note.fret == null ? '?' : `${note.fret}${suffixes.get(k) ?? ''}`;
    }
    bars[spot.bar].marks.push({ ratio: spot.ratio, string: note.string - 1, kind, text });
    stemRows.set(note.at, [...(stemRows.get(note.at) ?? []), note.string - 1]);
  }

  /* Rhythm stems and beams from the onsets in each bar */
  const onsets = [...new Set([...unique.values()].map(n => n.at))].sort((a, b) => a - b);
  bars.forEach((bar, b) => {
    const times = onsets.filter(t => locate(t)?.bar === b);
    const barEnd = (b + 1) * beats;
    const items = times.map((t, i) => ({
      t,
      ratio: (t - b * beats) / beats,
      flags: flagsFor(((times[i + 1] ?? barEnd) - t) * 4 / denominator),
    }));
    items.forEach(item => bar.stems.push({
      ratio: item.ratio,
      rows: [...new Set(stemRows.get(item.t) ?? [])].sort((a, b) => a - b),
    }));

    let i = 0;
    while (i < items.length) {
      if (!items[i].flags) { i++; continue; }
      let j = i;
      while (j + 1 < items.length && items[j + 1].flags && groupOf(items[j + 1].t) === groupOf(items[i].t)) j++;

      if (j === i) {
        bar.flags.push({ ratio: items[i].ratio, level: items[i].flags });
      } else {
        bar.beams.push({ r1: items[i].ratio, r2: items[j].ratio, level: 1 });
        let k = i;
        while (k <= j) {
          if (items[k].flags < 2) { k++; continue; }
          let m = k;
          while (m + 1 <= j && items[m + 1].flags >= 2) m++;
          if (m > k) {
            bar.beams.push({ r1: items[k].ratio, r2: items[m].ratio, level: 2 });
          } else if (k < j) {
            bar.beams.push({ r1: items[k].ratio, r2: items[k].ratio + (items[k + 1].ratio - items[k].ratio) * 0.35, level: 2 });
          } else {
            bar.beams.push({ r1: items[k].ratio - (items[k].ratio - items[k - 1].ratio) * 0.35, r2: items[k].ratio, level: 2 });
          }
          k = m + 1;
        }
      }
      i = j + 1;
    }
  });

  /* Jianpu melody row */
  const quarterBeats = denominator / 4;
  const melody = [...(part.melody || [])]
    .sort((a, b) => a.at - b.at)
    .map(m => ({ ...m, spot: locate(m.at), ...rhythm(m.dur * 4 / denominator) }))
    .filter(m => m.spot);

  for (const m of melody) {
    bars[m.spot.bar].melody.push({
      ratio: m.spot.ratio,
      digit: m.degree,
      acc: m.acc || 0,
      octave: m.octave || 0,
      lines: m.lines,
      dot: m.dot && m.dashes === 0,
    });
    for (let k = 1; k <= m.dashes; k++) {
      const spot = locate(m.at + k * quarterBeats);
      if (spot) bars[spot.bar].dashes.push({ ratio: spot.ratio, dot: m.dot && k === m.dashes });
    }
  }

  const ties = [];
  melody.forEach((m, i) => {
    if (!m.tie || !melody[i + 1]) return;
    for (const piece of splitSpan(m.spot, melody[i + 1].spot)) {
      const last = ties[ties.length - 1];
      if (last && last.bar === piece.bar && last.edge !== 'right' && Math.abs(last.r2 - piece.r1) < EPS) last.r2 = piece.r2;
      else ties.push(piece);
    }
  });
  for (const { bar, ...tie } of ties) bars[bar].melodyTies.push(tie);

  const connects = (a, b, level) => Math.abs(a.at + a.dur - b.at) < EPS
    && a.spot.bar === b.spot.bar
    && groupOf(a.at) === groupOf(b.at)
    && a.lines >= level && b.lines >= level;
  for (let level = 1; level <= 3; level++) {
    let i = 0;
    while (i < melody.length) {
      if (melody[i].lines < level) { i++; continue; }
      let j = i;
      while (j + 1 < melody.length && connects(melody[j], melody[j + 1], level)) j++;
      bars[melody[i].spot.bar].underlines.push({ r1: melody[i].spot.ratio, r2: melody[j].spot.ratio, level });
      i = j + 1;
    }
  }

  for (const lyric of part.lyrics) {
    const spot = locate(lyric.at);
    if (spot) bars[spot.bar].lyrics.push({ ratio: spot.ratio, text: lyric.text });
  }

  return { bars, beats };
}
