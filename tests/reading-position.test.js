import test from 'node:test';
import assert from 'node:assert/strict';
import { mountReadingPosition } from '../dist/reading-position.js';

function reader() {
  const viewport = {
    innerWidth: 360, innerHeight: 640, scrollY: 14440,
    scrollTo({ top, behavior }) { assert.equal(behavior, 'instant'); this.scrollY = top; }
  };
  const regions = [
    { top: 0, height: 640 },
    { top: 640, height: 13120 },
    { top: 13760, height: 640 },
    { top: 14400, height: 640 },
    { top: 21400, height: 7000 }
  ];
  const elements = regions.map((region) => ({ getBoundingClientRect: () => ({ top: region.top - viewport.scrollY, height: region.height }) }));
  const root = { querySelectorAll: () => elements };
  const position = mountReadingPosition({ viewport, root });
  return { viewport, regions, position };
}

test('a viewport shrink restores the same paragraph after the page collapses and scroll is clamped', () => {
  const { viewport, regions, position } = reader();
  position.capture();
  viewport.innerHeight = 560;
  viewport.scrollY = 9434;
  regions[3].top = 3675;
  regions[3].height = 560;
  // A resize-generated scroll event must not overwrite the original paragraph.
  position.capture();
  assert.equal(position.restore(), true);
  assert.equal(viewport.scrollY, 3710);
  assert.equal(position.viewportChanged(), false);
});

test('growing the viewport restores the position in the same paragraph in both directions', () => {
  const { viewport, regions, position } = reader();
  position.capture();
  viewport.innerHeight = 560;
  regions[3].top = 3675;
  regions[3].height = 560;
  position.restore();
  viewport.innerHeight = 640;
  regions[3].top = 14400;
  regions[3].height = 640;
  position.restore();
  assert.equal(viewport.scrollY, 14440);
});

test('rotation preserves reading progress when width, height and paragraph wrapping change', () => {
  const { viewport, regions, position } = reader();
  position.capture();
  viewport.innerWidth = 844;
  viewport.innerHeight = 390;
  regions[3].top = 2300;
  regions[3].height = 420;
  position.restore();
  assert.equal(viewport.scrollY, 2326.25);
});

test('normal scrolling updates the saved paragraph and a resize restores the latest position', () => {
  const { viewport, regions, position } = reader();
  position.capture();
  viewport.scrollY = 14560;
  position.capture();
  viewport.innerHeight = 560;
  regions[3].top = 3675;
  regions[3].height = 560;
  position.restore();
  assert.equal(viewport.scrollY, 3815);
});

test('ordinary layout checks do not move the reader without a viewport change', () => {
  const { viewport, position } = reader();
  assert.equal(position.restore(), false);
  position.capture();
  viewport.scrollY += 100;
  assert.equal(position.restore(), false);
  assert.equal(viewport.scrollY, 14540);
});
