import './style.css';
import { setupGame, start, handleCanvasClick, draw, cleanup } from './game.ts';
import { assetPaths, setAssets } from './game/assets.ts';
import { camera } from './camera/autoFrame.ts';
import type { PixelCoord } from './hex/HexUtils.ts';
import { loadResources } from './lib/loadResources.ts';
import { loadAssets } from './loader.ts';
import { preloadSaunojaIcon } from './units/renderSaunoja.ts';

const MIN_CAMERA_ZOOM = 0.5;
const MAX_CAMERA_ZOOM = 3.5;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const TOUCH_TAP_MAX_MOVEMENT = 10;
const TOUCH_TAP_MAX_DURATION = 250;

interface TouchGestureState {
  mode: 'pan' | 'pinch';
  lastX?: number;
  lastY?: number;
  lastCenter?: { x: number; y: number };
  lastDistance?: number;
  startX?: number;
  startY?: number;
  startTime: number;
  moved: boolean;
}

function applyBuildIdentity(): void {
  if (typeof document === 'undefined') {
    return;
  }

  const buildValueElement = document.querySelector<HTMLElement>('[data-build-commit]');
  if (!buildValueElement) {
    return;
  }

  const rawCommit = typeof __COMMIT__ === 'string' ? __COMMIT__.trim() : '';
  const isCommitAvailable = rawCommit.length > 0 && rawCommit !== 'unknown';

  const displayValue = isCommitAvailable ? `#${rawCommit}` : 'DEV BUILD';
  buildValueElement.textContent = displayValue;
  buildValueElement.dataset.state = isCommitAvailable ? 'commit' : 'dev';

  const container = buildValueElement.closest<HTMLElement>('#build-id');
  if (container) {
    const accessibleLabel = isCommitAvailable
      ? `Build commit ${rawCommit}`
      : 'Development build';
    container.setAttribute('aria-label', accessibleLabel);
    container.title = isCommitAvailable
      ? `Autobattles build ${rawCommit}`
      : 'Unversioned development build';
    container.dataset.buildState = isCommitAvailable ? 'release' : 'development';
  }
}

applyBuildIdentity();

const cleanupHandlers: Array<() => void> = [];

let initToken = 0;

let canvasRef: HTMLCanvasElement | null = null;
let isInitialized = false;
let touchState: TouchGestureState | null = null;

const pointerPanState: {
  active: boolean;
  pointerId: number | null;
  lastX: number;
  lastY: number;
} = {
  active: false,
  pointerId: null,
  lastX: 0,
  lastY: 0,
};

export { camera };
export const MIN_ZOOM = MIN_CAMERA_ZOOM;
export const MAX_ZOOM = MAX_CAMERA_ZOOM;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_CAMERA_ZOOM, Math.max(MIN_CAMERA_ZOOM, zoom));
}

function addCleanup(fn: () => void): void {
  cleanupHandlers.push(fn);
}

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): void {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(window.innerWidth, 1);
  const height = Math.max(window.innerHeight, 1);

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  draw();
}

function screenToWorldWith(
  canvas: HTMLCanvasElement,
  screenX: number,
  screenY: number,
  zoom: number,
  center: PixelCoord
): PixelCoord {
  const rect = canvas.getBoundingClientRect();
  const offsetX = screenX - rect.left;
  const offsetY = screenY - rect.top;
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  return {
    x: center.x + (offsetX - halfWidth) / zoom,
    y: center.y + (offsetY - halfHeight) / zoom,
  };
}

export function screenToWorld(
  canvas: HTMLCanvasElement,
  screenX: number,
  screenY: number,
  zoom = camera.zoom,
  center: PixelCoord = camera
): PixelCoord {
  return screenToWorldWith(canvas, screenX, screenY, zoom, center);
}

export function applyZoomAtPoint(canvas: HTMLCanvasElement, screenX: number, screenY: number, targetZoom: number): void {
  const clamped = clampZoom(targetZoom);
  if (clamped === camera.zoom) return;

  const currentCenter = { x: camera.x, y: camera.y };
  const before = screenToWorldWith(canvas, screenX, screenY, camera.zoom, currentCenter);
  const after = screenToWorldWith(canvas, screenX, screenY, clamped, currentCenter);

  camera.x += before.x - after.x;
  camera.y += before.y - after.y;
  camera.zoom = clamped;
  draw();
}

