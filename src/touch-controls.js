// Pointer ownership is independent for the left thumb and every right-thumb action.
// A skill fires on touch-down, not a delayed compatibility click on touch-up.
const zero = () => ({ x: 0, y: 0 });

export function stickVector(dx, dy, radius, deadzone = .14) {
  if (![dx, dy, radius].every(Number.isFinite) || radius <= 0) return { ...zero(), thumbX: 0, thumbY: 0 };
  const distance = Math.hypot(dx, dy), scale = distance > radius ? radius / distance : 1;
  const thumbX = dx * scale, thumbY = dy * scale;
  if (distance <= radius * deadzone) return { ...zero(), thumbX, thumbY };
  return { x: thumbX / radius, y: thumbY / radius, thumbX, thumbY };
}

export function canTrackStick(state) { return ['playing', 'countdown', 'transition'].includes(state); }

export function mergeMovement(keyboard, touch = zero()) {
  // Releasing either input source must not release the other source.
  return keyboard.x || keyboard.y ? { ...keyboard } : { x: touch.x, y: touch.y };
}

export class Thumbstick {
  constructor() { this.reset(); }
  reset() { this.pointerId = null; this.origin = null; this.value = { ...zero(), thumbX: 0, thumbY: 0 }; }
  start(pointerId, point, rect) {
    if (this.pointerId !== null || !rect || rect.width <= 0 || rect.height <= 0) return false;
    this.pointerId = pointerId;
    this.origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius: Math.min(rect.width, rect.height) * .28 };
    this.move(pointerId, point);
    return true;
  }
  move(pointerId, point) {
    if (pointerId !== this.pointerId || !this.origin) return false;
    this.value = stickVector(point.x - this.origin.x, point.y - this.origin.y, this.origin.radius);
    return true;
  }
  end(pointerId) {
    if (this.pointerId === null || pointerId !== this.pointerId) return false;
    this.reset();
    return true;
  }
}

export function bindBattleTouch({ stick, root, canMove, onAction, onPressChange = () => {}, now = () => Date.now() }) {
  const doc = stick.ownerDocument, win = doc.defaultView, thumb = new Thumbstick();
  const pressed = new Map(), suppressClickUntil = new WeakMap();
  const listeners = [];
  const listen = (target, type, fn, options) => { target.addEventListener(type, fn, options); listeners.push(() => target.removeEventListener(type, fn, options)); };
  const capture = (element, id) => { try { element.setPointerCapture?.(id); } catch {} };
  const release = (element, id) => { try { if (element.hasPointerCapture?.(id)) element.releasePointerCapture(id); } catch {} };
  const actionButton = event => {
    const button = event.target?.closest?.('[data-action]');
    return button && root.contains(button) ? button : null;
  };
  const paintStick = () => {
    stick.style.setProperty('--stick-x', `${thumb.value.thumbX.toFixed(2)}px`);
    stick.style.setProperty('--stick-y', `${thumb.value.thumbY.toFixed(2)}px`);
    const active = thumb.pointerId !== null;
    stick.classList.toggle('is-active', active);
    stick.dataset.active = String(active);
  };
  const endPress = id => {
    const entry = pressed.get(id);
    if (!entry) return;
    pressed.delete(id);
    entry.button.classList.remove('touch-held');
    suppressClickUntil.set(entry.button, now() + 900);
    onPressChange(id, entry.action, false);
    release(entry.button, id);
  };
  const resetActions = () => { for (const id of [...pressed.keys()]) endPress(id); };
  const reset = () => {
    const id = thumb.pointerId;
    thumb.reset();
    paintStick();
    if (id !== null) release(stick, id);
    resetActions();
  };
  listen(stick, 'pointerdown', event => {
    if (!canMove() || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    if (thumb.start(event.pointerId, { x: event.clientX, y: event.clientY }, stick.getBoundingClientRect())) {
      capture(stick, event.pointerId);
      paintStick();
    }
  });
  listen(win, 'pointermove', event => {
    if (event.pointerId !== thumb.pointerId) return;
    if (!canMove()) { reset(); return; }
    event.preventDefault();
    thumb.move(event.pointerId, { x: event.clientX, y: event.clientY });
    paintStick();
  }, { passive: false });
  const endPointer = event => {
    if (thumb.end(event.pointerId)) { paintStick(); release(stick, event.pointerId); }
    endPress(event.pointerId);
  };
  for (const type of ['pointerup', 'pointercancel']) listen(win, type, endPointer);
  listen(stick, 'lostpointercapture', endPointer);
  listen(root, 'lostpointercapture', event => endPress(event.pointerId));
  listen(root, 'pointerdown', event => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    const button = actionButton(event);
    if (!button || button.disabled) return;
    event.preventDefault();
    if ([...pressed.values()].some(entry => entry.button === button)) return;
    const action = button.dataset.action;
    pressed.set(event.pointerId, { button, action });
    suppressClickUntil.set(button, now() + 900);
    button.classList.add('touch-held');
    onPressChange(event.pointerId, action, true);
    capture(button, event.pointerId);
    onAction(action, event);
  });
  listen(root, 'click', event => {
    const button = actionButton(event);
    if (!button) return;
    const touchClick = event.pointerType === 'touch' || event.pointerType === 'pen' || event.sourceCapabilities?.firesTouchEvents;
    if (touchClick || (event.detail !== 0 && (suppressClickUntil.get(button) || 0) > now())) {
      event.preventDefault();
      return;
    }
    if (!button.disabled) onAction(button.dataset.action, event);
  });
  listen(root, 'contextmenu', event => { if (actionButton(event) || stick.contains(event.target)) event.preventDefault(); });
  listen(root, 'dragstart', event => event.preventDefault());
  listen(win, 'blur', reset);
  listen(doc, 'visibilitychange', () => { if (doc.hidden) reset(); });
  paintStick();
  return {
    get input() { return { x: thumb.value.x, y: thumb.value.y }; },
    getState: () => ({ active: thumb.pointerId !== null, vector: { x: thumb.value.x, y: thumb.value.y }, actions: [...pressed.values()].map(entry => entry.action) }),
    reset,
    resetActions,
    destroy() { reset(); for (const remove of listeners) remove(); },
  };
}
