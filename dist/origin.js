// Откуда берётся разница: серое поле делится жёсткими шагами.
// Сначала одно целое, потом «плохо» и «хорошо», потом «хорошо» распадается
// на маму, соску и плед, а в конце мир дробится до поля точек — того самого,
// с которого начинается история оранжевой точки.

// Пять абзацев, четыре состояния поля: последний абзац стоит на поле точек.
export const ORIGIN_LAYERS = [0, 1, 2, 3, 3];

export function originStep(progress, steps = ORIGIN_LAYERS.length) {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  return Math.min(steps - 1, Math.floor(p * steps));
}

export function mountOrigin(section, { reducedMotion, isStatic }) {
  const scroll = section.querySelector('.origin-scroll');
  const layers = [...section.querySelectorAll('.origin-layer')];
  const texts = [...section.querySelectorAll('.origin-text')];
  let shown = -1;

  function update() {
    const still = reducedMotion.matches || isStatic();
    section.classList.toggle('is-still', still);
    if (still) { shown = -1; return; }
    const rect = scroll.getBoundingClientRect();
    const step = originStep(-rect.top / Math.max(1, rect.height - innerHeight), texts.length);
    if (step === shown) return;
    shown = step;
    // Поле меняется без растворения, как кадры тритона; текст сменяется мягко.
    layers.forEach((layer, index) => layer.classList.toggle('is-current', index === ORIGIN_LAYERS[step]));
    texts.forEach((text, index) => text.classList.toggle('is-current', index === step));
  }

  return { update };
}
