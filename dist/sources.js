const clamp = (value) => Math.min(1, Math.max(0, value));
const ease = (value) => value * value * (3 - 2 * value);

const spacing = .7;
const duration = 1.4;
const centreTime = duration * (70 / 160) ** (1 / 1.45);
const paths = [
  { x: -.6, drift: -1.6, angle: -18, spin: -58 },
  { x: .55, drift: 1.65, angle: 22, spin: 70 },
  { x: -.1, drift: 1.5, angle: -8, spin: 82 },
  { x: .45, drift: -1.65, angle: 14, spin: -78 },
  { x: -.7, drift: .8, angle: -24, spin: 66 },
  { x: .7, drift: -1, angle: 18, spin: -86 },
  { x: 0, drift: 1.7, angle: -12, spin: 92 },
];
const totalTime = (count) => Math.max(0, count - 1) * spacing + duration;

export function sourceReadingProgress(index, count) {
  return (index * spacing + centreTime) / totalTime(count);
}

// Scroll sends the links tumbling downward: each has its own drift and spin.
export function sourceFrame(progress, index, count) {
  const p = clamp(Number.isFinite(progress) ? progress : 0);
  const time = p * totalTime(count) - index * spacing;
  const fall = clamp(time / duration) ** 1.45;
  const path = paths[index % paths.length];
  return {
    x: path.x + path.drift * fall,
    y: -70 + 160 * fall,
    rotation: path.angle + path.spin * fall,
    scale: 1.08 - .56 * fall,
    opacity: ease(clamp(time / .2)) * (1 - ease(clamp((time - 1.05) / .35))),
  };
}

export function mountSources(section, { reducedMotion, isStatic }) {
  const scroll = section.querySelector('.sources-scroll');
  const items = [...section.querySelectorAll('.source-item')];
  section.style.setProperty('--source-count', items.length);

  function update() {
    const floating = !reducedMotion.matches && !isStatic();
    section.classList.toggle('is-floating', floating);
    const rect = scroll.getBoundingClientRect();
    const progress = -rect.top / Math.max(1, rect.height - innerHeight);
    items.forEach((item, index) => {
      const focused = item.querySelector('a').matches(':focus-visible');
      const frame = floating && !focused ? sourceFrame(progress, index, items.length)
        : { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 };
      item.style.setProperty('--fall-x', frame.x.toFixed(4));
      item.style.setProperty('--fall-y', `${frame.y.toFixed(3)}svh`);
      item.style.setProperty('--fall-angle', `${frame.rotation.toFixed(3)}deg`);
      item.style.setProperty('--fall-scale', frame.scale.toFixed(4));
      item.style.setProperty('--source-hit', `${(44 / frame.scale).toFixed(2)}px`);
      item.style.setProperty('--fall-opacity', frame.opacity.toFixed(3));
      item.classList.toggle('is-readable', frame.opacity > .15);
    });
  }

  // Invisible references stay in the tab order. Keyboard focus brings each
  // one to its reading position without moving a link during a pointer click.
  items.forEach((item, index) => {
    item.querySelector('a').addEventListener('focus', (event) => {
      if (!section.classList.contains('is-floating') || !event.target.matches(':focus-visible')) return;
      const rect = scroll.getBoundingClientRect();
      const progress = sourceReadingProgress(index, items.length);
      scrollTo({ top: scrollY + rect.top + progress * (rect.height - innerHeight), behavior: 'instant' });
      update();
    });
    item.querySelector('a').addEventListener('blur', update);
  });
  update();
  return { update };
}