export function panCameraByScreenDelta(dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  camera.x -= dx / camera.zoom;
  camera.y -= dy / camera.zoom;
  draw();
}

function onWheel(event: WheelEvent): void {
  if (!canvasRef) return;
  event.preventDefault();
  const scaleFactor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);
  const targetZoom = camera.zoom * scaleFactor;
  applyZoomAtPoint(canvasRef, event.clientX, event.clientY, targetZoom);
}

function onPointerDown(event: PointerEvent): void {
  if (!canvasRef) return;
  if (event.pointerType !== 'mouse' || event.button !== 0) return;
  pointerPanState.active = true;
  pointerPanState.pointerId = event.pointerId;
  pointerPanState.lastX = event.clientX;
  pointerPanState.lastY = event.clientY;
  canvasRef.setPointerCapture?.(event.pointerId);
  canvasRef.style.cursor = 'grabbing';
}

function onPointerMove(event: PointerEvent): void {
  if (!canvasRef) return;
  if (!pointerPanState.active || pointerPanState.pointerId !== event.pointerId) return;
  const dx = event.clientX - pointerPanState.lastX;
  const dy = event.clientY - pointerPanState.lastY;
  pointerPanState.lastX = event.clientX;
  pointerPanState.lastY = event.clientY;
  panCameraByScreenDelta(dx, dy);
}

function onPointerUp(event: PointerEvent): void {
  if (!canvasRef) return;
  if (!pointerPanState.active || pointerPanState.pointerId !== event.pointerId) return;
  pointerPanState.active = false;
  pointerPanState.pointerId = null;
  canvasRef.releasePointerCapture?.(event.pointerId);
  canvasRef.style.cursor = '';
}

function isTapGesture(state: TouchGestureState): boolean {
  if (!canvasRef) return false;
  if (state.mode !== 'pan' || state.startX == null || state.startY == null) return false;
  const movedTooFar = state.moved && Math.hypot((state.lastX ?? state.startX) - state.startX, (state.lastY ?? state.startY) - state.startY) > TOUCH_TAP_MAX_MOVEMENT;
  if (movedTooFar) return false;
  const duration = now() - state.startTime;
  return duration <= TOUCH_TAP_MAX_DURATION;
}

function fireTap(state: TouchGestureState): void {
  if (!canvasRef || state.startX == null || state.startY == null) return;
  const world = screenToWorld(canvasRef, state.startX, state.startY);
  handleCanvasClick(world);
}

function handlePanTouch(touch: Touch): void {
  if (!touchState) return;
  const dx = touch.clientX - (touchState.lastX ?? touch.clientX);
  const dy = touch.clientY - (touchState.lastY ?? touch.clientY);
  if (Math.hypot(dx, dy) > 1) {
    touchState.moved = true;
  }
  touchState.lastX = touch.clientX;
  touchState.lastY = touch.clientY;
  panCameraByScreenDelta(dx, dy);
}

function handlePinchTouches(t0: Touch, t1: Touch): void {
  if (!canvasRef) return;
  const centerX = (t0.clientX + t1.clientX) / 2;
  const centerY = (t0.clientY + t1.clientY) / 2;
  const distance = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);

  if (touchState?.lastDistance) {
    const zoomFactor = distance / touchState.lastDistance;
    const targetZoom = camera.zoom * zoomFactor;
    applyZoomAtPoint(canvasRef, centerX, centerY, targetZoom);
  }

  if (touchState?.lastCenter) {
    const dx = centerX - touchState.lastCenter.x;
    const dy = centerY - touchState.lastCenter.y;
    panCameraByScreenDelta(dx, dy);
  }

  if (!touchState) {
    touchState = {
      mode: 'pinch',
      lastCenter: { x: centerX, y: centerY },
      lastDistance: distance,
      startTime: now(),
      moved: true,
    };
  } else {
    touchState.mode = 'pinch';
    touchState.lastCenter = { x: centerX, y: centerY };
    touchState.lastDistance = distance;
    touchState.moved = true;
  }
}

