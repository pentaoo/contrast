import test from 'node:test';
import assert from 'node:assert/strict';
import { createListeningState, finishSample, respondToSample, skipListening } from '../dist/listening.js';

test('a response cannot advance an unheard sample', () => {
  const state = createListeningState();
  assert.equal(respondToSample(state, 'calm'), state);
  assert.equal(state.step, 0);
  assert.equal(state.revealed, false);
});

test('both samples require their own listening and response', () => {
  let state = finishSample(createListeningState());
  state = respondToSample(state, 'tense');
  assert.equal(state.step, 1);
  assert.equal(state.revealed, false);
  assert.deepEqual(state.heard, [true, false]);
  assert.equal(respondToSample(state, 'calm'), state);
  state = respondToSample(finishSample(state), 'calm');
  assert.equal(state.revealed, true);
  assert.deepEqual(state.responses, ['tense', 'calm']);
});

test('uncertainty is a valid impression and no answer is graded', () => {
  let state = respondToSample(finishSample(createListeningState()), 'other');
  state = respondToSample(finishSample(state), 'other');
  assert.equal(state.revealed, true);
  assert.deepEqual(state.responses, ['other', 'other']);
});

test('skip opens the explanation without inventing listening or responses', () => {
  const first = createListeningState();
  const skipped = skipListening(first);
  assert.equal(skipped.revealed, true);
  assert.deepEqual(skipped.heard, [false, false]);
  assert.deepEqual(skipped.responses, [null, null]);
  assert.equal(finishSample(skipped), skipped);
  assert.equal(respondToSample(skipped, 'calm'), skipped);
});

test('restarting creates a fresh experiment and invalid responses do not advance', () => {
  const fresh = createListeningState();
  assert.deepEqual(fresh.responses, [null, null]);
  const heard = finishSample(fresh);
  assert.equal(respondToSample(heard, 'unexpected'), heard);
  assert.deepEqual(fresh.heard, [false, false]);
});
