import { mountPianoExperience } from './piano.js?v=origin-1';
import { mountGeometryStory } from './geometry-story.js?v=origin-1';
import { mountSoundScreen } from './sound-screen.js?v=origin-1';
import { mountStranger } from './stranger.js?v=origin-1';
import { mountOrigin } from './origin.js?v=origin-1';

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
const soundScreen = mountSoundScreen({
  lab: $('#sound-lab'),
  holdsPage: () => soundExperience.holdsPage(),
  isStatic: () => reducedMotion.matches || matchMedia('(max-height: 600px)').matches,
  onScroll: () => queueScrollUpdate(),
});
const lowWindow = matchMedia('(max-height: 600px)');
// Dots fill the whole screen; one of them becomes the orange circle of the story.
const geometryStory = mountGeometryStory($('#principle'), { isStatic: () => reducedMotion.matches || lowWindow.matches });
// Before the story: one grey field splits into ever finer parts.
const origin = mountOrigin($('#origin'), { reducedMotion, isStatic: () => lowWindow.matches });
// The Triton lies on a white screen until his sea floods it.
const stranger = mountStranger($('#stranger'), { reducedMotion, isStatic: () => lowWindow.matches });

const ending = $('#disappearance');
const veil = $('.restart-veil');
let scrollTicking = false;
let restarting = false;

function localProgress(element) {
  return clamp(-element.getBoundingClientRect().top / Math.max(1, element.offsetHeight - innerHeight));
}
function updateScroll() {
  scrollTicking = false;
  soundScreen.check();
  soundExperience.updateScroll();
  const reduced = reducedMotion.matches;
  origin.update();
  geometryStory.check();
  stranger.update();
  const total = root.scrollHeight - innerHeight;
  $('.reading-progress span').style.transform = `scaleX(${clamp(scrollY / Math.max(1, total))})`;
  const progress = localProgress(ending);
  ending.style.setProperty('--end-p', clamp(progress / .48).toFixed(4));
  ending.style.setProperty('--end-w', clamp((progress - .57) / .36).toFixed(4));
  ending.style.setProperty('--end-opacity', (1 - clamp((progress - .17) / .3)).toFixed(4));
  $('.reading-progress').style.opacity = String(1 - clamp((progress - .35) / .15));
  root.classList.toggle('ending-blank', progress > .48 && !reduced);
  // The white ending waits for the reader. Keep the exit in the tab order only
  // once it is visible, and remove it again when scrolling back into the essay.
  $('.ending-last').hidden = !reduced && progress < .93;
}
function queueScrollUpdate() {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(updateScroll);
}
function resetExperiments() {
  geometryStory.reset();
  soundExperience.reset();
  soundScreen.reset();
  $('#sources').open = false;
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
// «Читать»: надписи обложки уезжают влево, и начинается пролог о том, откуда берётся разница.
$('.read-button').addEventListener('click', (event) => {
  const hero = $('#top');
  if (reducedMotion.matches || lowWindow.matches || hero.classList.contains('is-leaving')) return;
  event.preventDefault();
  hero.classList.add('is-leaving');
  setTimeout(() => {
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    scrollTo({ top: $('#origin').getBoundingClientRect().top + scrollY, behavior: 'instant' });
    root.style.scrollBehavior = previous;
    updateScroll();
    // Обложка снова на месте, если читатель вернётся наверх.
    setTimeout(() => hero.classList.remove('is-leaving'), 200);
  }, 650);
});
addEventListener('scroll', queueScrollUpdate, { passive: true });
function relayout() {
  geometryStory.layout();
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