function onTouchStart(event: TouchEvent): void {
  if (!canvasRef) return;
  if (event.touches.length === 1) {
    const touch = event.touches[0];
    touchState = {
      mode: 'pan',
      lastX: touch.clientX,
      lastY: touch.clientY,
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: now(),
      moved: false,
    };
  } else if (event.touches.length >= 2) {
    const [t0, t1] = [event.touches[0], event.touches[1]];
    touchState = {
      mode: 'pinch',
      lastCenter: { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 },
      lastDistance: Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY),
      startTime: now(),
      moved: false,
    };
  }
}

function onTouchMove(event: TouchEvent): void {
  if (!canvasRef || !touchState) return;
  if (event.touches.length === 0) return;
  event.preventDefault();
  if (event.touches.length === 1) {
    const touch = event.touches[0];
    if (touchState.mode !== 'pan') {
      const transitionedFromPinch = touchState.mode === 'pinch';
      touchState = {
        mode: 'pan',
        lastX: touch.clientX,
        lastY: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: now(),
        moved: transitionedFromPinch,
      };
    }
    handlePanTouch(touch);
  } else {
    const [t0, t1] = [event.touches[0], event.touches[1]];
    handlePinchTouches(t0, t1);
  }
}

function onTouchEnd(event: TouchEvent): void {
  if (!canvasRef || !touchState) return;
  if (event.touches.length === 0) {
    if (isTapGesture(touchState)) {
      fireTap(touchState);
    }
    touchState = null;
    return;
  }

  if (event.touches.length === 1) {
    const touch = event.touches[0];
    const transitionedFromPinch = touchState.mode === 'pinch';
    touchState = {
      mode: 'pan',
      lastX: touch.clientX,
      lastY: touch.clientY,
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: now(),
      moved: transitionedFromPinch,
    };
  } else if (event.touches.length >= 2) {
    const [t0, t1] = [event.touches[0], event.touches[1]];
    touchState = {
      mode: 'pinch',
      lastCenter: { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 },
      lastDistance: Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY),
      startTime: now(),
      moved: true,
    };
  }
}

function onCanvasClick(event: MouseEvent): void {
  if (!canvasRef) return;
  const world = screenToWorld(canvasRef, event.clientX, event.clientY);
  handleCanvasClick(world);
}

function attachCanvasListeners(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('click', onCanvasClick);
  addCleanup(() => canvas.removeEventListener('click', onCanvasClick));

  canvas.addEventListener('wheel', onWheel, { passive: false });
  addCleanup(() => canvas.removeEventListener('wheel', onWheel));

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);
  addCleanup(() => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('pointerleave', onPointerUp);
  });

  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);
  canvas.addEventListener('touchcancel', onTouchEnd);
  addCleanup(() => {
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
    canvas.removeEventListener('touchcancel', onTouchEnd);
  });
}

function clearCleanupHandlers(): void {
  while (cleanupHandlers.length) {
    const fn = cleanupHandlers.pop();
    try {
      fn?.();
    } catch (err) {
      console.error('Error during cleanup', err);
    }
  }
}

export function destroy(): void {
  initToken += 1;
  clearCleanupHandlers();
  pointerPanState.active = false;
  pointerPanState.pointerId = null;
  if (canvasRef) {
    canvasRef.style.cursor = '';
  }
  touchState = null;
  canvasRef = null;
  isInitialized = false;
  removeTransientUI();
  cleanup();
}

function removeTransientUI(): void {
  document.querySelectorAll('.hud-loader').forEach((element) => {
    element.remove();
  });
  document.querySelectorAll('.hud-banner-stack').forEach((element) => {
    element.remove();
  });
}

interface LoadingHandle {
  update(message: string): void;
  clear(): void;
  dispose(): void;
}

