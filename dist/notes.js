// Names for free play: Russian solfège, one spelling per pitch class.
const names = ['до', 'ре-бемоль', 'ре', 'ми-бемоль', 'ми', 'фа', 'фа-диез', 'соль', 'ля-бемоль', 'ля', 'си-бемоль', 'си'];
const intervals = [
  'унисон', 'малая секунда', 'большая секунда', 'малая терция', 'большая терция', 'чистая кварта',
  'тритон', 'чистая квинта', 'малая секста', 'большая секста', 'малая септима', 'большая септима', 'октава',
  'малая нона', 'большая нона', 'малая децима', 'большая децима'
];

// Physical key positions (event.code), so the mapping works in any layout.
// A–K is one white-key octave from C4; the row above holds the black keys.
export const computerKeys = {
  KeyA: 60, KeyW: 61, KeyS: 62, KeyE: 63, KeyD: 64, KeyF: 65, KeyT: 66, KeyG: 67,
  KeyY: 68, KeyH: 69, KeyU: 70, KeyJ: 71, KeyK: 72, KeyO: 73, KeyL: 74, KeyP: 75, Semicolon: 76
};

export function noteName(midi) {
  return names[((midi % 12) + 12) % 12];
}

export function intervalName(first, second) {
  const distance = Math.abs(second - first);
  if (distance < intervals.length) return intervals[distance];
  if (distance % 12 === 0) return `${distance / 12} октавы`;
  return `${intervals[distance % 12]} через ${Math.floor(distance / 12) > 1 ? `${Math.floor(distance / 12)} октавы` : 'октаву'}`;
}

// What the caption says about the keys currently held.
export function describeChord(notes) {
  const sorted = [...new Set(notes)].sort((a, b) => a - b);
  const capital = (text) => text && text[0].toUpperCase() + text.slice(1);
  const label = capital(sorted.map(noteName).join(' + '));
  if (sorted.length !== 2) return label;
  return `${label}. ${capital(intervalName(sorted[0], sorted[1]))}`;
}
