import test from 'node:test';
import assert from 'node:assert/strict';
import { originFrame, morphPath, OUTLINES, ORIGIN_TEXTS } from '../dist/origin.js';

test('the prologue opens on an empty screen, then «Родилась она» rises from below', () => {
  const empty = originFrame(0);
  assert.ok(empty.texts.every((text) => text.opacity === 0));
  assert.equal(empty.square, 0);
  assert.equal(empty.pattern, 0);
  const title = originFrame(ORIGIN_TEXTS[0][1]);
  assert.equal(title.texts[0].opacity, 1);
  assert.equal(title.texts[0].y, 0);
  assert.ok(originFrame((ORIGIN_TEXTS[0][0] + ORIGIN_TEXTS[0][1]) / 2).texts[0].y > 0);
});

test('each line rises, holds and flies up; only one line is fully shown at a time', () => {
  ORIGIN_TEXTS.slice(0, -1).forEach(([, hold, leave], index) => {
    const after = originFrame(leave + .05).texts[index];
    assert.equal(after.opacity, 0);
    assert.ok(after.y < 0);
    assert.equal(originFrame(hold).texts[index].opacity, 1);
  });
  for (let p = 0; p <= 1; p += .005) {
    assert.ok(originFrame(p).texts.filter((text) => text.opacity > .99).length <= 1, `p=${p}`);
  }
});

test('square → forms → flight → pattern → dots, in that order, and ends on the field', () => {
  const end = originFrame(1);
  assert.deepEqual([end.square, end.split, end.fly, end.pattern, end.dots], [1, 1, 1, 1, 1]);
  assert.equal(end.texts.at(-1).opacity, 1);
  let previous = originFrame(0);
  for (let p = 0; p <= 1; p += .01) {
    const frame = originFrame(p);
    ['square', 'split', 'fly', 'pattern', 'dots'].forEach((key) => assert.ok(frame[key] >= previous[key]));
    previous = frame;
  }
  assert.deepEqual(originFrame(NaN), originFrame(0));
});

test('all outlines have the same number of points, so shapes morph smoothly', () => {
  const counts = Object.values(OUTLINES).map((points) => points.length);
  assert.ok(counts.every((count) => count === counts[0]));
  assert.match(morphPath('square', 'circle', .5, 10, 10, 20), /^M[\d.\- L]+Z$/);
});
