import './style.css';
import { setupGame, start, handleCanvasClick, cleanup } from './game.ts';
import { assetPaths, setAssets } from './game/assets.ts';
import { loadAssets } from './loader.ts';
import { createHud, type HudController, type LoadingHandle, type BannerOptions } from './ui/hud.ts';
import { ensureHudPortal } from './ui/layout.ts';
import { useIsMobile } from './ui/hooks/useIsMobile.ts';
import { createBootstrapLoader, type LoaderStatusEvent } from './bootstrap/loader.ts';
import { ensureLatestDeployment } from './bootstrap/ensureLatestDeployment.ts';
import { attachPointerPan } from './input/pointerPan.ts';
import { attachTouchGestures } from './input/touchGestures.ts';
import {
  camera,
  MIN_ZOOM,
  MAX_ZOOM,
  clampZoom,
  screenToWorld,
  applyZoomAtPoint,
  panCameraByScreenDelta,
  resizeCanvasToDisplaySize,
} from './camera/controls.ts';
import type { PixelCoord } from './hex/HexUtils.ts';

const WHEEL_ZOOM_SENSITIVITY = 0.0015;

let wheelFrameRequested = false;
let pendingWheelEvent: { clientX: number; clientY: number; deltaY: number } | null = null;

const cleanupHandlers: Array<() => void> = [];
let initToken = 0;
let canvasRef: HTMLCanvasElement | null = null;
let hud: HudController = createHud(null);
let loaderHandle: LoadingHandle | null = null;
let resourceBarRef: HTMLElement | null = null;
let overlayRef: HTMLElement | null = null;

export interface GameOrchestrator {
  setup(canvas: HTMLCanvasElement, resourceBar: HTMLElement, overlay: HTMLElement): void;
  start(): Promise<void>;
  handleCanvasClick(world: PixelCoord): void;
  cleanup(): void;
}

const gameOrchestrator: GameOrchestrator = {
  setup: setupGame,
  start,
  handleCanvasClick,
  cleanup,
};

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

void ensureLatestDeployment();

function addCleanup(fn: () => void): void {
  cleanupHandlers.push(fn);
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

function registerLoaderCleanup(handle: LoadingHandle): void {
  addCleanup(() => handle.dispose());
}

function showBanner(type: 'info' | 'warning' | 'error', options: BannerOptions): void {
  const banner = hud.showBanner(type, options);
  if (banner) {
    addCleanup(() => banner.dismiss());
  }
}

function handleLoaderEvent(event: LoaderStatusEvent): void {
  switch (event.type) {
    case 'status':
      if (event.phase === 'start') {
        loaderHandle?.dispose();
        const handle = hud.showLoader(event.message);
        loaderHandle = handle;
        registerLoaderCleanup(handle);
      } else if (loaderHandle) {
        loaderHandle.update(event.message);
        loaderHandle.clear();
        loaderHandle = null;
      }
      break;
    case 'ready':
      loaderHandle?.clear();
      loaderHandle = null;
      break;
    case 'warnings':
      if (event.warnings.length) {
        console.warn('Resource loader warnings', event.warnings);
        showBanner('warning', {
          title: 'Heads up',
          messages: event.warnings,
          autoCloseMs: 12000,
        });
      }
      break;
    case 'errors':
      if (event.errors.length) {
        console.error('Resource loader errors', event.errors);
        showBanner('error', {
          title: 'Some resources failed to load',
          messages: event.errors,
          actions: [
            {
              label: 'Reload',
              onClick: () => window.location.reload(),
              variant: 'primary',
            },
          ],
        });
      }
      break;
    case 'fatal':
      console.error('Critical assets failed to load', event.messages);
      loaderHandle?.clear();
      loaderHandle = null;
      showBanner('error', {
        title: 'Unable to start the sauna battle',
        messages: event.messages,
        actions: [
          {
            label: 'Reload',
            onClick: () => window.location.reload(),
            variant: 'primary',
          },
        ],
        dismissible: false,
      });
      break;
    case 'failure':
      console.error('Failed to initialize resources', event.error);
      loaderHandle?.clear();
      loaderHandle = null;
      showBanner('error', {
        title: 'Failed to initialize',
        messages: [event.message],
        actions: [
          {
            label: 'Reload',
            onClick: () => window.location.reload(),
            variant: 'primary',
          },
        ],
      });
      break;
    case 'cancelled':
      loaderHandle?.dispose();
      loaderHandle = null;
      break;
  }
}

const bootstrapLoader = createBootstrapLoader({
  assetPaths,
  loadAssets,
  setAssets,
  startGame: () => gameOrchestrator.start(),
  shouldAbort: (token) => token !== initToken,
});

bootstrapLoader.subscribe(handleLoaderEvent);

function onWheel(event: WheelEvent): void {
  if (!canvasRef) return;
  event.preventDefault();
  if (pendingWheelEvent) {
    pendingWheelEvent.clientX = event.clientX;
    pendingWheelEvent.clientY = event.clientY;
    pendingWheelEvent.deltaY += event.deltaY;
  } else {
    pendingWheelEvent = {
      clientX: event.clientX,
      clientY: event.clientY,
      deltaY: event.deltaY,
    };
  }
  if (wheelFrameRequested) {
    return;
  }
  wheelFrameRequested = true;
  requestAnimationFrame(() => {
    wheelFrameRequested = false;
    if (!canvasRef || !pendingWheelEvent) {
      pendingWheelEvent = null;
      return;
    }
    const { clientX, clientY, deltaY } = pendingWheelEvent;
    pendingWheelEvent = null;
    const scaleFactor = Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY);
    const targetZoom = camera.zoom * scaleFactor;
    applyZoomAtPoint(canvasRef, clientX, clientY, targetZoom);
  });
}

