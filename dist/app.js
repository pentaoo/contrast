import { mountPianoExperience } from './piano.js?v=ball-1';
import { mountGeometryStory } from './geometry-story.js?v=ball-1';
import { mountSoundScreen } from './sound-screen.js?v=ball-1';

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

$('#hierarchy-toggle').addEventListener('click', () => {
  const ordered = $('#poster').classList.toggle('is-ordered');
  $('#hierarchy-toggle').setAttribute('aria-pressed', String(ordered));
  $('#hierarchy-toggle').innerHTML = ordered ? 'Убрать иерархию <span aria-hidden="true">↙</span>' : 'Добавить иерархию <span aria-hidden="true">↗</span>';
  $('#hierarchy-description').textContent = ordered ? 'Слова остались прежними. Размер, вес и интервалы задали порядок чтения.' : 'Слова те же. Без иерархии начало приходится искать заново.';
});

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

const feeling = $('#feeling');
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
  const staticScenes = reduced || lowWindow.matches;
  geometryStory.check();
  const feelingProgress = localProgress(feeling);
  const soft = staticScenes || feelingProgress > .23;
  feeling.classList.toggle('has-softness', soft);
  feeling.classList.toggle('has-story', staticScenes || feelingProgress > .45);
  $('.feeling-first').setAttribute('aria-hidden', String(soft));
  $('.feeling-second').setAttribute('aria-hidden', String(!soft));
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
  $('#poster').classList.remove('is-ordered');
  $('#hierarchy-toggle').setAttribute('aria-pressed', 'false');
  $('#hierarchy-toggle').innerHTML = 'Добавить иерархию <span aria-hidden="true">↗</span>';
  $('#hierarchy-description').textContent = '';
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
