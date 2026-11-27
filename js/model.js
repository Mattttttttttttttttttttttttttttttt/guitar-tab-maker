export const STRINGS = [1, 2, 3, 4, 5, 6];
export const PART_KINDS = ['intro', 'verse', 'pre-chorus', 'chorus', 'bridge', 'interlude', 'outro'];
export const DEFAULT_TUNING = ['E', 'B', 'G', 'D', 'A', 'E'];

const EPS = 1e-9;

export const clone = value => structuredClone(value);

export function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ── Defaults ── */

const DEFAULT_CHORDS = [
  { id: 'chord-c', name: 'C', frets: [0, 1, 0, 2, 3, null], root: 5 },
  { id: 'chord-g', name: 'G', frets: [3, 0, 0, 0, 2, 3], root: 6 },
  { id: 'chord-am', name: 'Am', frets: [0, 1, 2, 2, 0, null], root: 5 },
  { id: 'chord-f', name: 'F', frets: [1, 1, 2, 3, 3, 1], root: 6 },
];

function defaultBasics() {
  const events = [{ at: 0, dur: 0.5, lane: 0, kind: 'pluck' }];
  for (let i = 0; i < 8; i++) {
    events.push({ at: i * 0.5, dur: 0.5, lane: i % 2 === 0 ? 1 : 2, kind: 'pluck' });
  }
  return [{
    id: 'basic-bp',
    name: 'Bp',
    params: ['x', 'y'],
    length: 4,
    lanes: [{ of: ['R'] }, { of: ['$x'] }, { of: ['$y'] }],
    events,
  }];
}

export function defaultLibrary() {
  return { v: 1, chords: clone(DEFAULT_CHORDS), progressions: [], basics: defaultBasics() };
}

export function emptyTab(library) {
  const lib = clone(library);
  return {
    v: 1,
    title: '',
    artist: '',
    tuning: [...DEFAULT_TUNING],
    timeSignature: [4, 4],
    capo: '',
    key: '',
    chords: lib.chords,
    progressions: lib.progressions,
    basics: lib.basics,
    parts: [],
  };
}

/* ── Metadata helpers ── */

export function isValidCapo(text) {
  const value = text.trim();
  if (!value) return true;
  return value.split(',').every(item => {
    const part = item.trim();
    if (/^\d{1,2}$/.test(part)) return true;
    const range = part.match(/^(\d{1,2})-(\d{1,2})$/);
    return !!range && Number(range[1]) <= Number(range[2]);
  });
}

export const beatsPerBar = timeSignature => timeSignature[0];

export function partLength(tab, part) {
  return part.bars * beatsPerBar(part.timeSignature || tab.timeSignature);
}

export function partLabel(part) {
  const kind = part.kind[0].toUpperCase() + part.kind.slice(1);
  return part.number ? `${kind} ${part.number}` : kind;
}

export function isPlayed(chord, string) {
  return chord.frets[string - 1] != null;
}

export function chordAt(part, beat) {
  let found = null;
  for (const event of part.chords) {
    if (event.at <= beat + EPS && (!found || event.at >= found.at)) found = event;
  }
  return found;
}

/* ── Basic expansion ── */

function resolveAtom(atom, chord, bindings) {
  if (typeof atom === 'string' && atom.startsWith('$')) {
    return (bindings[atom.slice(1)] || []).flatMap(inner => resolveAtom(inner, chord, {}));
  }
  return atom === 'R' ? [chord.root] : [atom];
}

function resolveLane(selector, chord, bindings) {
  if (selector.of) {
    return [...new Set(selector.of.flatMap(atom => resolveAtom(atom, chord, bindings)))];
  }
  const excluded = new Set(selector.except.flatMap(atom => resolveAtom(atom, chord, bindings)));
  return STRINGS.filter(s => !excluded.has(s) && isPlayed(chord, s));
}

