import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, dueEvents } from '../dist/listening.js';
import { createMelody, expectedNote, mistakenNote, tonicNote, keyboardRange, noteFrequency } from '../dist/melody.js';

test('the playhead moves at real tempo and never runs past its target', () => {
  assert.deepEqual(advance(0, 4, .016), { playhead: .016, jumped: false });
  assert.deepEqual(advance(3.99, 4, .1), { playhead: 4, jumped: false });
  assert.deepEqual(advance(4, 4, .1), { playhead: 4, jumped: false });
  assert.deepEqual(advance(4, 1, .1), { playhead: 1, jumped: true });
});

test('every note is queued exactly once as the playhead moves on', () => {
  const melody = createMelody('mistake');
  let queued = 0;
  for (let from = 0; from < melody.duration; from += .07) queued += dueEvents(melody.events, from, from + .07).length;
  assert.equal(queued, melody.events.length);
});

test('both performances share the same phrase until exactly one final note changes', () => {
  const mistake = createMelody('mistake');
  const correct = createMelody('correct');
  assert.equal(mistake.duration, correct.duration);
  const differences = [];
  mistake.events.forEach((event, index) => {
    const other = correct.events[index];
    assert.deepEqual({ ...event, notes: [] }, { ...other, notes: [] });
    event.notes.forEach((note, noteIndex) => {
      if (note !== other.notes[noteIndex]) differences.push({ final: event.final, wrong: note, right: other.notes[noteIndex] });
    });
  });
  assert.deepEqual(differences, [{ final: true, wrong: mistakenNote, right: expectedNote }]);
  assert.equal(mistakenNote - tonicNote, 1);
  assert.equal(noteFrequency(expectedNote) / noteFrequency(tonicNote), 2);
});

test('only two notes sound throughout the final hold, with no previous notes ringing into it', () => {
  for (const version of ['mistake', 'correct']) {
    const { events } = createMelody(version);
    const ending = events.find((event) => event.final);
    assert.deepEqual(ending.notes, [tonicNote, version === 'mistake' ? mistakenNote : expectedNote]);
    assert.ok(ending.duration > 2.5);
    for (const event of events.filter((event) => !event.final)) {
      assert.ok(event.at + event.duration + .02 < ending.at, 'oscillator release must end before the dyad starts');
    }
  }
});

test('every audible note is represented on the piano and completion follows the full tail', () => {
  for (const version of ['mistake', 'correct']) {
    const melody = createMelody(version);
    let previous = -1;
    for (const event of melody.events) {
      assert.ok(event.at >= previous);
      previous = event.at;
      assert.ok(event.duration > 0);
      assert.ok(event.at + event.duration < melody.duration);
      assert.ok(event.notes.every((note) => note >= keyboardRange[0] && note <= keyboardRange[1]));
    }
    assert.equal(melody.events.filter((event) => event.final).length, 1);
    assert.ok(melody.duration > 8 && melody.duration < 10);
  }
});
