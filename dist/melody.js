export const secondsPerBeat = .48;
export const expectedNote = 72; // C5
export const mistakenNote = 61; // D-flat4, a minor second above the tonic
export const tonicNote = 60; // C4
export const keyboardRange = [48, 84];

// An original, short major-key phrase. Both performances are identical until
// the final two-note ending: a minor second, or the tonic doubled at the octave.
const chords = [
  [48, 55, 60, 64], [53, 57, 60, 65],
  [48, 55, 60, 64], [55, 59, 62, 67],
  [57, 60, 64, 69], [53, 60, 65, 69],
  [55, 59, 62, 65], [tonicNote, expectedNote]
];
const tune = [
  [0, 76], [.75, 79], [1.5, 76],
  [2, 77], [2.75, 76], [3.5, 74],
  [4, 76], [4.75, 79], [5.5, 72],
  [6, 74], [6.75, 71], [7.5, 67],
  [8, 72], [8.75, 76], [9.5, 79],
  [10, 77], [10.75, 76], [11.5, 72],
  [12, 74], [12.75, 71], [13.5, 74]
];

export function createMelody(version = 'mistake') {
  if (!['mistake', 'correct'].includes(version)) throw new Error('Unknown performance');
  const events = chords.map((notes, index) => ({
    at: index * 2 * secondsPerBeat,
    duration: (index === 7 ? 5.4 : 1.65) * secondsPerBeat,
    notes: notes.map((note) => index === 7 && note === expectedNote && version === 'mistake' ? mistakenNote : note),
    velocity: index === 7 ? .74 : .56,
    final: index === 7
  }));
  tune.forEach(([beat, note]) => events.push({
    at: beat * secondsPerBeat,
    // Leave a short silence before the final dyad; no other voices ring into it.
    duration: Math.min(.67 * secondsPerBeat, 14 * secondsPerBeat - beat * secondsPerBeat - .06),
    notes: [note], velocity: .8, final: false
  }));
  events.sort((first, second) => first.at - second.at);
  return {
    version, events,
    duration: Math.max(...events.map((event) => event.at + event.duration)) + .12
  };
}

export function finalNotes(version) {
  return [tonicNote, version === 'mistake' ? mistakenNote : expectedNote];
}

export function noteFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}
