import test from 'node:test';
import assert from 'node:assert/strict';
import { danceAt, danceTiming } from '../dist/ball.js';
import { createMelody, tonicNote, mistakenNote, expectedNote } from '../dist/melody.js';

const finalAt = (melody) => melody.events.find((event) => event.final).at;

test('the dancers run in, then follow the tune and the top of the chords', () => {
  const melody = createMelody('mistake');
  assert.equal(danceAt(0, melody).mode, 'enter');
  const pose = danceAt(danceTiming.enter + .01, melody);
  assert.equal(pose.mode, 'dance');
  assert.equal(pose.circle, 76);
  assert.equal(pose.square, 64);
});

test('the semitone ending puts them side by side, then they run off', () => {
  const melody = createMelody('mistake');
  const crowd = danceAt(finalAt(melody) + .1, melody);
  assert.equal(crowd.mode, 'crowd');
  assert.deepEqual([crowd.circle, crowd.square], [tonicNote, mistakenNote]);
  const flee = danceAt(finalAt(melody) + danceTiming.crowd + danceTiming.flee + .01, melody);
  assert.equal(flee.mode, 'flee');
  assert.equal(flee.progress, 1);
  assert.ok(finalAt(melody) + danceTiming.crowd + danceTiming.flee < melody.duration);
});

test('the octave ending brings both to the shared frequency', () => {
  const melody = createMelody('correct');
  const pose = danceAt(finalAt(melody) + danceTiming.merge + .01, melody);
  assert.equal(pose.mode, 'merge');
  assert.equal(pose.progress, 1);
  assert.equal(pose.circle, expectedNote);
  assert.equal(pose.square, expectedNote);
  assert.equal(expectedNote - tonicNote, 12);
});
