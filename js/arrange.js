import { layoutPart } from './layout.js';

function buildEntry(tab, part) {
  const signature = part.timeSignature || tab.timeSignature;
  const { bars, beats } = layoutPart(tab, part);
  return {
    prints: bars.map(({ lyrics, ...bar }) => JSON.stringify([bar, signature])),
    lyrics: bars.map(bar => bar.lyrics),
    bars: bars.map(({ lyrics, ...bar }) => ({ ...bar, beats, signature, lyricLines: [lyrics] })),
  };
}

function commonPrefix(a, b) {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

function addLyricLine(target, source, count) {
  const own = JSON.stringify(target.lyrics.slice(0, count));
  const other = JSON.stringify(source.lyrics.slice(0, count));
  if (own === other || target.added?.has(other)) return;
  (target.added ??= new Set()).add(other);
  for (let i = 0; i < count; i++) target.bars[i].lyricLines.push(source.lyrics[i]);
}

function splitEndings(first, second) {
  const shared = commonPrefix(first.prints, second.prints);
  const longest = Math.max(first.bars.length, second.bars.length);
  if (shared === 0 || shared * 2 < longest || shared === first.bars.length || shared === second.bars.length) return null;

  addLyricLine(first, second, shared);
  const head = first.bars.slice(0, shared);
  const tailOne = first.bars.slice(shared);
  const tailTwo = second.bars.slice(shared);
  head[0].repeatStart = true;
  tailOne.forEach((bar, i) => { bar.volta = { number: 1, first: i === 0, last: i === tailOne.length - 1 }; });
  tailOne[tailOne.length - 1].repeatEnd = true;
  tailTwo.forEach((bar, i) => { bar.volta = { number: 2, first: i === 0 }; });
  return [...head, ...tailOne, ...tailTwo];
}

export function arrangeTab(tab) {
  const entries = tab.parts.map(part => buildEntry(tab, part));
  const arranged = [];

  let i = 0;
  while (i < entries.length) {
    const entry = entries[i++];
    if (!entry.bars.length) continue;

    let repeated = false;
    while (i < entries.length && entries[i].bars.length === entry.bars.length
      && commonPrefix(entry.prints, entries[i].prints) === entry.bars.length) {
      addLyricLine(entry, entries[i], entry.bars.length);
      repeated = true;
      i++;
    }
    if (repeated) {
      entry.bars[0].repeatStart = true;
      entry.bars[entry.bars.length - 1].repeatEnd = true;
      arranged.push(...entry.bars);
      continue;
    }

    const endings = i < entries.length ? splitEndings(entry, entries[i]) : null;
    if (endings) i++;
    arranged.push(...(endings ?? entry.bars));
  }
  return arranged;
}
