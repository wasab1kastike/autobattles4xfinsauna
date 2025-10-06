import { camera } from '../camera/autoFrame.ts';
import { axialToPixel, type AxialCoord, type PixelCoord } from '../hex/HexUtils.ts';
import { eventBus } from '../events/index.ts';
import type {
  UnitDamagedPayload,
  UnitDiedPayload,
  UnitHealedPayload
} from '../events/types.ts';
import type { HexMapRenderer } from './HexMapRenderer.ts';
import type { Unit } from '../units/Unit.ts';
import { createFloaterLayer, type FloaterLayer } from '../ui/fx/Floater.tsx';
import { createUnitStatusLayer, type UnitStatusLayer } from '../ui/fx/UnitStatusLayer.ts';
import { createSelectionMiniHud, type SelectionMiniHud } from '../ui/fx/SelectionMiniHud.ts';
import type {
  SaunaStatusPayload,
  UnitSelectionPayload,
  UnitStatusPayload
} from '../ui/fx/types.ts';

export interface UnitFxOptions {
  canvas: HTMLCanvasElement;
  overlay: HTMLElement;
  mapRenderer: HexMapRenderer;
  getUnitById: (id: string) => Unit | undefined;
  requestDraw?: () => void;
}

export interface UnitFxManager {
  step(now: number): void;
  getShakeOffset(): { x: number; y: number };
  getUnitAlpha(unitId: string): number;
  beginStatusFrame(): void;
  pushUnitStatus(status: UnitStatusPayload): void;
  pushSaunaStatus(status: SaunaStatusPayload | null): void;
  commitStatusFrame(): void;
  setSelection(selection: UnitSelectionPayload | null): void;
  dispose(): void;
}

interface ShakeState {
  start: number;
  duration: number;
  intensity: number;
  seedX: number;
  seedY: number;
}

interface FadeState {
  start: number;
  duration: number;
}

const damageFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0
});

const healFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0
});

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const DAMAGE_COLOR = 'var(--color-danger)';
const HEAL_COLOR = 'color-mix(in srgb, #34d399 88%, white 12%)';
const FADE_DURATION_DESKTOP = 720;
const FADE_DURATION_MOBILE = 540;
const SHAKE_DURATION = 220;
const SHAKE_DURATION_MOBILE = 180;
const SHAKE_INTENSITY_DESKTOP = 6;
const SHAKE_INTENSITY_MOBILE = 3;
const KILL_FLOATER_COLOR = 'color-mix(in srgb, #fbbf24 82%, white 10%)';

const reduceMotionQuery = typeof matchMedia === 'function'
  ? matchMedia('(prefers-reduced-motion: reduce)')
  : null;
const coarsePointerQuery = typeof matchMedia === 'function'
  ? matchMedia('(pointer: coarse)')
  : null;

