// История оранжевой точки: поле точек → круг, большой и маленький квадрат.
// Сначала пролёт: камера несётся над огромным полем крошечных точек и
// приближается к одной из них. Потом точка дёргается, становится оранжевой
// и выбегает за край поля, где её встречают квадраты.
// Сцена идёт от прокрутки: экран закреплён, и каждый кадр — это место на странице.
// Кадр зависит только от прогресса: одинаковый прогресс — одинаковый кадр.

const SVG = 'http://www.w3.org/2000/svg';
export const ZOOM_FROM = .18;
// Доли прокрутки закреплённой сцены: пролёт, история, рост большого квадрата.
export const storyScrollParts = { intro: [0, .12], story: [.12, .82], grow: [.82, 1] };
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const ease = (t) => t * t * (3 - 2 * t);
const span = (p, from, to) => ease(clamp((p - from) / (to - from)));

// Размеры в единицах сцены: диаметр круга — 1.
export const SIZES = { circle: 1, small: 1.6, big: 4.4 };

// Ключевые кадры: [прогресс, x, y]. Между ними — плавный ход с остановкой на каждом кадре.
function track(p, keys) {
  if (p <= keys[0][0]) return { x: keys[0][1], y: keys[0][2] };
  for (let index = 1; index < keys.length; index += 1) {
    const [to, x, y] = keys[index];
    if (p <= to) {
      const [from, x0, y0] = keys[index - 1];
      const t = to === from ? 1 : ease((p - from) / (to - from));
      return { x: x0 + (x - x0) * t, y: y0 + (y - y0) * t };
    }
  }
  const last = keys[keys.length - 1];
  return { x: last[1], y: last[2] };
}

// Пролёт над полем: zoom — масштаб поля, pan — сколько ширин экрана камере
// ещё лететь до точки. В конце пролёта поле стоит как в начале истории.
export function introFrame(progress) {
  const t = clamp(Number.isFinite(progress) ? progress : 0);
  const flight = clamp(t / .85);
  return {
    zoom: ZOOM_FROM ** (1 - span(t, .3, 1)),
    pan: 4 * (1 - flight) ** 3,
  };
}

// view: половины ширины и высоты окна, место точки в сетке и радиус обычной точки — всё в единицах сцены.
// Прокрутка сцены (0…1) → пролёт, история и рост квадрата.
export function storyScroll(scroll) {
  const s = clamp(Number.isFinite(scroll) ? scroll : 0);
  const part = ([from, to]) => clamp((s - from) / (to - from));
  return { intro: part(storyScrollParts.intro), progress: part(storyScrollParts.story), grow: part(storyScrollParts.grow) };
}

export function storyFrame(progress, view) {
  const p = clamp(Number.isFinite(progress) ? progress : 0);
  const { halfW, halfH, start, dotR } = view;
  const leftOut = -halfW - 3;

  const circleKeys = [
    [.17, start.x, start.y],
    [.27, .4, 0],
    [.335, .4, 0],
    [.36, 2.6, 0], // отступает после остановки квадрата
    [.395, 2.6, 0],
    [.42, 4.4, 0],
    [.425, 4.4, 0],
    [.45, 3.8, -2], // пробует уйти по диагонали
    [.465, 3.8, -2],
    [.485, 5.8, -.8],
    [.525, 5.8, -.8],
    [.545, 6.2, -.4],
    [.635, 6.2, -.4],
    [.655, 6.8, .6], // за маленьким квадратом
    [.79, 6.8, .6],
    [.85, 2.4, 2.8], // нижний путь
    [.91, leftOut + .6, 3.4],
  ];
  const bigKeys = [
    [.27, leftOut - 1, 0],
    [.32, -3.75, 0],
    [.36, -3.75, 0],
    [.39, -1.55, 0],
    [.435, -1.55, 0],
    [.465, .85, -2.75], // перекрывает путь
    [.5, .85, -2.75],
    [.535, 1.65, -1.1],
    [.645, 1.65, -1.1],
    [.665, 1.05, -1.1], // ответ на маленький квадрат
    [.68, 1.05, -1.1],
    [.71, 1.85, -.9],
    [.735, 1.85, -.9],
    [.78, 1.65, -3.15], // за маленьким, вверх
    [.885, 1.65, -3.15],
    [.93, -.35, -1.75], // поздно оборачивается
  ];
  const smallKeys = [
    [.55, halfW + 2, -halfH - 2],
    [.6, 4.78, -3],
    [.61, 4.78, -3],
    [.635, 4.78, -.6], // встаёт между
    [.68, 4.78, -.6],
    [.71, 5, -.5],
    [.72, 5, -.5],
    [.76, 4.9, -3.4], // уводит большого вверх
    [.8, 4.9, -3.4],
    [.85, 4.9, 1.2],
    [.92, leftOut - .4, 1.9],
  ];

  // Перед побегом точка нервничает: сперва чуть дрожит, потом дёргается сильнее.
  const nerves = (span(p, .02, .08) * .05 + span(p, .1, .16) * .13) * (1 - span(p, .16, .17));
  const circle = p < .17
    ? { x: start.x + nerves * (Math.sin(p * 311) + .5 * Math.sin(p * 977)), y: start.y + nerves * .6 * (Math.sin(p * 421) + .5 * Math.sin(p * 733)) }
    : track(p, circleKeys);
  const grow = span(p, .19, .27);
  circle.r = dotR + (SIZES.circle / 2 - dotR) * grow;
  circle.tint = span(p, .08, .1);

  const big = { ...track(p, bigKeys), size: SIZES.big, visible: p > .27 };
  const small = { ...track(p, smallKeys), size: SIZES.small, visible: p > .55 };

  return {
    progress: p,
    dots: 1 - span(p, .17, .25),
    circle,
    big,
    small,
    copy: [span(p, .925, .95), span(p, .95, .97), span(p, .975, .99)],
  };
}

