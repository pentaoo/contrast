import test from 'node:test';
import assert from 'node:assert/strict';
import { createListeningState, finishMelody, skipListening } from '../dist/listening.js';
import { createMelody, expectedNote, mistakenNote, tonicNote, keyboardRange, noteFrequency } from '../dist/melody.js';

test('the first performance opens the explanation; the octave follows the reading', () => {
  const state = createListeningState();
  assert.equal(finishMelody(state, 'correct'), state);
  const explained = finishMelody(state, 'mistake');
  assert.equal(explained.phase, 'explanation');
  assert.equal(explained.heardCorrect, false);
  const completed = finishMelody(explained, 'correct');
  assert.equal(completed.phase, 'explanation');
  assert.equal(completed.heardCorrect, true);
});

test('reading without audio opens the explanation without inventing a listen', () => {
  const skipped = skipListening(createListeningState());
  assert.equal(skipped.phase, 'explanation');
  assert.equal(skipped.heardMistake, false);
  assert.equal(skipped.heardCorrect, false);
  const skippedComparison = skipListening(finishMelody(createListeningState(), 'mistake'));
  assert.equal(skippedComparison.phase, 'explanation');
  assert.equal(skippedComparison.heardMistake, true);
  assert.equal(skippedComparison.heardCorrect, false);
});

test('replays and stale completion events cannot rewind or complete a different stage', () => {
  let state = finishMelody(createListeningState(), 'mistake');
  assert.equal(finishMelody(state, 'mistake'), state);
  state = finishMelody(state, 'correct');
  assert.equal(finishMelody(state, 'correct'), state);
  assert.equal(finishMelody(state, 'mistake'), state);
  assert.equal(skipListening(state), state);
  assert.equal(finishMelody(state, 'unknown'), state);
});

test('restarting removes both completed performances', () => {
  const completed = finishMelody(finishMelody(createListeningState(), 'mistake'), 'correct');
  assert.equal(completed.phase, 'explanation');
  assert.deepEqual(createListeningState(), { phase: 'intro', heardMistake: false, heardCorrect: false });
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
