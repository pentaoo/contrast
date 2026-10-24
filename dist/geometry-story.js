// История жёлтой точки: поле точек → круг, большой и маленький квадрат.
// Кадр зависит только от прогресса прокрутки: одинаковый прогресс — одинаковый кадр.

const SVG = 'http://www.w3.org/2000/svg';
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const ease = (t) => t * t * (3 - 2 * t);
const span = (p, from, to) => ease(clamp((p - from) / (to - from)));

// Размеры в единицах сцены: диаметр круга — 1.
export const SIZES = { circle: 1, small: 1.6, big: 3.3 };

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

// view: половины ширины и высоты окна, место точки в сетке и радиус обычной точки — всё в единицах сцены.
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
    [.27, leftOut, 0],
    [.32, -3.2, 0],
    [.36, -3.2, 0],
    [.39, -1, 0],
    [.435, -1, 0],
    [.465, 1.4, -2.2], // перекрывает путь
    [.5, 1.4, -2.2],
    [.535, 2.2, -.8],
    [.645, 2.2, -.8],
    [.665, 1.6, -.8], // ответ на маленький квадрат
    [.68, 1.6, -.8],
    [.71, 2.4, -.6],
    [.735, 2.4, -.6],
    [.78, 2.2, -2.6], // за маленьким, вверх
    [.885, 2.2, -2.6],
    [.93, .2, -1.2], // поздно оборачивается
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

  const circle = p < .17 ? { x: start.x, y: start.y } : track(p, circleKeys);
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

export function mountGeometryStory(section) {
  const svg = section.querySelector('#story-canvas');
  const dotsLayer = create('g');
  const big = create('rect');
  const small = create('rect');
  const circle = create('circle');
  svg.replaceChildren(dotsLayer, big, small, circle);

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
      const dots = [];
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          if (row === heroRow && col === heroCol) continue;
          dots.push(create('circle', { cx: left + col * step, cy: top + row * step, r: dotR }));
        }
      }
      dotsLayer.replaceChildren(...dots);
    }

    layout = {
      key,
      unit,
      originX,
      originY,
      grey: parseColor(style.getPropertyValue('--dot') || '#c0c2b6'),
      yellow: parseColor(style.getPropertyValue('--story-yellow') || '#d99c12'),
      view: {
        halfW: width / 2 / unit,
        halfH: height / 2 / unit,
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

  function update(progress) {
    if (!layout) measure();
    if (!layout) return;
    const key = `${layout.key}:${progress.toFixed(4)}`;
    if (key === lastKey) return;
    lastKey = key;
    const frame = storyFrame(progress, layout.view);
    const { unit, originX, originY, grey, yellow } = layout;
    dotsLayer.setAttribute('opacity', frame.dots.toFixed(3));
    dotsLayer.setAttribute('visibility', frame.dots > 0 ? 'visible' : 'hidden');
    placeSquare(big, frame.big);
    placeSquare(small, frame.small);
    const tint = frame.circle.tint;
    const [r, g, b] = grey.map((value, index) => Math.round(value + (yellow[index] - value) * tint));
    circle.setAttribute('cx', (originX + frame.circle.x * unit).toFixed(2));
    circle.setAttribute('cy', (originY + frame.circle.y * unit).toFixed(2));
    circle.setAttribute('r', (frame.circle.r * unit).toFixed(2));
    circle.setAttribute('fill', `rgb(${r} ${g} ${b})`);
    frame.copy.forEach((value, index) => section.style.setProperty(`--story-copy-${index + 1}`, value.toFixed(3)));
  }

  return {
    layout() { measure(); },
    update,
    reset() { lastKey = ''; },
  };
}