function laneRange(from, to) {
  const lanes = [];
  const step = from <= to ? 1 : -1;
  for (let i = from; i !== to + step; i += step) lanes.push(i);
  return lanes;
}

export function expandBasic({ basic, args, chord, start, dur }) {
  const notes = [];
  const warnings = [];
  if (!(basic.length > 0)) return { notes, warnings: [`Basic ${basic.name} has no length.`] };

  const bindings = Object.fromEntries(basic.params.map((p, i) => [p, args[i] || []]));
  basic.params.forEach((p, i) => {
    if (!args[i]?.length) warnings.push(`Basic ${basic.name}: parameter ${p} has no value.`);
  });

  const loops = Math.floor(dur / basic.length + EPS);
  if (Math.abs(dur / basic.length - Math.round(dur / basic.length)) > EPS) {
    warnings.push(`${chord.name} lasts ${dur} beats, which is not a multiple of ${basic.name}'s ${basic.length}.`);
  }

  const unplayed = new Set();
  const play = (strings, at, length, strum) => {
    for (const string of strings) {
      const fret = chord.frets[string - 1];
      if (fret == null) { unplayed.add(string); continue; }
      notes.push({ at, dur: length, string, fret, mute: false, generated: true, ...(strum && { strum }) });
    }
  };

  for (let loop = 0; loop < loops; loop++) {
    const base = start + loop * basic.length;
    for (const event of basic.events) {
      const at = base + event.at;
      if (event.kind === 'pluck') {
        play(resolveLane(basic.lanes[event.lane], chord, bindings), at, event.dur);
      } else {
        const strings = [...new Set(laneRange(event.from, event.to)
          .flatMap(i => resolveLane(basic.lanes[i], chord, bindings)))];
        play(strings, at, event.dur, event.from <= event.to ? 'down' : 'up');
      }
    }
  }

  for (const string of unplayed) {
    warnings.push(`Basic ${basic.name}: string ${string} is not played in ${chord.name}.`);
  }
  for (const event of basic.events) {
    if (event.kind === 'strum' && event.from === event.to) {
      warnings.push(`Basic ${basic.name}: a strum starts and ends on the same lane.`);
      break;
    }
  }
  return { notes, warnings };
}

/* ── Part resolution ── */

const byTime = (a, b) => a.at - b.at || a.string - b.string;

function checkTechnique(technique, notes) {
  const target = notes.find(n => !n.mute && n.string === technique.string && Math.abs(n.at - technique.at) < EPS);
  if (!target) return { message: `No note on string ${technique.string} for this ${technique.type}.` };
  if (!['hammer', 'pull', 'slide', 'tie'].includes(technique.type)) return { resolved: { ...technique } };

  const previous = notes
    .filter(n => !n.mute && n.fret != null && n.string === technique.string && n.at < technique.at - EPS)
    .sort(byTime)
    .pop();
  if (!previous) return { message: `A ${technique.type} needs a previous note on string ${technique.string}.` };
  if (target.fret == null) return { message: `A ${technique.type} needs a fretted note on string ${technique.string}.` };

  const from = previous.fret;
  const to = target.fret;
  const valid = technique.type === 'hammer' ? from < to
    : technique.type === 'pull' ? from > to
    : technique.type === 'slide' ? from !== to
    : from === to;
  if (!valid) return { message: `${technique.type[0].toUpperCase() + technique.type.slice(1)} from fret ${from} to ${to} is not possible.` };
  return { resolved: { ...technique, from, to, fromAt: previous.at } };
}

