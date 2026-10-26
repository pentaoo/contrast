import test from 'node:test';
import assert from 'node:assert/strict';
import { circleGap, growSquare, introFrame, squareGap, storyFrame, storyScroll, storyScrollParts, ZOOM_FROM } from '../dist/geometry-story.js';

const views = [
  { halfW: 8.5, halfH: 19, dotR: .2, start: { x: 1.4, y: -6 } }, // телефон
  { halfW: 16.4, halfH: 10.2, dotR: .17, start: { x: 2.1, y: -3.3 } }, // широкий экран
];
const steps = Array.from({ length: 4001 }, (_, index) => index / 4000);

test('progress outside 0…1 gives the edge frames', () => {
  const view = views[0];
  assert.deepEqual(storyFrame(-2, view), storyFrame(0, view));
  assert.deepEqual(storyFrame(7, view), storyFrame(1, view));
  assert.deepEqual(storyFrame(Number.NaN, view), storyFrame(0, view));
});

test('the same progress always draws the same frame', () => {
  const view = views[1];
  const forward = steps.map((p) => storyFrame(p, view));
  const backward = [...steps].reverse().map((p) => storyFrame(p, view)).reverse();
  assert.deepEqual(backward, forward);
});

test('all coordinates stay finite', () => {
  for (const view of views) for (const p of steps) {
    const { circle, big, small, dots, copy } = storyFrame(p, view);
    for (const value of [circle.x, circle.y, circle.r, big.x, big.y, small.x, small.y, dots, ...copy]) {
      assert.ok(Number.isFinite(value), `p=${p}`);
    }
  }
});

test('the field is grey at first and only the colour changes on the difference', () => {
  const view = views[0];
  const field = storyFrame(.05, view);
  const difference = storyFrame(.14, view);
  assert.equal(field.circle.tint, 0);
  assert.equal(difference.circle.tint, 1);
  // The dot only twitches in place before it runs.
  assert.equal(difference.circle.r, field.circle.r);
  assert.ok(Math.hypot(difference.circle.x - view.start.x, difference.circle.y - view.start.y) < .3);
  assert.ok(Math.hypot(field.circle.x - view.start.x, field.circle.y - view.start.y) < .1);
  assert.equal(difference.dots, 1);
  assert.equal(difference.big.visible || difference.small.visible, false);
});

test('figures may touch but never pass through each other', () => {
  for (const view of views) for (const p of steps) {
    const { circle, big, small } = storyFrame(p, view);
    if (big.visible) assert.ok(circleGap(circle, big) >= 0, `circle and big square at p=${p}`);
    if (small.visible) {
      assert.ok(circleGap(circle, small) >= 0, `circle and small square at p=${p}`);
      assert.ok(squareGap(big, small) >= 0, `squares at p=${p}`);
    }
  }
});

test('the question comes after the circle and the small square have left', () => {
  for (const view of views) {
    const firstText = steps.find((p) => storyFrame(p, view).copy[0] > 0);
    const end = storyFrame(firstText, view);
    assert.ok(end.circle.x + end.circle.r < -view.halfW, 'circle is off screen');
    assert.ok(end.small.x + end.small.size / 2 < -view.halfW, 'small square is off screen');
    assert.ok(Math.abs(storyFrame(1, view).big.x) < view.halfW, 'big square stays in view');
  }
});

test('after the story the big square grows until it covers the screen', () => {
  for (const view of [{ ...views[0], centerY: 1.4 }, { ...views[1], centerY: .6 }]) {
    const { big } = storyFrame(1, view);
    assert.deepEqual(growSquare(big, 0, view), big);
    const full = growSquare(big, 1, view);
    const half = full.size / 2;
    assert.ok(full.x - half <= -view.halfW && full.x + half >= view.halfW, 'covers the width');
    assert.ok(full.y - half <= view.centerY - view.halfH && full.y + half >= view.centerY + view.halfH, 'covers the height');
    let previous = big.size;
    for (let grow = 0; grow <= 1; grow += .05) {
      const { size } = growSquare(big, grow, view);
      assert.ok(size >= previous - 1e-9, 'never shrinks while scrolling down');
      previous = size;
    }
  }
});

test('the flight starts far and small and lands exactly on the field', () => {
  const start = introFrame(0);
  assert.ok(Math.abs(start.zoom - ZOOM_FROM) < 1e-9);
  assert.ok(start.pan > 3);
  assert.deepEqual(introFrame(1), { zoom: 1, pan: 0 });
  assert.deepEqual(introFrame(5), introFrame(1));
  let zoom = 0;
  let pan = Infinity;
  for (let t = 0; t <= 1; t += .01) {
    const frame = introFrame(t);
    assert.ok(frame.zoom >= zoom - 1e-9 && frame.pan <= pan + 1e-9, `t=${t}`);
    ({ zoom, pan } = frame);
  }
});

test('the dot sits still at the start of the story and the run starts smoothly', () => {
  for (const view of views) {
    const still = storyFrame(0, view).circle;
    assert.deepEqual([still.x, still.y], [view.start.x, view.start.y]);
    const before = storyFrame(.1699, view).circle;
    const after = storyFrame(.1701, view).circle;
    assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < .05);
  }
});

test('the scroll drives the flight, then the story, then the growing square', () => {
  assert.deepEqual(storyScroll(0), { intro: 0, progress: 0, grow: 0 });
  const flying = storyScroll(storyScrollParts.intro[1] / 2);
  assert.ok(flying.intro > 0 && flying.intro < 1 && flying.progress === 0);
  const story = storyScroll((storyScrollParts.story[0] + storyScrollParts.story[1]) / 2);
  assert.equal(story.intro, 1);
  assert.ok(story.progress > 0 && story.progress < 1 && story.grow === 0);
  assert.deepEqual(storyScroll(1), { intro: 1, progress: 1, grow: 1 });
  assert.deepEqual(storyScroll(NaN), storyScroll(0));
});
