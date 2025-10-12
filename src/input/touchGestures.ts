export interface TouchPanHandler {
  (dx: number, dy: number, event: TouchEvent): void;
}

export interface TouchPinchDetails {
  centerX: number;
  centerY: number;
  scale: number;
  deltaCenterX: number;
  deltaCenterY: number;
}

export interface TouchPinchHandler {
  (details: TouchPinchDetails, event: TouchEvent): void;
}

export interface TouchTapHandler {
  (position: { x: number; y: number }, event: TouchEvent): void;
}

export interface TouchGestureHandlers {
  onPan: TouchPanHandler;
  onPinch: TouchPinchHandler;
  onTap?: TouchTapHandler;
}

export interface TouchGestureOptions extends TouchGestureHandlers {
  tapMaxMovement?: number;
  tapMaxDuration?: number;
}

type TouchGestureState =
  | {
      mode: 'pan';
      lastX: number;
      lastY: number;
      startX: number;
      startY: number;
      startTime: number;
      moved: boolean;
    }
  | {
      mode: 'pinch';
      lastCenterX: number;
      lastCenterY: number;
      lastDistance: number;
      startTime: number;
      moved: boolean;
    };

const DEFAULT_TAP_MAX_MOVEMENT = 10;
const DEFAULT_TAP_MAX_DURATION = 250;

type TouchEventHandler = (event: TouchEvent) => void;

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export function attachTouchGestures(
  canvas: HTMLElement,
  handlers: TouchGestureOptions
): () => void {
  const tapMaxMovement = handlers.tapMaxMovement ?? DEFAULT_TAP_MAX_MOVEMENT;
  const tapMaxDuration = handlers.tapMaxDuration ?? DEFAULT_TAP_MAX_DURATION;
  let state: TouchGestureState | null = null;

  const handleTouchStart: TouchEventHandler = (event) => {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      state = {
        mode: 'pan',
        lastX: touch.clientX,
        lastY: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: now(),
        moved: false,
      };
      return;
    }

    if (event.touches.length >= 2) {
      const [t0, t1] = [event.touches[0], event.touches[1]];
      state = {
        mode: 'pinch',
        lastCenterX: (t0.clientX + t1.clientX) / 2,
        lastCenterY: (t0.clientY + t1.clientY) / 2,
        lastDistance: Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY),
        startTime: now(),
        moved: false,
      };
    }
  };

  const handlePan = (touch: Touch, event: TouchEvent) => {
    if (!state || state.mode !== 'pan') {
      return;
    }

    const dx = touch.clientX - state.lastX;
    const dy = touch.clientY - state.lastY;
    if (!state.moved && Math.hypot(dx, dy) > 1) {
      state.moved = true;
    }
    state.lastX = touch.clientX;
    state.lastY = touch.clientY;
    handlers.onPan(dx, dy, event);
  };

  const handlePinch = (t0: Touch, t1: Touch, event: TouchEvent) => {
    const centerX = (t0.clientX + t1.clientX) / 2;
    const centerY = (t0.clientY + t1.clientY) / 2;
    const distance = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);

    let scale = 1;
    let deltaCenterX = 0;
    let deltaCenterY = 0;

    if (state && state.mode === 'pinch') {
      scale = distance / state.lastDistance;
      deltaCenterX = centerX - state.lastCenterX;
      deltaCenterY = centerY - state.lastCenterY;
    } else {
      state = {
        mode: 'pinch',
        lastCenterX: centerX,
        lastCenterY: centerY,
        lastDistance: distance,
        startTime: now(),
        moved: false,
      };
    }

    if (!state || state.mode !== 'pinch') {
      return;
    }

    state.lastCenterX = centerX;
    state.lastCenterY = centerY;
    state.lastDistance = distance;
    state.moved = true;

    handlers.onPinch({ centerX, centerY, scale, deltaCenterX, deltaCenterY }, event);
  };

  const handleTouchMove: TouchEventHandler = (event) => {
    if (!state) {
      return;
    }
    if (event.touches.length === 0) {
      return;
    }

    event.preventDefault();

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      if (state.mode !== 'pan') {
        state = {
          mode: 'pan',
          lastX: touch.clientX,
          lastY: touch.clientY,
          startX: touch.clientX,
          startY: touch.clientY,
          startTime: now(),
          moved: true,
        };
      }
      handlePan(touch, event);
      return;
    }

    const [t0, t1] = [event.touches[0], event.touches[1]];
    handlePinch(t0, t1, event);
  };

  const isTap = (): boolean => {
    if (!state || state.mode !== 'pan') {
      return false;
    }

    const movement = Math.hypot(state.lastX - state.startX, state.lastY - state.startY);
    if (movement > tapMaxMovement) {
      return false;
    }
    const duration = now() - state.startTime;
    return duration <= tapMaxDuration;
  };

  const handleTouchEnd: TouchEventHandler = (event) => {
    if (!state) {
      return;
    }

    if (event.touches.length === 0) {
      if (state.mode === 'pan' && handlers.onTap && isTap()) {
        handlers.onTap({ x: state.startX, y: state.startY }, event);
      }
      state = null;
      return;
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      state = {
        mode: 'pan',
        lastX: touch.clientX,
        lastY: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: now(),
        moved: true,
      };
      return;
    }

    if (event.touches.length >= 2) {
      const [t0, t1] = [event.touches[0], event.touches[1]];
      state = {
        mode: 'pinch',
        lastCenterX: (t0.clientX + t1.clientX) / 2,
        lastCenterY: (t0.clientY + t1.clientY) / 2,
        lastDistance: Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY),
        startTime: now(),
        moved: true,
      };
    }
  };

  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', handleTouchEnd);
  canvas.addEventListener('touchcancel', handleTouchEnd);

  return () => {
    canvas.removeEventListener('touchstart', handleTouchStart);
    canvas.removeEventListener('touchmove', handleTouchMove);
    canvas.removeEventListener('touchend', handleTouchEnd);
    canvas.removeEventListener('touchcancel', handleTouchEnd);
    state = null;
  };
}
