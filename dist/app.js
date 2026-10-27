import { mountPianoExperience } from './piano.js?v=mobile-1';
import { mountGeometryStory } from './geometry-story.js?v=narrative-1';
import { mountStranger } from './stranger.js?v=dive-2';
import { mountOrigin } from './origin.js?v=reading-position-1';
import { mountSources } from './sources.js?v=sources-4';
import { mountReadingPosition } from './reading-position.js?v=1';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
root.classList.add('js-enabled');
requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('intro-ready')));

// Each scene enters as a unit; changes inside it follow its own sequence.
if ('IntersectionObserver' in window) {
  const sceneObserver = new IntersectionObserver((entries) => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      target.classList.add('is-entered');
      sceneObserver.unobserve(target);
    });
  }, { threshold: .02, rootMargin: '0px 0px -12% 0px' });
  $$('.scene').forEach((scene) => sceneObserver.observe(scene));
} else {
  $$('.scene').forEach((scene) => scene.classList.add('is-entered'));
}

const soundExperience = mountPianoExperience({ reducedMotion });
const lowWindow = matchMedia('(max-height: 600px)');
// Dots fill the whole screen; one of them becomes the orange circle of the story.
// Before the story: one grey field splits into ever finer parts.
const origin = mountOrigin($('#origin'), { reducedMotion, isStatic: () => lowWindow.matches });
// The prologue ends on the same field the story starts with.
const geometryStory = mountGeometryStory($('#principle'), { isStatic: () => reducedMotion.matches || lowWindow.matches, onField: origin.setField });
// The Triton peeks out of the water, blows his conch, and his sea floods the screen.
const stranger = mountStranger($('#stranger'), { reducedMotion, isStatic: () => lowWindow.matches, onCall: soundExperience.conch });
const sourceExperience = mountSources($('#sources'), { reducedMotion, isStatic: () => lowWindow.matches });
const readingPosition = mountReadingPosition();

// Тяжёлые рисунки грузятся в фоне с начала статьи, когда первый экран уже готов:
// сначала тритон над пианино, потом тритон в море и его волны.
function preloadArt() {
  soundExperience.preload()
    .then(() => stranger.preload())
    .then(() => { new Image().src = new URL('./assets/sea/sea-waves.webp', import.meta.url).href; });
}
const whenIdle = window.requestIdleCallback || ((callback) => setTimeout(callback, 600));
if (document.readyState === 'complete') whenIdle(preloadArt);
else window.addEventListener('load', () => whenIdle(preloadArt), { once: true });

const veil = $('.restart-veil');
let scrollTicking = false;
let restarting = false;

function updateScroll() {
  scrollTicking = false;
  if (readingPosition.viewportChanged()) { relayout(); return; }
  soundExperience.updateScroll();
  const reduced = reducedMotion.matches;
  origin.update();
  geometryStory.check();
  stranger.update();
  sourceExperience.update();
  const hero = $('#top');
  hero.style.setProperty('--hero-leave', reduced ? '0' : clamp(scrollY / Math.max(1, hero.offsetHeight * .7)).toFixed(4));
  const total = root.scrollHeight - innerHeight;
  $('.reading-progress span').style.transform = `scaleX(${clamp(scrollY / Math.max(1, total))})`;
  readingPosition.capture();
}
function queueScrollUpdate() {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(updateScroll);
}
function resetExperiments() {
  geometryStory.reset();
  soundExperience.reset();
}
function restartEssay() {
  if (restarting) return;
  restarting = true;
  soundExperience.stop();
  veil.classList.add('active');
  root.classList.remove('intro-ready');
  setTimeout(() => {
    resetExperiments();
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    scrollTo({ top: 0, behavior: 'instant' });
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    root.style.scrollBehavior = previous;
    $('#hero-title').setAttribute('tabindex', '-1');
    $('#hero-title').focus({ preventScroll: true });
    updateScroll();
    setTimeout(() => {
      veil.classList.remove('active');
      requestAnimationFrame(() => root.classList.add('intro-ready'));
      restarting = false;
    }, reducedMotion.matches ? 0 : 150);
  }, reducedMotion.matches ? 0 : 300);
}
$('#restart').addEventListener('click', restartEssay);
// «Читать»: обложка медленно гаснет, секунду-другую стоит пустой светлый экран,
// потом страница сама доезжает до «Родилась она», и надпись поднимается снизу.
// Это нажатие заодно разрешает звук для бала.
function glideTo(target, duration) {
  const start = scrollY;
  const began = performance.now();
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  const step = (now) => {
    const t = clamp((now - began) / duration);
    const eased = t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
    scrollTo({ top: start + (target - start) * eased, behavior: 'instant' });
    if (t < 1) requestAnimationFrame(step);
    else root.style.scrollBehavior = previous;
  };
  requestAnimationFrame(step);
}
$('.read-button').addEventListener('click', (event) => {
  soundExperience.unlockAudio();
  const hero = $('#top');
  if (lowWindow.matches || hero.classList.contains('is-leaving')) return;
  event.preventDefault();
  if (reducedMotion.matches) { scrollTo({ top: origin.titleScroll(), behavior: 'instant' }); return; }
  hero.classList.add('is-leaving');
  setTimeout(() => {
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    scrollTo({ top: $('#origin').getBoundingClientRect().top + scrollY, behavior: 'instant' });
    root.style.scrollBehavior = previous;
    hero.classList.remove('is-leaving');
    setTimeout(() => glideTo(origin.titleScroll(), 1800), 500);
  }, 1200);
});
addEventListener('scroll', () => {
  readingPosition.capture();
  queueScrollUpdate();
}, { passive: true });
function relayout() {
  // Apply every height-changing scene mode before restoring the reader's region.
  origin.update();
  geometryStory.layout();
  geometryStory.check();
  stranger.update();
  sourceExperience.update();
  readingPosition.restore();
  queueScrollUpdate();
}
addEventListener('resize', relayout, { passive: true });
lowWindow.addEventListener('change', relayout);
addEventListener('load', queueScrollUpdate);
addEventListener('pagehide', () => soundExperience.stop());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) soundExperience.stop();
  else queueScrollUpdate();
});
reducedMotion.addEventListener('change', () => {
  soundExperience.motionChanged();
  relayout();
});
if ('ResizeObserver' in window) {
  new ResizeObserver(queueScrollUpdate).observe($('main'));
  new ResizeObserver(relayout).observe($('#story-canvas'));
}
updateScroll();
