import test from 'node:test';
import assert from 'node:assert/strict';
import { seaAt, seaTiming } from '../dist/stranger.js';

test('the Triton peeks out of the shore, calls, and his sea covers the screen', () => {
  const start = seaAt(0);
  assert.equal(start.level, seaTiming.shore);
  assert.equal(start.first, 1);
  assert.equal(start.second, 0);
  assert.equal(start.lift, 0);
  // At the call the second text is read and the sea has not moved yet.
  const call = seaAt(seaTiming.call);
  assert.equal(call.first, 0);
  assert.equal(call.second, 1);
  assert.equal(call.level, seaTiming.shore);
  const end = seaAt(1);
  assert.equal(end.level, seaTiming.deep);
  assert.equal(end.second, 0);
  assert.equal(end.third, 1);
  assert.equal(end.sink, 1);
});