// После истории прокрутка растит большой квадрат, пока он не закроет весь экран.
export function growSquare(square, grow, view) {
  const t = ease(clamp(grow / .85));
  const cover = 2 * Math.max(view.halfW, view.halfH + Math.abs(view.centerY)) + 1;
  return {
    ...square,
    x: square.x * (1 - t),
    y: square.y + (view.centerY - square.y) * t,
    size: square.size * (cover / square.size) ** t,
  };
}

// Сколько единиц от края круга до квадрата (отрицательно — наложение).
export function circleGap(circle, square) {
  const half = square.size / 2;
  const dx = Math.max(0, Math.abs(circle.x - square.x) - half);
  const dy = Math.max(0, Math.abs(circle.y - square.y) - half);
  const inside = Math.abs(circle.x - square.x) < half && Math.abs(circle.y - square.y) < half;
  return inside ? -circle.r : Math.hypot(dx, dy) - circle.r;
}
export function squareGap(a, b) {
  const reach = (a.size + b.size) / 2;
  return Math.max(Math.abs(a.x - b.x) - reach, Math.abs(a.y - b.y) - reach);
}

function create(name, attributes = {}) {
  const node = document.createElementNS(SVG, name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}
function parseColor(value) {
  const hex = value.trim().replace('#', '');
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16) || 0);
}

