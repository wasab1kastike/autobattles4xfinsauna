import './style.css';
import { setupGame, start, handleCanvasClick, cleanup } from './game.ts';
import { assetPaths, setAssets } from './game/assets.ts';
import { loadAssets } from './loader.ts';
import { createHud, type HudController, type LoadingHandle, type BannerOptions } from './ui/hud.ts';
import { useIsMobile } from './ui/hooks/useIsMobile.ts';
import { createBootstrapLoader, type LoaderStatusEvent } from './bootstrap/loader.ts';
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

applyBuildIdentity();

const BUILD_RELOAD_STORAGE_KEY = 'sauna:build-reload';
const BUILD_CACHE_PARAM = 'build';

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch (error) {
    console.warn('Session storage is unavailable:', error);
    return null;
  }
}

function removeCacheBusterParam(): void {
  if (typeof window === 'undefined' || typeof window.history === 'undefined') {
    return;
  }

  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(BUILD_CACHE_PARAM)) {
      return;
    }

    url.searchParams.delete(BUILD_CACHE_PARAM);
    const nextSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
    window.history.replaceState(null, document.title, nextUrl);
  } catch (error) {
    console.warn('Unable to clear build cache bust parameter:', error);
  }
}

async function ensureLatestDeployment(): Promise<void> {
  if (import.meta.env.DEV || typeof window === 'undefined') {
    return;
  }

  const rawCommit = typeof __COMMIT__ === 'string' ? __COMMIT__.trim().toLowerCase() : '';
  if (!rawCommit || rawCommit === 'unknown') {
    return;
  }

  const storage = getSessionStorage();
  const origin = window.location.origin;
  const htmlUrl = new URL(window.location.pathname, origin);
  htmlUrl.searchParams.set('cb', Date.now().toString());

  const requestOptions: RequestInit = {
    cache: 'no-store',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  };

  try {
    const response = await fetch(htmlUrl, requestOptions);
    if (!response.ok) {
      console.warn(`Unable to verify live deployment: received HTTP ${response.status}`);
      return;
    }

    const html = await response.text();
    const scriptMatch = html.match(/<script[^>]+src="([^"]*index-[^"]+\.js)"/i);
    if (!scriptMatch) {
      console.warn('Unable to locate the published bundle reference while checking for stale builds.');
      return;
    }

    const bundleUrl = new URL(scriptMatch[1], origin);
    bundleUrl.searchParams.set('cb', Date.now().toString());
    const bundleResponse = await fetch(bundleUrl, requestOptions);
    if (!bundleResponse.ok) {
      console.warn(`Unable to fetch published bundle while checking for stale builds: HTTP ${bundleResponse.status}`);
      return;
    }

    const bundleSource = await bundleResponse.text();
    const commitMatch = bundleSource.match(/"([0-9a-f]{7})"\.trim\(\)/i);
    if (!commitMatch) {
      console.warn('Unable to resolve the published commit hash while checking for stale builds.');
      return;
    }

    const liveCommit = commitMatch[1].toLowerCase();
    if (liveCommit === rawCommit) {
      storage?.removeItem(BUILD_RELOAD_STORAGE_KEY);
      removeCacheBusterParam();
      return;
    }

    const priorReload = storage?.getItem(BUILD_RELOAD_STORAGE_KEY);
    if (priorReload === liveCommit) {
      console.warn('Skipping repeated stale build reload attempt for commit', liveCommit);
      return;
    }

    storage?.setItem(BUILD_RELOAD_STORAGE_KEY, liveCommit);

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set(BUILD_CACHE_PARAM, liveCommit);
    window.location.replace(nextUrl.toString());
  } catch (error) {
    console.warn('Unable to verify the deployed build while checking for stale caches:', error);
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
  const scaleFactor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);
  const targetZoom = camera.zoom * scaleFactor;
  applyZoomAtPoint(canvasRef, event.clientX, event.clientY, targetZoom);
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
  const resourceBar = document.getElementById('resource-bar');
  const overlay = document.getElementById('ui-overlay');

  if (!canvas || !resourceBar || !overlay) {
    console.error(
      'Autobattles4xFinsauna shell is missing the required canvas, overlay, or resource bar elements.',
      {
        hasCanvas: Boolean(canvas),
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
