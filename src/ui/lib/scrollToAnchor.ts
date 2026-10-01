let cancelActive: (() => void) | null = null;

/**
 * Scrolls a section into view and keeps it there while lazy-loaded content above it
 * (charts) settles and changes the page height. Stops as soon as the user interacts,
 * the route changes, another anchor scroll starts, or after `settleMs`.
 */
export function scrollToAnchor(id: string, settleMs = 2000): void {
  cancelActive?.();
  const go = () => document.getElementById(id)?.scrollIntoView({ block: 'start' });
  go();
  if (typeof ResizeObserver === 'undefined') return;
  const observer = new ResizeObserver(go);
  observer.observe(document.body);
  const stopEvents = ['touchstart', 'pointerdown', 'wheel', 'keydown', 'hashchange'] as const;
  const stop = () => {
    observer.disconnect();
    window.clearTimeout(timer);
    stopEvents.forEach((type) => window.removeEventListener(type, stop));
    if (cancelActive === stop) cancelActive = null;
  };
  stopEvents.forEach((type) => window.addEventListener(type, stop, { passive: true }));
  const timer = window.setTimeout(stop, settleMs);
  cancelActive = stop;
}
