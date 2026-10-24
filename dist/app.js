import { mountPianoExperience } from './piano.js?v=dots-1';

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

// Dots fill the whole screen; one of them, above and right of the headline, differs.
const dotField = $('#dot-field');
let dotSize = '';
function layoutDots() {
  const width = dotField.clientWidth;
  const height = dotField.clientHeight;
  const step = width < 600 ? 36 : 60;
  const cols = Math.max(1, Math.floor(width / step));
  const rows = Math.max(1, Math.floor(height / step));
  if (dotSize === `${cols}x${rows}`) return;
  dotSize = `${cols}x${rows}`;
  dotField.style.setProperty('--dot-step', `${step}px`);
  dotField.style.setProperty('--dot-cols', cols);
  const different = Math.min(rows - 1, Math.floor(rows * .3)) * cols + Math.min(cols - 1, Math.floor(cols * .58));
  dotField.replaceChildren(...Array.from({ length: cols * rows }, (_, index) => {
    const dot = document.createElement('i');
    if (index === different) dot.className = 'is-different';
    return dot;
  }));
}
layoutDots();
$('#hierarchy-toggle').addEventListener('click', () => {
  const ordered = $('#poster').classList.toggle('is-ordered');
  $('#hierarchy-toggle').setAttribute('aria-pressed', String(ordered));
  $('#hierarchy-toggle').innerHTML = ordered ? 'Убрать иерархию <span aria-hidden="true">↙</span>' : 'Добавить иерархию <span aria-hidden="true">↗</span>';
  $('#hierarchy-description').textContent = ordered ? 'Контраст подсказывает, что читать первым. Через масштаб, вес и пространство.' : 'Теперь всё одного веса. Глазу снова приходится искать начало.';
});

const soundExperience = mountPianoExperience({ reducedMotion });

const attention = $('#principle');
const feeling = $('#feeling');
const ending = $('#disappearance');
const veil = $('.restart-veil');
let scrollTicking = false;
let restartTimer;
let restarting = false;
let lastEndingProgress = 0;

function localProgress(element) {
  return clamp(-element.getBoundingClientRect().top / Math.max(1, element.offsetHeight - innerHeight));
}
function cancelRestart() {
  clearTimeout(restartTimer);
  restartTimer = undefined;
}
function updateScroll() {
  scrollTicking = false;
  soundExperience.updateScroll();
  const reduced = reducedMotion.matches;
  const staticScenes = reduced || matchMedia('(max-height: 600px)').matches;
  const attentionProgress = localProgress(attention);
  attention.classList.toggle('has-difference', staticScenes || attentionProgress > .10);
  attention.classList.toggle('has-insight', staticScenes || attentionProgress > .32);
  attention.classList.toggle('has-next', staticScenes || attentionProgress > .70);
  const feelingProgress = localProgress(feeling);
  const soft = staticScenes || feelingProgress > .23;
  feeling.classList.toggle('has-softness', soft);
  feeling.classList.toggle('has-story', staticScenes || feelingProgress > .45);
  $('.feeling-first').setAttribute('aria-hidden', String(soft));
  $('.feeling-second').setAttribute('aria-hidden', String(!soft));
  const total = root.scrollHeight - innerHeight;
  $('.reading-progress span').style.transform = `scaleX(${clamp(scrollY / Math.max(1, total))})`;
  const progress = localProgress(ending);
  lastEndingProgress = progress;
  ending.style.setProperty('--end-p', clamp(progress / .48).toFixed(4));
  ending.style.setProperty('--end-w', clamp((progress - .57) / .36).toFixed(4));
  ending.style.setProperty('--end-opacity', (1 - clamp((progress - .17) / .3)).toFixed(4));
  $('.reading-progress').style.opacity = String(1 - clamp((progress - .35) / .15));
  root.classList.toggle('ending-blank', progress > .48 && !reduced);
  if (progress > .97 && !reduced && !document.hidden && !restarting) {
    if (!restartTimer) restartTimer = setTimeout(() => {
      if (lastEndingProgress > .97 && !document.hidden) restartEssay();
    }, 1400);
  } else if (progress <= .97 || reduced) cancelRestart();
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
  soundExperience.reset();
  $('#sources').open = false;
}
function restartEssay() {
  if (restarting) return;
  restarting = true;
  cancelRestart();
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
addEventListener('resize', () => { layoutDots(); queueScrollUpdate(); }, { passive: true });
addEventListener('load', queueScrollUpdate);
addEventListener('pagehide', () => soundExperience.stop());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { soundExperience.stop(); cancelRestart(); }
  else queueScrollUpdate();
});
reducedMotion.addEventListener('change', () => {
  soundExperience.motionChanged();
  queueScrollUpdate();
});
if ('ResizeObserver' in window) {
  new ResizeObserver(queueScrollUpdate).observe($('main'));
}
updateScroll();
