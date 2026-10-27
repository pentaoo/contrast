// Non-sticky regions keep the same identity when scenes switch to static layouts.
const regions = '.hero, .origin-scroll, .attention-scene, .sound-track, #sound-explanation > .sound-step, .stranger-scroll, .sources-scroll, #conclusion, .webring-zone';

export function mountReadingPosition({ viewport = window, root = document } = {}) {
  let saved;

  function viewportChanged() {
    return Boolean(saved && (saved.width !== viewport.innerWidth || saved.height !== viewport.innerHeight));
  }

  function capture() {
    // Resize can clamp scrollY to the new page bottom before its event arrives.
    // Keep the last position from the old viewport until layout is restored.
    if (viewportChanged()) return;
    const entries = [...root.querySelectorAll(regions)].map((element) => ({ element, rect: element.getBoundingClientRect() }));
    const anchor = entries.findLast(({ rect }) => rect.top <= 1 && rect.height > 0) || entries[0];
    if (!anchor || !anchor.rect.height) return;
    saved = {
      element: anchor.element,
      progress: Math.max(0, -anchor.rect.top / anchor.rect.height),
      width: viewport.innerWidth,
      height: viewport.innerHeight
    };
  }

  function restore() {
    if (!viewportChanged()) return false;
    const rect = saved.element.getBoundingClientRect();
    const top = viewport.scrollY + rect.top + saved.progress * rect.height;
    viewport.scrollTo({ top, behavior: 'instant' });
    saved = undefined;
    capture();
    return true;
  }

  return { capture, restore, viewportChanged };
}
