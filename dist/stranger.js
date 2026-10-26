// Тритон здесь чужой: из воды видны только голова, плечи и рука с раковиной.
// Дочитали до «Контекст влияет на контраст» — он трубит в раковину, и звучит
// его интервал. На зов поднимается море и накрывает экран: под водой остаются
// точка и квадрат, теперь чужие они.
// Контекст влияет на контраст.
// Потом на дне выбивает пробку: точка успевает проскользнуть в слив,
// а квадрат застревает в дырке углом.

// `shore` — how much of the sea shows at the start; `deep` — the sea has risen over the whole screen.
// `call` — where the Triton blows his conch: the scroll starts the call, the call plays out by itself.
// The drain: `bed` — the sea floor shows; `open` — the plug flies off and the hole widens;
// `slip` — the dot rolls to the hole, then falls through; `stuck` — the square follows, turns on its corner and wedges.
export const seaTiming = {
  shore: .71, deep: 2.86, call: .25,
  textA: [.06, .13], textB: [.13, .2], lift: [.145, .23],
  flood: [.3, .58], textBOut: [.32, .39], textC: [.54, .62], sink: [.36, .72],
  bed: [.6, .67], open: [.68, .76], slipX: [.74, .81], slipY: [.79, .88], stuckX: [.8, .88], stuckY: [.85, .95]
};

const ramp = (value, [from, to]) => Math.min(1, Math.max(0, (value - from) / (to - from)));
const ease = (value) => value * value * (3 - 2 * value);

export function seaAt(progress) {
  return {
    level: seaTiming.shore + (seaTiming.deep - seaTiming.shore) * ramp(progress, seaTiming.flood),
    lift: ramp(progress, seaTiming.lift),
    sink: ramp(progress, seaTiming.sink),
    first: 1 - ramp(progress, seaTiming.textA),
    second: ramp(progress, seaTiming.textB) * (1 - ramp(progress, seaTiming.textBOut)),
    third: ramp(progress, seaTiming.textC),
    bed: ramp(progress, seaTiming.bed),
    open: ease(ramp(progress, seaTiming.open)),
    slipX: ease(ramp(progress, seaTiming.slipX)),
    // The drain pulls harder the closer the dot gets.
    slipY: ramp(progress, seaTiming.slipY) ** 2,
    stuckX: ease(ramp(progress, seaTiming.stuckX)),
    stuckY: ease(ramp(progress, seaTiming.stuckY))
  };
}

export function mountStranger(section, { reducedMotion, isStatic, onCall = () => {} }) {
  const scroll = section.querySelector('.stranger-scroll');
  const sea = section.querySelector('.sea');
  // Two poses, each in two drawings: the Triton hiding in the waves, and the Triton blowing his conch.
  const poses = [...section.querySelectorAll('.triton-pose')].map((pose) => [...pose.querySelectorAll('img')]);
  // Three layers of the same drawn sea, each with its own size and drift speed.
  ['far', 'mid', 'near'].forEach((depth) => {
    const layer = document.createElement('div');
    layer.className = `sea-layer sea-layer--${depth}`;
    layer.innerHTML = '<div class="sea-drift"><div class="sea-waves"></div></div>';
    sea.append(layer);
  });
  // The Triton swims between the middle and the near waves.
  sea.insertBefore(section.querySelector('.stranger-triton'), sea.querySelector('.sea-layer--near'));
  // The sound of the conch spreads over the crests.
  sea.append(section.querySelector('.triton-call'));

  // Two drawings swap with a hard cut, like the paper cut-out in the fall.
  let frame = 0;
  let timer;
  function animate(on) {
    if (on && !timer) {
      timer = setInterval(() => {
        frame = (frame + 1) % 2;
        poses.forEach((images) => images.forEach((image, index) => { image.hidden = index !== frame; }));
      }, 420);
    } else if (!on && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  }

  // The call: the Triton lifts his conch, it sounds once, the rings spread; scrolling back above it lets it sound again.
  let called = false;
  let callTimer;
  function call(on) {
    if (on === called) return;
    called = on;
    clearTimeout(callTimer);
    // Once he has called, he keeps blowing while his sea rises.
    section.classList.toggle('is-blowing', on);
    section.classList.toggle('is-calling', on);
    if (!on) return;
    onCall();
    callTimer = setTimeout(() => section.classList.remove('is-calling'), 2600);
  }

  function update() {
    const rect = scroll.getBoundingClientRect();
    const still = reducedMotion.matches || isStatic();
    const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height - innerHeight)));
    // Without motion the three texts stand in a column and the sea stays at the bottom of the scene.
    const state = still
      ? { level: 1, lift: 1, sink: 0, first: 1, second: 1, third: 1, bed: 0, open: 0, slipX: 0, slipY: 0, stuckX: 0, stuckY: 0 }
      : seaAt(progress);
    section.classList.toggle('is-still', still);
    section.style.setProperty('--sea', state.level.toFixed(4));
    section.style.setProperty('--text-a', state.first.toFixed(3));
    section.style.setProperty('--text-b', state.second.toFixed(3));
    section.style.setProperty('--text-c', state.third.toFixed(3));
    section.style.setProperty('--lift', state.lift.toFixed(4));
    section.style.setProperty('--sink', state.sink.toFixed(4));
    ['bed', 'open', 'slipX', 'slipY', 'stuckX', 'stuckY'].forEach((key) => {
      section.style.setProperty(`--${key.replace(/[XY]/, (axis) => `-${axis.toLowerCase()}`)}`, state[key].toFixed(4));
    });
    section.classList.toggle('is-sea', !still && state.level > .5);
    // Landing far below the call (a reload, a jump to the sources) does not blow the conch.
    if (!still && progress >= seaTiming.call) {
      if (progress < seaTiming.flood[0] + .1 && rect.bottom > 0) call(true);
      else if (!called) { called = true; section.classList.add('is-blowing'); }
    } else if (progress < seaTiming.call - .06) call(false);
    animate(!still && rect.bottom > 0 && rect.top < innerHeight);
  }

  // Кадры тритона грузятся заранее, в фоне: иначе скрытая поза с раковиной
  // начинает загружаться только в момент зова и появляется с задержкой.
  function preload() {
    return Promise.all(poses.flat().map((image) => {
      image.loading = 'eager';
      return image.decode().catch(() => {});
    }));
  }

  return { update, preload };
}
