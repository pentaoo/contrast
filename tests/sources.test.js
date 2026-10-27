import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceFrame, sourceReadingProgress } from '../dist/sources.js';

test('each source passes upward through the keyboard reading position', () => {
  for (const count of [1, 7]) for (let index = 0; index < count; index++) {
    const progress = sourceReadingProgress(index, count);
    const read = sourceFrame(progress, index, count);
    assert.ok(Math.abs(read.y) < 1e-9);
    assert.equal(read.opacity, 1);
    const before = sourceFrame(progress - .02, index, count);
    const after = sourceFrame(progress + .02, index, count);
    assert.ok(before.y > read.y && after.y < read.y);
    assert.ok(after.scale < before.scale);
  }
});

test('scrolling deeper sends sources upward; reversing restores the same pose', () => {
  for (let index = 0; index < 7; index++) {
    let previous = Infinity;
    const frames = [];
    for (let step = 0; step <= 1000; step++) {
      const frame = sourceFrame(step / 1000, index, 7);
      assert.ok(Object.values(frame).every(Number.isFinite));
      assert.ok(frame.y <= previous + 1e-9);
      assert.ok(frame.opacity >= 0 && frame.opacity <= 1);
      assert.ok(frame.scale > 0 && frame.scale <= 1.08);
      previous = frame.y;
      frames.push(frame);
    }
    for (let step = 1000; step >= 0; step--) {
      assert.deepEqual(sourceFrame(step / 1000, index, 7), frames[step]);
    }
  }
});

test('sources enter below, overlap with different drifts and spins, then leave above', () => {
  let overlap = false;
  for (let step = 0; step <= 2000; step++) {
    const frames = Array.from({ length: 7 }, (_, index) => sourceFrame(step / 2000, index, 7));
    if (frames.filter(({ opacity }) => opacity > .75).length > 1) overlap = true;
  }
  assert.ok(overlap);
  const middle = Array.from({ length: 7 }, (_, index) => sourceFrame(sourceReadingProgress(index, 7), index, 7));
  assert.equal(new Set(middle.map(({ rotation }) => rotation)).size, 7);
  assert.ok(middle.some(({ x }) => x < 0) && middle.some(({ x }) => x > 0));
  for (let index = 0; index < 7; index++) {
    assert.ok(sourceFrame(0, index, 7).y > 50);
    assert.ok(sourceFrame(1, index, 7).y < -50);
    assert.equal(sourceFrame(0, index, 7).opacity, 0);
    assert.equal(sourceFrame(1, index, 7).opacity, 0);
    assert.deepEqual(sourceFrame(NaN, index, 7), sourceFrame(0, index, 7));
    assert.deepEqual(sourceFrame(2, index, 7), sourceFrame(1, index, 7));
  }
});
