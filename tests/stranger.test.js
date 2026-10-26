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

test('then the plug flies off: the dot slips into the drain, the square wedges in the hole', () => {
  const read = seaAt(seaTiming.textC[1]);
  assert.equal(read.third, 1);
  assert.equal(read.open, 0);
  assert.equal(read.slipX, 0);
  // The dot is already through while the square is still on its way.
  const dot = seaAt(seaTiming.slipY[1]);
  assert.equal(dot.open, 1);
  assert.equal(dot.slipY, 1);
  assert.ok(dot.stuckY < 1);
  const end = seaAt(1);
  assert.equal(end.stuckX, 1);
  assert.equal(end.stuckY, 1);
  assert.ok(seaTiming.slipY[0] >= seaTiming.slipX[0] && seaTiming.stuckY[1] <= 1);
});