export function mountGeometryStory(section, { isStatic }) {
  const svg = section.querySelector('#story-canvas');
  // Поле — один прямоугольник с узором из точек: так оно может быть огромным.
  const defs = create('defs');
  const pattern = create('pattern', { id: 'story-dots', patternUnits: 'userSpaceOnUse' });
  const patternDot = create('circle');
  pattern.append(patternDot);
  defs.append(pattern);
  const dotsLayer = create('g');
  const field = create('rect', { fill: 'url(#story-dots)' });
  // Во время пролёта поле бесконечно и справа; край появится только в истории.
  const beyond = create('rect', { fill: 'url(#story-dots)' });
  const hole = create('circle', { class: 'story-hole' });
  dotsLayer.append(field, beyond, hole);
  const big = create('rect');
  const small = create('rect');
  const circle = create('circle');
  svg.replaceChildren(defs, dotsLayer, big, small, circle);

  let layout = null;
  let gridKey = '';
  let lastKey = '';

  function measure() {
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    if (!width || !height) { layout = null; return; }
    const style = getComputedStyle(section);
    const step = width < 600 ? 36 : 60;
    const cols = Math.max(1, Math.floor(width / step));
    const rows = Math.max(1, Math.floor(height / step));
    const unit = clamp(Math.min(width / 17, height / 12), 18, 52);
    const originX = width / 2;
    const originY = height * .44;
    const left = (width - cols * step) / 2 + step / 2;
    const top = (height - rows * step) / 2 + step / 2;
    const heroRow = Math.min(rows - 1, Math.floor(rows * .3));
    const heroCol = Math.min(cols - 1, Math.floor(cols * .58));
    const dotR = clamp(step * .125, 4.5, 7.5);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const key = `${width}x${height}`;
    if (key !== gridKey) {
      gridKey = key;
      const heroX = left + heroCol * step;
      const heroY = top + heroRow * step;
      pattern.setAttribute('x', left - step / 2);
      pattern.setAttribute('y', top - step / 2);
      pattern.setAttribute('width', step);
      pattern.setAttribute('height', step);
      Object.entries({ cx: step / 2, cy: step / 2, r: dotR }).forEach(([name, value]) => patternDot.setAttribute(name, value));
      // Поле тянется далеко влево, вверх и вниз, а справа кончается сразу за экраном.
      const right = left + cols * step + step / 2;
      const reach = 6 / ZOOM_FROM;
      field.setAttribute('x', right - width * reach);
      field.setAttribute('y', heroY - height * reach / 2);
      field.setAttribute('width', width * reach);
      field.setAttribute('height', height * reach);
      beyond.setAttribute('x', right);
      beyond.setAttribute('y', heroY - height * reach / 2);
      beyond.setAttribute('width', width * reach);
      beyond.setAttribute('height', height * reach);
      // На месте героини в узоре — пустое место, её рисует отдельный круг.
      Object.entries({ cx: heroX, cy: heroY, r: dotR + 1 }).forEach(([name, value]) => hole.setAttribute(name, value));
    }

    layout = {
      key,
      unit,
      originX,
      originY,
      width,
      exit: width + 2 * step,
      hero: { x: left + heroCol * step, y: top + heroRow * step },
      grey: parseColor(style.getPropertyValue('--dot') || '#c0c2b6'),
      accent: parseColor(style.getPropertyValue('--story-accent') || '#ee492c'),
      view: {
        halfW: width / 2 / unit,
        halfH: height / 2 / unit,
        centerY: (height / 2 - originY) / unit,
        dotR: dotR / unit,
        start: { x: (left + heroCol * step - originX) / unit, y: (top + heroRow * step - originY) / unit },
      },
    };
    lastKey = '';
  }

  function placeSquare(node, shape) {
    const { unit, originX, originY } = layout;
    const side = shape.size * unit;
    node.setAttribute('x', (originX + shape.x * unit - side / 2).toFixed(2));
    node.setAttribute('y', (originY + shape.y * unit - side / 2).toFixed(2));
    node.setAttribute('width', side.toFixed(2));
    node.setAttribute('height', side.toFixed(2));
    node.setAttribute('visibility', shape.visible ? 'visible' : 'hidden');
  }

  function render(progress, grow = 0, intro = 1) {
    if (!layout) measure();
    if (!layout) return;
    const key = `${layout.key}:${progress.toFixed(4)}:${grow.toFixed(4)}:${intro.toFixed(4)}`;
    if (key === lastKey) return;
    lastKey = key;
    const frame = storyFrame(progress, layout.view);
    if (grow > 0) frame.big = growSquare(frame.big, grow, layout.view);
    const textLeft = 1 - clamp(grow / .3);
    const { unit, originX, originY, grey, accent } = layout;
    // Камера: масштаб вокруг героини и пролёт; в истории поле уезжает влево,
    // и точка выбегает за его край.
    const camera = introFrame(intro);
    const { hero, width } = layout;
    const pan = camera.pan * width;
    const shift = (1 - frame.dots) * layout.exit;
    dotsLayer.setAttribute('transform', `translate(${hero.x.toFixed(2)} ${hero.y.toFixed(2)}) scale(${camera.zoom.toFixed(4)}) translate(${(pan - shift - hero.x).toFixed(2)} ${(-hero.y).toFixed(2)})`);
    dotsLayer.setAttribute('visibility', frame.dots > 0 ? 'visible' : 'hidden');
    beyond.setAttribute('visibility', intro < 1 ? 'visible' : 'hidden');
    placeSquare(big, frame.big);
    placeSquare(small, frame.small);
    const tint = frame.circle.tint;
    const [r, g, b] = grey.map((value, index) => Math.round(value + (accent[index] - value) * tint));
    // Пока идёт пролёт, героиня — одна из точек поля и летит вместе с ним.
    circle.setAttribute('cx', (originX + frame.circle.x * unit + pan * camera.zoom).toFixed(2));
    circle.setAttribute('cy', (originY + frame.circle.y * unit).toFixed(2));
    circle.setAttribute('r', (frame.circle.r * unit * camera.zoom).toFixed(2));
    const fill = `rgb(${r} ${g} ${b})`;
    circle.setAttribute('fill', fill);
    small.setAttribute('fill', fill);
    frame.copy.forEach((value, index) => section.style.setProperty(`--story-copy-${index + 1}`, (value * textLeft).toFixed(3)));
  }

  // Доля прокрутки секции после первого экрана.
  function scrollProgress() {
    const { top } = section.getBoundingClientRect();
    return clamp(-top / Math.max(1, section.offsetHeight - innerHeight));
  }

  // Вызывается при прокрутке и смене размеров. Без движения сцена стоит в последнем кадре истории.
  function check() {
    if (isStatic()) { render(1, 0, 1); return; }
    const { intro, progress, grow } = storyScroll(scrollProgress());
    render(progress, grow, intro);
  }

  return {
    layout() { measure(); },
    check,
    reset() {
      lastKey = '';
      check();
    },
  };
}