export function resolvePart(tab, part) {
  const chords = new Map(tab.chords.map(c => [c.id, c]));
  const basics = new Map(tab.basics.map(b => [b.id, b]));
  const notes = [];
  const warnings = [];
  const warn = (message, at) => warnings.push({ message, partId: part.id, at });

  for (const event of part.chords) {
    const chord = chords.get(event.chord);
    if (!chord) { warn('A chord event refers to a missing chord.', event.at); continue; }
    if (!event.basic) continue;
    const basic = basics.get(event.basic.id);
    if (!basic) { warn(`${chord.name} refers to a missing basic.`, event.at); continue; }
    const result = expandBasic({ basic, args: event.basic.args, chord, start: event.at, dur: event.dur });
    notes.push(...result.notes);
    result.warnings.forEach(message => warn(message, event.at));
  }

  for (const note of part.notes) {
    const event = chordAt(part, note.at);
    const chord = event && chords.get(event.chord);
    const string = note.string === 'R' ? chord?.root : note.string;
    if (!string) { warn('The root string needs a chord above the note.', note.at); continue; }
    const fret = note.mute ? null : note.fret ?? chord?.frets[string - 1] ?? null;
    if (!note.mute && fret == null) warn(`String ${string} has no fret here.`, note.at);
    notes.push({ at: note.at, dur: note.dur, string, fret, mute: !!note.mute, generated: false, explicit: note.fret != null });
  }
  notes.sort(byTime);

  for (const string of STRINGS) {
    const onString = notes.filter(n => n.string === string);
    for (let i = 1; i < onString.length; i++) {
      const prev = onString[i - 1];
      if (onString[i].at < prev.at + prev.dur - EPS && onString[i].at > prev.at + EPS) {
        warn(`Notes overlap on string ${string}.`, onString[i].at);
      }
    }
  }

  const techniques = [];
  for (const technique of part.techniques) {
    const { message, resolved } = checkTechnique(technique, notes);
    if (message) warn(message, technique.at);
    else techniques.push(resolved);
  }
  warnBarCoverage(tab, part, notes, warn);
  return { notes, techniques, warnings };
}

function coveredBeats(spans, start, end) {
  let total = 0;
  let reach = start;
  for (const [from, to] of [...spans].sort((a, b) => a[0] - b[0])) {
    const clippedFrom = Math.max(from, reach, start);
    const clippedTo = Math.min(to, end);
    if (clippedTo > clippedFrom) total += clippedTo - clippedFrom;
    reach = Math.max(reach, clippedTo);
  }
  return total;
}

function warnBarCoverage(tab, part, notes, warn) {
  const perBar = beatsPerBar(part.timeSignature || tab.timeSignature);
  const layers = [
    ['guitar part', notes.map(n => [n.at, n.at + n.dur])],
    ['melody', (part.melody ?? []).map(m => [m.at, m.at + m.dur])],
  ];
  for (const [name, spans] of layers) {
    if (!spans.length) continue;
    for (let bar = 0; bar < part.bars; bar++) {
      const filled = coveredBeats(spans, bar * perBar, (bar + 1) * perBar);
      if (filled < perBar - EPS) {
        warn(`${partLabel(part)}, bar ${bar + 1}: the ${name} fills ${filled} of ${perBar} beats.`, bar * perBar);
      }
    }
  }
}

export function validateTab(tab) {
  const warnings = [];
  if (!isValidCapo(tab.capo || '')) warnings.push({ message: 'Capo must look like "0,7" or "1-3".' });
  for (const chord of tab.chords) {
    if (chord.frets.length !== STRINGS.length || !isPlayed(chord, chord.root)) {
      warnings.push({ message: `Chord ${chord.name}: the root must be a played string.`, chordId: chord.id });
    }
  }
  for (const part of tab.parts) warnings.push(...resolvePart(tab, part).warnings);
  return warnings;
}

/* ── Usage lookup, for blocking deletes ── */

export function findUsages(tab, kind, id) {
  const usages = [];
  if (kind === 'chord') {
    for (const p of tab.progressions) {
      if (p.steps.some(s => s.chord === id)) usages.push(`Progression ${p.name}`);
    }
  }
  for (const part of tab.parts) {
    const count = part.chords.filter(e => (kind === 'chord' ? e.chord === id : e.basic?.id === id)).length;
    if (count) usages.push(`${partLabel(part)} (${count})`);
  }
  return usages;
}