export function createUnitFxManager(options: UnitFxOptions): UnitFxManager {
  const { canvas, overlay, mapRenderer, getUnitById, requestDraw } = options;
  const floaterLayer: FloaterLayer = createFloaterLayer(overlay);

  type RectCache = { canvas: DOMRectReadOnly; overlay: DOMRectReadOnly } | null;
  let rectCache: RectCache = null;
  const invalidateRectCache = () => {
    rectCache = null;
  };
  const readRectCache = (): RectCache => {
    if (rectCache) {
      return rectCache;
    }
    const canvasRect = canvas.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    rectCache = { canvas: canvasRect, overlay: overlayRect } satisfies RectCache;
    return rectCache;
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', invalidateRectCache);
    window.addEventListener('scroll', invalidateRectCache, true);
  }

  const projectWorld = (point: PixelCoord, offsetY = 0): PixelCoord | null => {
    const rects = readRectCache();
    if (!rects) {
      return null;
    }
    const { canvas: canvasRect, overlay: overlayRect } = rects;
    if (canvasRect.width === 0 || canvasRect.height === 0) {
      return null;
    }
    const relativeX = (point.x - camera.x) * camera.zoom + canvasRect.width / 2;
    const relativeY = (point.y - camera.y) * camera.zoom + canvasRect.height / 2;
    return {
      x: relativeX + (canvasRect.left - overlayRect.left),
      y: relativeY + (canvasRect.top - overlayRect.top) + offsetY
    } satisfies PixelCoord;
  };
  const statusLayer: UnitStatusLayer = createUnitStatusLayer({
    root: overlay,
    project: projectWorld,
    getZoom: () => camera.zoom
  });
  const selectionHud: SelectionMiniHud = createSelectionMiniHud({
    root: overlay,
    project: projectWorld,
    getVerticalLift: () => -mapRenderer.hexSize * camera.zoom * 1.6,
    getHexSize: () => mapRenderer.hexSize
  });
  const fades = new Map<string, FadeState>();
  const alphas = new Map<string, number>();
  const shakes: ShakeState[] = [];
  const offset = { x: 0, y: 0 };
  const prefersReducedMotion = Boolean(reduceMotionQuery?.matches);
  const coarsePointer = Boolean(coarsePointerQuery?.matches);
  const fadeDuration = coarsePointer ? FADE_DURATION_MOBILE : FADE_DURATION_DESKTOP;
  const shakeDuration = coarsePointer ? SHAKE_DURATION_MOBILE : SHAKE_DURATION;
  const shakeIntensity = coarsePointer ? SHAKE_INTENSITY_MOBILE : SHAKE_INTENSITY_DESKTOP;

  const scheduleDraw = () => {
    if (!requestDraw) {
      return;
    }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestDraw());
    } else {
      requestDraw();
    }
  };

  const project = (coord: AxialCoord): { x: number; y: number } | null => {
    const { x, y } = axialToPixel(coord, mapRenderer.hexSize);
    const verticalLift = -mapRenderer.hexSize * camera.zoom * 0.75;
    return projectWorld({ x, y }, verticalLift);
  };

  const spawnFloater = (
    unitId: string,
    text: string,
    color: string,
    direction: 'up' | 'down' | 'left' | 'right' = 'up'
  ) => {
    const unit = getUnitById(unitId);
    if (!unit) {
      return;
    }
    const position = project(unit.renderCoord ?? unit.coord);
    if (!position) {
      return;
    }
    floaterLayer.spawn({
      text,
      x: position.x,
      y: position.y,
      color,
      direction,
      fontSize: coarsePointer ? 18 : undefined
    });
  };

  const onDamaged = (payload: UnitDamagedPayload) => {
    if (!payload || payload.amount <= 0) {
      return;
    }
    const amount = damageFormatter.format(Math.max(1, Math.round(payload.amount)));
    spawnFloater(payload.targetId, `-${amount}`, DAMAGE_COLOR, 'up');
    if (!prefersReducedMotion) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      shakes.push({
        start: now,
        duration: shakeDuration,
        intensity: shakeIntensity,
        seedX: Math.random() * 500,
        seedY: Math.random() * 500
      });
    }
    scheduleDraw();
  };

  const onHealed = (payload: UnitHealedPayload) => {
    if (!payload || payload.amount <= 0) {
      return;
    }
    const rounded = payload.amount >= 1
      ? damageFormatter.format(Math.round(payload.amount))
      : healFormatter.format(clamp(payload.amount, 0, 9.9));
    spawnFloater(payload.unitId, `+${rounded}`, HEAL_COLOR, 'up');
    scheduleDraw();
  };

  const onDied = (payload: UnitDiedPayload) => {
    if (!payload) {
      return;
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    fades.set(payload.unitId, { start: now, duration: fadeDuration });
    spawnFloater(payload.unitId, '✖', KILL_FLOATER_COLOR, 'down');
    scheduleDraw();
  };

  eventBus.on<UnitDamagedPayload>('unitDamaged', onDamaged);
  eventBus.on<UnitHealedPayload>('unitHealed', onHealed);
  eventBus.on<UnitDiedPayload>('unitDied', onDied);

  const step = (now: number) => {
    if (!prefersReducedMotion) {
      let shakeX = 0;
      let shakeY = 0;
      for (let i = shakes.length - 1; i >= 0; i--) {
        const shake = shakes[i];
        const elapsed = now - shake.start;
        if (elapsed >= shake.duration) {
          shakes.splice(i, 1);
          continue;
        }
        const progress = clamp(elapsed / shake.duration, 0, 1);
        const strength = shake.intensity * easeOutQuad(1 - progress);
        shakeX += Math.sin((now + shake.seedX) / 16) * strength;
        shakeY += Math.cos((now + shake.seedY) / 18) * strength;
      }
      offset.x = shakeX;
      offset.y = shakeY;
    } else {
      offset.x = 0;
      offset.y = 0;
    }

    for (const [unitId, fade] of fades) {
      const elapsed = now - fade.start;
      const progress = clamp(elapsed / fade.duration, 0, 1);
      const alpha = 1 - easeOutQuad(progress);
      if (progress >= 1) {
        alphas.delete(unitId);
        fades.delete(unitId);
        continue;
      }
      alphas.set(unitId, clamp(alpha, 0, 1));
    }

    selectionHud.refreshPosition();

    const hasActiveAnimations =
      (!prefersReducedMotion && shakes.length > 0) || fades.size > 0;
    if (hasActiveAnimations) {
      scheduleDraw();
    }
  };

  const getShakeOffset = () => ({ x: offset.x, y: offset.y });

  const getUnitAlpha = (unitId: string) => {
    return alphas.get(unitId) ?? 1;
  };

  const dispose = () => {
    eventBus.off<UnitDamagedPayload>('unitDamaged', onDamaged);
    eventBus.off<UnitHealedPayload>('unitHealed', onHealed);
    eventBus.off<UnitDiedPayload>('unitDied', onDied);
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', invalidateRectCache);
      window.removeEventListener('scroll', invalidateRectCache, true);
    }
    shakes.length = 0;
    fades.clear();
    alphas.clear();
    committedUnitStatuses.clear();
    committedSaunaStatus = null;
    frameUnitStatuses = null;
    frameSaunaStatus = null;
    floaterLayer.destroy();
    statusLayer.destroy();
    selectionHud.setSelection(null);
    selectionHud.destroy();
  };

  let committedUnitStatuses = new Map<string, UnitStatusPayload>();
  let committedSaunaStatus: SaunaStatusPayload | null = null;
  let frameUnitStatuses: Map<string, UnitStatusPayload> | null = null;
  let frameSaunaStatus: SaunaStatusPayload | null = null;

  const beginStatusFrame = () => {
    frameUnitStatuses = new Map<string, UnitStatusPayload>();
    frameSaunaStatus = null;
    invalidateRectCache();
  };

  const pushUnitStatus = (status: UnitStatusPayload) => {
    if (!status || typeof status.id !== 'string') {
      return;
    }
    if (!frameUnitStatuses) {
      frameUnitStatuses = new Map<string, UnitStatusPayload>();
    }
    frameUnitStatuses.set(status.id, status);
  };

  const pushSaunaStatus = (status: SaunaStatusPayload | null) => {
    frameSaunaStatus = status;
  };

  const commitStatusFrame = () => {
    if (!statusLayer) {
      return;
    }
    const buffer = frameUnitStatuses ?? new Map<string, UnitStatusPayload>();
    const sauna = frameSaunaStatus ?? null;

    frameUnitStatuses = null;
    frameSaunaStatus = null;

    committedUnitStatuses = buffer;
    committedSaunaStatus = sauna;

    const entries = Array.from(committedUnitStatuses.values()).filter((entry) => {
      if (entry.visible === false) {
        return false;
      }
      if (!Number.isFinite(entry.maxHp) || entry.maxHp <= 0) {
        return false;
      }
      return entry.hp > 0;
    });
    const resolvedSauna =
      committedSaunaStatus && committedSaunaStatus.visible === false
        ? null
        : committedSaunaStatus;
    statusLayer.render({ units: entries, sauna: resolvedSauna ?? null });

    if (currentSelection && currentSelectionId) {
      const selectedStatus = committedUnitStatuses.get(currentSelectionId) ?? null;
      if (selectedStatus) {
        selectionHud.updateStatus(
          selectedStatus.world,
          selectedStatus.hp,
          selectedStatus.maxHp,
          selectedStatus.shield ?? 0
        );
        currentSelection = {
          ...currentSelection,
          hp: selectedStatus.hp,
          maxHp: selectedStatus.maxHp,
          shield: selectedStatus.shield ?? 0
        } satisfies UnitSelectionPayload;
      } else {
        selectionHud.updateStatus(
          null,
          currentSelection.hp,
          currentSelection.maxHp,
          currentSelection.shield ?? 0
        );
      }
    } else {
      selectionHud.updateStatus(null);
    }
  };

  let currentSelection: UnitSelectionPayload | null = null;
  let currentSelectionId: string | null = null;

  const setSelection = (selection: UnitSelectionPayload | null) => {
    if (!selection) {
      currentSelection = null;
      currentSelectionId = null;
      selectionHud.setSelection(null);
      return;
    }
    const sanitized: UnitSelectionPayload = {
      ...selection,
      coord: { q: selection.coord.q, r: selection.coord.r },
      hp: Number.isFinite(selection.hp) ? selection.hp : 0,
      maxHp: Number.isFinite(selection.maxHp) ? Math.max(1, selection.maxHp) : 1,
      shield: Number.isFinite(selection.shield ?? 0) ? Math.max(0, selection.shield ?? 0) : 0,
      items: Array.isArray(selection.items) ? [...selection.items] : [],
      statuses: Array.isArray(selection.statuses) ? [...selection.statuses] : []
    } satisfies UnitSelectionPayload;
    currentSelection = sanitized;
    currentSelectionId = sanitized.id;
    selectionHud.setSelection(sanitized);
  };

  return {
    step,
    getShakeOffset,
    getUnitAlpha,
    beginStatusFrame,
    pushUnitStatus,
    pushSaunaStatus,
    commitStatusFrame,
    setSelection,
    dispose
  } satisfies UnitFxManager;
}