function onCanvasClick(event: MouseEvent): void {
  if (!canvasRef) return;
  const world = screenToWorld(canvasRef, event.clientX, event.clientY);
  gameOrchestrator.handleCanvasClick(world);
}

function attachCanvasInputs(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('click', onCanvasClick);
  addCleanup(() => canvas.removeEventListener('click', onCanvasClick));

  canvas.addEventListener('wheel', onWheel, { passive: false });
  addCleanup(() => canvas.removeEventListener('wheel', onWheel));

  const detachPointer = attachPointerPan(canvas, {
    onPan: (dx, dy) => {
      panCameraByScreenDelta(dx, dy);
    },
    dragCursor: 'grabbing',
  });
  addCleanup(detachPointer);

  const detachGestures = attachTouchGestures(canvas, {
    onPan: (dx, dy) => {
      panCameraByScreenDelta(dx, dy);
    },
    onPinch: ({ centerX, centerY, scale, deltaCenterX, deltaCenterY }) => {
      applyZoomAtPoint(canvas, centerX, centerY, camera.zoom * scale);
      panCameraByScreenDelta(deltaCenterX, deltaCenterY);
    },
    onTap: (position) => {
      const world = screenToWorld(canvas, position.x, position.y);
      gameOrchestrator.handleCanvasClick(world);
    },
  });
  addCleanup(detachGestures);
}

export function destroy(): void {
  initToken += 1;
  clearCleanupHandlers();
  loaderHandle?.dispose();
  loaderHandle = null;
  wheelFrameRequested = false;
  pendingWheelEvent = null;
  if (canvasRef) {
    canvasRef.style.cursor = '';
  }
  canvasRef = null;
  resourceBarRef = null;
  overlayRef = null;
  hud.removeTransientUI();
  gameOrchestrator.cleanup();
}

export function init(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  const hudRoot = document.getElementById('hud-root') as HTMLElement | null;
  const portal = hudRoot ? ensureHudPortal(hudRoot) : null;
  const overlay = portal?.overlay ?? document.getElementById('ui-overlay');
  const resourceBar = portal?.resourceBar ?? document.getElementById('resource-bar');

  if (!canvas || !resourceBar || !overlay) {
    console.error(
      'Autobattles4xFinsauna shell is missing the required canvas, overlay, or resource bar elements.',
      {
        hasCanvas: Boolean(canvas),
        hasHudRoot: Boolean(hudRoot),
        hasResourceBar: Boolean(resourceBar),
        hasOverlay: Boolean(overlay),
      }
    );
    return;
  }

  if (canvasRef) {
    destroy();
  }

  const runToken = ++initToken;

  canvasRef = canvas;
  resourceBarRef = resourceBar;
  overlayRef = overlay;
  hud = createHud(overlay);

  applyBuildIdentity();

  const mobileViewport = useIsMobile();
  addCleanup(() => mobileViewport.dispose());

  gameOrchestrator.setup(canvas, resourceBar, overlay);
  attachCanvasInputs(canvas);

  const resize = () => resizeCanvasToDisplaySize(canvas);
  window.addEventListener('resize', resize);
  addCleanup(() => window.removeEventListener('resize', resize));

  const unloadHandler = () => gameOrchestrator.cleanup();
  window.addEventListener('beforeunload', unloadHandler);
  addCleanup(() => window.removeEventListener('beforeunload', unloadHandler));

  resize();

  if (!import.meta.vitest) {
    void bootstrapLoader.run(runToken);
  }
}

function initWhenDomReady(): void {
  if (typeof document === 'undefined') {
    return;
  }

  const startInit = () => {
    document.removeEventListener('DOMContentLoaded', startInit);
    init();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startInit);
    return;
  }

  startInit();
}

if (!import.meta.vitest) {
  initWhenDomReady();
}

export {
  camera,
  MIN_ZOOM,
  MAX_ZOOM,
  clampZoom,
  screenToWorld,
  applyZoomAtPoint,
  panCameraByScreenDelta,
  resizeCanvasToDisplaySize,
};

export function getGameOrchestrator(): GameOrchestrator {
  return gameOrchestrator;
}