function showLoadingUI(message = 'Heating the sauna stones…'): LoadingHandle {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) {
    return {
      update: () => undefined,
      clear: () => undefined,
      dispose: () => undefined,
    };
  }

  const loader = document.createElement('div');
  loader.className = 'hud-loader';
  loader.setAttribute('role', 'status');
  loader.setAttribute('aria-live', 'polite');

  const card = document.createElement('div');
  card.className = 'hud-loader__card';

  const spinner = document.createElement('div');
  spinner.className = 'hud-loader__spinner';
  spinner.setAttribute('aria-hidden', 'true');

  const messageElement = document.createElement('p');
  messageElement.className = 'hud-loader__message';
  messageElement.textContent = message;

  card.append(spinner, messageElement);
  loader.append(card);
  overlay.append(loader);

  let dismissed = false;

  return {
    update(text: string) {
      messageElement.textContent = text;
    },
    clear() {
      if (dismissed) {
        return;
      }
      animateRemoval(loader, 'hud-loader--hidden', () => {
        dismissed = true;
        loader.remove();
      });
    },
    dispose() {
      if (dismissed) {
        return;
      }
      dismissed = true;
      loader.remove();
    },
  };
}

type BannerType = 'info' | 'warning' | 'error';

interface BannerAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface BannerOptions {
  title?: string;
  messages: string[];
  actions?: BannerAction[];
  dismissible?: boolean;
  autoCloseMs?: number;
}

interface BannerHandle {
  element: HTMLElement;
  dismiss: () => void;
}

function showBanner(type: BannerType, options: BannerOptions): BannerHandle | null {
  const stack = ensureBannerStack();
  if (!stack) {
    return null;
  }

  const banner = document.createElement('section');
  banner.className = `hud-banner hud-banner--${type}`;
  banner.setAttribute('role', type === 'error' ? 'alert' : 'status');
  banner.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

  const header = document.createElement('header');
  header.className = 'hud-banner__header';

  const title = document.createElement('p');
  title.className = 'hud-banner__title';
  title.textContent =
    options.title ??
    (type === 'error' ? 'Attention required' : type === 'warning' ? 'Heads up' : 'Status update');
  header.append(title);

  const list = document.createElement('ul');
  list.className = 'hud-banner__list';
  for (const message of options.messages) {
    const item = document.createElement('li');
    item.textContent = message;
    list.append(item);
  }

  banner.append(header);
  if (options.messages.length) {
    banner.append(list);
  }

  if (options.actions?.length) {
    const actions = document.createElement('div');
    actions.className = 'hud-banner__actions';
    for (const action of options.actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className =
        action.variant === 'secondary'
          ? 'hud-banner__button hud-banner__button--secondary'
          : 'hud-banner__button';
      button.textContent = action.label;
      button.addEventListener('click', () => {
        action.onClick();
      });
      actions.append(button);
    }
    banner.append(actions);
  }

  let autoDismissId: number | undefined;
  let dismissed = false;

  const dismiss = () => {
    if (dismissed) {
      return;
    }
    dismissed = true;
    if (autoDismissId) {
      window.clearTimeout(autoDismissId);
    }
    animateRemoval(banner, 'hud-banner--hide', () => {
      banner.remove();
      if (!stack.hasChildNodes()) {
        stack.remove();
      }
    });
  };

  if (options.dismissible !== false) {
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'hud-banner__close';
    closeButton.setAttribute('aria-label', 'Dismiss notification');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => {
      dismiss();
    });
    header.append(closeButton);
  }

  stack.append(banner);

  if (options.autoCloseMs && options.autoCloseMs > 0) {
    autoDismissId = window.setTimeout(() => dismiss(), options.autoCloseMs);
  }

  return {
    element: banner,
    dismiss,
  };
}

function ensureBannerStack(): HTMLElement | null {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) {
    return null;
  }

  let stack = overlay.querySelector<HTMLElement>('.hud-banner-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'hud-banner-stack';
    overlay.append(stack);
  }
  return stack;
}

function animateRemoval(element: HTMLElement, hiddenClass: string, onComplete: () => void): void {
  let finished = false;
  const finalize = () => {
    if (finished) {
      return;
    }
    finished = true;
    element.removeEventListener('transitionend', finalize);
    onComplete();
  };

  element.addEventListener('transitionend', finalize);
  requestAnimationFrame(() => {
    element.classList.add(hiddenClass);
  });
  window.setTimeout(finalize, 400);
}

