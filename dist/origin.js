// Родилась она. Сначала мир делится только на свет и тьму, потом на формы,
// формы множатся и мельчают, пока не станут полем одинаковых точек.
// Одна из них — она: с этого поля начинается история оранжевой точки.

// Пять абзацев, пять состояний поля. На третьем шаге формы появляются по одной.
export const ORIGIN_LAYERS = [0, 1, 2, 3, 4];
export const ORIGIN_SHAPES = 3;

export function originFrame(progress, steps = ORIGIN_LAYERS.length) {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const step = Math.min(steps - 1, Math.floor(p * steps));
  const local = Math.min(1, p * steps - step);
  // Первая форма видна сразу, следующие — по мере прокрутки шага.
  const shapes = Math.min(ORIGIN_SHAPES, 1 + Math.floor(local * ORIGIN_SHAPES * 1.25));
  return { step, shapes };
}

export function mountOrigin(section, { reducedMotion, isStatic }) {
  const scroll = section.querySelector('.origin-scroll');
  const layers = [...section.querySelectorAll('.origin-layer')];
  const shapes = [...section.querySelectorAll('.origin-shape')];
  const texts = [...section.querySelectorAll('.origin-text')];
  let shown = '';

  function update() {
    const still = reducedMotion.matches || isStatic();
    section.classList.toggle('is-still', still);
    if (still) { shown = ''; return; }
    const rect = scroll.getBoundingClientRect();
    const frame = originFrame(-rect.top / Math.max(1, rect.height - innerHeight), texts.length);
    const key = `${frame.step}:${frame.shapes}`;
    if (key === shown) return;
    shown = key;
    // Поле меняется жёсткой сменой кадра, без растворения; текст сменяется мягко.
    layers.forEach((layer, index) => layer.classList.toggle('is-current', index === ORIGIN_LAYERS[frame.step]));
    shapes.forEach((shape, index) => { shape.hidden = index >= frame.shapes; });
    texts.forEach((text, index) => text.classList.toggle('is-current', index === frame.step));
  }

  return { update };
}
