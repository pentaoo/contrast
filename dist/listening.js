// Мелодию запускает прокрутка: читатель доходит до дорожки, и «головка» идёт
// по нотам в обычном темпе до конца, уже без прокрутки.
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const LOOKAHEAD = .12;

// Головка идёт к цели в реальном времени; цель позади — перескок без звука.
export function advance(playhead, target, dt) {
  if (target < playhead - .05) return { playhead: target, jumped: true };
  return { playhead: Math.min(target, playhead + Math.max(0, dt)), jumped: false };
}

// Ноты, которые пора поставить в очередь: начинаются в [from, to).
export function dueEvents(events, from, to) {
  return events.filter((event) => event.at >= from && event.at < to);
}
