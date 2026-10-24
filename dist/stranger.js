// Тритон лежит на белом экране рядом с кругом и квадратом. При прокрутке
// рисованные волны его мира заливают экран: теперь чужие — круг и квадрат.
// Контекст влияет на контраст.

export const seaTiming = { rise: [.2, .62], textA: [.14, .28], textB: [.56, .7] };

const ramp = (value, [from, to]) => Math.min(1, Math.max(0, (value - from) / (to - from)));

export function seaAt(progress) {
  return {
    level: ramp(progress, seaTiming.rise),
    first: 1 - ramp(progress, seaTiming.textA),
    second: ramp(progress, seaTiming.textB)
  };
}

export function mountStranger(section, { reducedMotion, isStatic }) {
  const scroll = section.querySelector('.stranger-scroll');
  const sea = section.querySelector('.sea');
  const frames = [...section.querySelectorAll('.stranger-triton img')];
  // Three layers of the same drawn sea, each with its own size and drift speed.
  ['far', 'mid', 'near'].forEach((depth) => {
    const layer = document.createElement('div');
    layer.className = `sea-layer sea-layer--${depth}`;
    layer.innerHTML = '<div class="sea-drift"><div class="sea-waves"></div><div class="sea-deep"></div></div>';
    sea.append(layer);
  });

  // Two drawings swap with a hard cut, like the paper cut-out in the fall.
  let frame = 0;
  let timer;
  function animate(on) {
    if (on && !timer && frames.length > 1) {
      timer = setInterval(() => {
        frame = (frame + 1) % frames.length;
        frames.forEach((image, index) => { image.hidden = index !== frame; });
      }, 420);
    } else if (!on && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  }

  function update() {
    const rect = scroll.getBoundingClientRect();
    const still = reducedMotion.matches || isStatic();
    const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height - innerHeight)));
    // Without motion both texts stand in a column and the sea fills only the scene.
    const state = still ? { level: 1, first: 1, second: 1 } : seaAt(progress);
    section.classList.toggle('is-still', still);
    section.style.setProperty('--sea', state.level.toFixed(4));
    section.style.setProperty('--text-a', state.first.toFixed(3));
    section.style.setProperty('--text-b', state.second.toFixed(3));
    section.classList.toggle('is-sea', !still && state.level > .5);
    animate(!still && rect.bottom > 0 && rect.top < innerHeight);
  }

  return { update };
}
