const directions = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
const selector = 'a[href],button,input,select,textarea,summary,[tabindex="0"]';

function controls(root) {
  return [...root.querySelectorAll(selector)].filter(element =>
    !element.matches(':disabled') &&
    !element.closest('[hidden], [inert], iframe') &&
    element.getClientRects().length > 0);
}

export function focusTV(root) {
  if (document.activeElement !== document.body && document.activeElement?.getClientRects().length) return;
  const surface = document.querySelector('dialog[open]') || root;
  const target = surface.querySelector('nav a[aria-current="page"]') || controls(surface)[0];
  target?.focus();
}

export function enableTVNavigation(root) {
  document.documentElement.dataset.formFactor = 'tv';
  document.addEventListener('keydown', event => {
    const direction = directions[event.key];
    if (!direction || event.defaultPrevented) return;
    const current = document.activeElement;
    if (current?.matches('input:not([type="checkbox"]):not([type="radio"]),textarea,select,[contenteditable="true"]')) return;
    const surface = document.querySelector('dialog[open]') || root;
    const options = controls(surface);
    if (!options.includes(current)) {
      if (options.length) {event.preventDefault(); options[0].focus();}
      return;
    }
    event.preventDefault();
    const [dx, dy] = direction;
    const from = current.getBoundingClientRect();
    let target, best = Infinity;
    for (const option of options) {
      if (option === current) continue;
      const to = option.getBoundingClientRect();
      const x = (to.left + to.right - from.left - from.right) / 2;
      const y = (to.top + to.bottom - from.top - from.bottom) / 2;
      const forward = x * dx + y * dy;
      if (forward <= 3) continue;
      const score = forward + Math.abs(x * dy + y * dx) * 3;
      if (score < best) {best = score; target = option;}
    }
    target?.focus({preventScroll:true});
    target?.scrollIntoView({block:'nearest',inline:'nearest'});
  });
}
