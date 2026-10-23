import test from 'node:test';
import assert from 'node:assert/strict';
import { computerKeys, describeChord, intervalName, noteName } from '../dist/notes.js';
import { keyboardRange, mistakenNote, tonicNote, expectedNote } from '../dist/melody.js';

test('note names match the essay spelling', () => {
  assert.equal(noteName(tonicNote), 'до');
  assert.equal(noteName(mistakenNote), 'ре-бемоль');
  assert.equal(noteName(66), 'фа-диез');
});

test('the caption names both endings and the tritone', () => {
  assert.equal(describeChord([mistakenNote, tonicNote]), 'До + ре-бемоль. Малая секунда');
  assert.equal(describeChord([tonicNote, expectedNote]), 'До + до. Октава');
  assert.equal(intervalName(60, 66), 'тритон');
  assert.equal(intervalName(48, 84), '3 октавы');
  assert.equal(describeChord([]), '');
});

test('every computer key lands on the drawn keyboard', () => {
  for (const note of Object.values(computerKeys)) {
    assert.ok(note >= keyboardRange[0] && note <= keyboardRange[1]);
  }
  assert.equal(computerKeys.KeyA, tonicNote);
  assert.equal(computerKeys.KeyK, expectedNote);
});