function formatError(reason: unknown): string {
  if (reason instanceof Error && reason.message) {
    return reason.message;
  }
  if (typeof reason === 'string' && reason.trim().length > 0) {
    return reason;
  }
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}

async function prepareAndStart(runToken: number): Promise<void> {
  const loader = showLoadingUI('Heating the sauna stones…');
  addCleanup(() => loader.dispose());

  try {
    const { resources, warnings, errors } = await loadResources({
      assets: {
        label: 'Core assets',
        load: async () => {
          const result = await loadAssets(assetPaths);
          return { value: result.assets, errors: result.failures };
        },
      },
      saunojaIcon: {
        label: 'Saunoja icon',
        load: async () => {
          try {
            const icon = await preloadSaunojaIcon();
            return { value: icon };
          } catch (error) {
            return {
              value: null,
              warnings: [`Unable to preload Saunoja icon (${formatError(error)})`],
            };
          }
        },
      },
    });

    if (runToken !== initToken) {
      loader.dispose();
      return;
    }

    loader.update('Polishing sauna ambience…');
    loader.clear();

    const loadedAssets = resources.assets;

    if (!loadedAssets) {
      const fatalMessages = errors.length
        ? [...errors]
        : ['Critical assets were unavailable. Please refresh to try again.'];
      console.error('Critical assets failed to load', fatalMessages);
      const fatalBanner = showBanner('error', {
        title: 'Unable to start the sauna battle',
        messages: fatalMessages,
        actions: [
          {
            label: 'Reload',
            onClick: () => window.location.reload(),
            variant: 'primary',
          },
        ],
        dismissible: false,
      });
      if (fatalBanner) {
        addCleanup(() => fatalBanner.dismiss());
      }
      return;
    }

    if (errors.length) {
      console.error('Resource loader errors', errors);
      const errorBanner = showBanner('error', {
        title: 'Some resources failed to load',
        messages: errors,
        actions: [
          {
            label: 'Reload',
            onClick: () => window.location.reload(),
            variant: 'primary',
          },
        ],
      });
      if (errorBanner) {
        addCleanup(() => errorBanner.dismiss());
      }
    }

    if (warnings.length) {
      console.warn('Resource loader warnings', warnings);
      const warningBanner = showBanner('warning', {
        title: 'Heads up',
        messages: warnings,
        autoCloseMs: 12000,
      });
      if (warningBanner) {
        addCleanup(() => warningBanner.dismiss());
      }
    }

    setAssets(loadedAssets);
    start();
  } catch (error) {
    if (runToken !== initToken) {
      loader.dispose();
      return;
    }
    console.error('Failed to initialize resources', error);
    loader.clear();
    const banner = showBanner('error', {
      title: 'Failed to initialize',
      messages: [formatError(error)],
      actions: [
        {
          label: 'Reload',
          onClick: () => window.location.reload(),
          variant: 'primary',
        },
      ],
    });
    if (banner) {
      addCleanup(() => banner.dismiss());
    }
  }
}

export function init(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  const resourceBar = document.getElementById('resource-bar');
  if (!canvas || !resourceBar) {
    console.error(
      'Autobattles4xFinsauna shell is missing the required canvas or resource bar elements.',
      {
        hasCanvas: Boolean(canvas),
        hasResourceBar: Boolean(resourceBar),
      }
    );
    return;
  }

  if (isInitialized) {
    destroy();
  }

  const runToken = ++initToken;

  canvasRef = canvas;
  isInitialized = true;

  setupGame(canvas, resourceBar);
  attachCanvasListeners(canvas);

  const resize = () => resizeCanvasToDisplaySize(canvas);
  window.addEventListener('resize', resize);
  addCleanup(() => window.removeEventListener('resize', resize));

  window.addEventListener('beforeunload', cleanup);
  addCleanup(() => window.removeEventListener('beforeunload', cleanup));

  resize();

  if (!import.meta.vitest) {
    void prepareAndStart(runToken);
  }
}

function initWhenDomReady(): void {
  if (typeof document === 'undefined') {
    return;
  }

  const start = () => {
    document.removeEventListener('DOMContentLoaded', start);
    init();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
    return;
  }

  start();
}

if (!import.meta.vitest) {
  initWhenDomReady();
}

