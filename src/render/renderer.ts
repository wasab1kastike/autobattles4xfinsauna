import type { AxialCoord, PixelCoord } from '../hex/HexUtils.ts';
import { hexDistance } from '../hex/HexUtils.ts';
import type { LoadedAssets } from '../loader.ts';
import type { Unit } from '../unit/index.ts';
import { isSisuBurstActive } from '../sisu/burst.ts';
import type { Sauna } from '../sim/sauna.ts';
import { HexMapRenderer } from './HexMapRenderer.ts';
import { camera } from '../camera/autoFrame.ts';
import type { Saunoja } from '../units/saunoja.ts';
import type { DrawSaunojasOptions } from '../units/renderSaunoja.ts';
import { drawSaunaOverlay } from './saunaOverlay.ts';
import type { SpritePlacementInput } from './units/draw.ts';
import { drawUnitSprite } from './units/UnitSprite.ts';
import type { SaunaStatusPayload, UnitStatusPayload, UnitStatusBuff } from '../ui/fx/types.ts';
import type { CombatKeywordEntry, CombatKeywordRegistry } from '../combat/resolve.ts';
import type { KeywordState } from '../keywords/index.ts';

type DrawSaunojaFn = (
  ctx: CanvasRenderingContext2D,
  units: Saunoja[],
  options?: DrawSaunojasOptions
) => void;

export interface VisionSource {
  coord: AxialCoord;
  range: number;
}

type SaunaVisionSource = VisionSource | (Pick<Sauna, 'pos'> & Partial<Sauna>);

function isVisionSource(candidate: unknown): candidate is VisionSource {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }
  const maybeSource = candidate as Partial<VisionSource>;
  const hasCoord =
    !!maybeSource.coord &&
    typeof maybeSource.coord === 'object' &&
    typeof maybeSource.coord.q === 'number' &&
    typeof maybeSource.coord.r === 'number';
  return hasCoord && typeof maybeSource.range === 'number';
}

function resolveSaunaVision(sauna?: SaunaVisionSource | null): VisionSource | null {
  if (!sauna) {
    return null;
  }
  if (isVisionSource(sauna)) {
    const range = Number.isFinite(sauna.range) ? Math.max(0, sauna.range) : 0;
    return { coord: sauna.coord, range };
  }
  if ('pos' in sauna) {
    const rawRange =
      'visionRange' in sauna && Number.isFinite(sauna.visionRange)
        ? sauna.visionRange
        : 'auraRadius' in sauna && Number.isFinite(sauna.auraRadius)
          ? sauna.auraRadius
          : 0;
    const range = Math.max(0, Number.isFinite(rawRange) ? (rawRange as number) : 0);
    return { coord: sauna.pos, range } satisfies VisionSource;
  }
  return null;
}

function isKeywordStateEntry(
  entry: CombatKeywordEntry | null | undefined
): entry is KeywordState {
  if (!entry || typeof entry !== 'object') {
    return false;
  }
  const candidate = entry as Partial<KeywordState>;
  return typeof candidate.keyword === 'string' && typeof candidate.stacks === 'number';
}

function collectKeywordBuffs(
  registry: CombatKeywordRegistry | null | undefined
): UnitStatusBuff[] {
  if (!registry) {
    return [];
  }

  const buffs: UnitStatusBuff[] = [];
  const addEntry = (entry: CombatKeywordEntry | null | undefined) => {
    if (!isKeywordStateEntry(entry)) {
      return;
    }
    buffs.push({
      id: entry.keyword,
      remaining: Infinity,
      duration: Infinity,
      stacks: Number.isFinite(entry.stacks) ? entry.stacks : undefined
    });
  };

  if (typeof (registry as Iterable<CombatKeywordEntry | null | undefined>)[Symbol.iterator] === 'function') {
    for (const entry of registry as Iterable<CombatKeywordEntry | null | undefined>) {
      addEntry(entry);
    }
  } else {
    const record = registry as Record<string, CombatKeywordEntry | null | undefined>;
    for (const value of Object.values(record)) {
      addEntry(value);
    }
  }

  return buffs;
}

export interface FxLayerOptions {
  getUnitAlpha?: (unit: Unit) => number;
  beginOverlayFrame?: () => void;
  pushUnitStatus?: (status: UnitStatusPayload) => void;
  pushSaunaStatus?: (status: SaunaStatusPayload | null) => void;
  commitOverlayFrame?: () => void;
}

export interface DrawOptions {
  saunojas?: {
    units: Saunoja[];
    draw: DrawSaunojaFn;
    resolveRenderCoord?: DrawSaunojasOptions['resolveRenderCoord'];
  };
  sauna?: Sauna | null;
  saunaVision?: VisionSource | null;
  fx?: FxLayerOptions;
  friendlyVisionSources?: readonly Unit[];
}

export function draw(
  ctx: CanvasRenderingContext2D,
  mapRenderer: HexMapRenderer,
  assets: LoadedAssets['images'],
  units: Unit[],
  selected: AxialCoord | null,
  options?: DrawOptions
): void {
  const dpr = window.devicePixelRatio || 1;
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  options?.fx?.beginOverlayFrame?.();

  const viewportWidth = canvasWidth / dpr;
  const viewportHeight = canvasHeight / dpr;

  ctx.scale(dpr, dpr);
  ctx.translate(viewportWidth / 2, viewportHeight / 2);
  ctx.scale(camera.zoom, camera.zoom);

  const origin = mapRenderer.getOrigin();
  ctx.translate(-(camera.x - origin.x), -(camera.y - origin.y));

  mapRenderer.draw(ctx, assets, selected ?? undefined);
  const saunojaLayer = options?.saunojas;
  if (saunojaLayer && Array.isArray(saunojaLayer.units) && saunojaLayer.units.length > 0) {
    saunojaLayer.draw(ctx, saunojaLayer.units, {
      originX: origin.x,
      originY: origin.y,
      hexRadius: mapRenderer.hexSize,
      zoom: camera.zoom,
      resolveRenderCoord: saunojaLayer.resolveRenderCoord,
      pushStatus: options?.fx?.pushUnitStatus
    });
  }
  drawUnits(
    ctx,
    mapRenderer,
    assets,
    units,
    origin,
    options?.fx,
    options?.friendlyVisionSources,
    options?.saunaVision ?? options?.sauna ?? null,
    selected
  );
  if (options?.sauna) {
    drawSaunaOverlay(ctx, options.sauna, {
      origin,
      hexSize: mapRenderer.hexSize,
      pushStatus: options?.fx?.pushSaunaStatus
    });
  }
  ctx.restore();

  options?.fx?.commitOverlayFrame?.();
}

export function drawUnits(
  ctx: CanvasRenderingContext2D,
  mapRenderer: HexMapRenderer,
  assets: LoadedAssets['images'],
  units: Unit[],
  origin: PixelCoord,
  fx?: FxLayerOptions,
  visionSources?: readonly Unit[],
  saunaVision?: SaunaVisionSource | null,
  selectedCoord?: AxialCoord | null
): void {
  const visionUnits = visionSources ?? units;
  const friendlyVisionSources: VisionSource[] = visionUnits
    .filter((unit) => unit.faction === 'player' && !unit.isDead())
    .map((unit) => ({ coord: unit.coord, range: unit.getVisionRange() } satisfies VisionSource));

  const resolvedSaunaVision = resolveSaunaVision(saunaVision);
  if (resolvedSaunaVision) {
    friendlyVisionSources.push(resolvedSaunaVision);
  }
  for (const unit of units) {
    if (unit.isDead()) {
      continue;
    }
    if (
      unit.faction === 'enemy' &&
      !friendlyVisionSources.some(
        ({ coord, range }) => hexDistance(coord, unit.coord) <= range
      )
    ) {
      continue;
    }
    const img = assets[`unit-${unit.type}`] ?? assets['placeholder'];
    const maxHealth = unit.getMaxHealth();
    ctx.save();
    const alpha = fx?.getUnitAlpha?.(unit);
    if (typeof alpha === 'number') {
      const clamped = Math.min(1, Math.max(0, alpha));
      if (clamped <= 0) {
        ctx.restore();
        continue;
      }
      ctx.globalAlpha *= clamped;
    }
    if (unit.stats.health / maxHealth < 0.5) {
      ctx.filter = 'saturate(0)';
    }
    const renderCoord = unit.renderCoord ?? unit.coord;
    const placementInput: SpritePlacementInput = {
      coord: renderCoord,
      hexSize: mapRenderer.hexSize,
      origin,
      zoom: camera.zoom,
      type: unit.type
    };
    const filters: string[] = [];
    if (unit.stats.health / maxHealth < 0.5) {
      filters.push('saturate(0)');
    }
    const deltaQ = Math.abs(renderCoord.q - unit.coord.q);
    const deltaR = Math.abs(renderCoord.r - unit.coord.r);
    const motionStrength = Math.min(1, deltaQ + deltaR);
    if (motionStrength > 0.01) {
      filters.push('contrast(1.08)');
      ctx.shadowColor = 'rgba(255, 255, 255, 0.28)';
      ctx.shadowBlur = Math.max(6, 12 * camera.zoom * motionStrength);
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0)';
      ctx.shadowBlur = 0;
    }
    ctx.filter = filters.length > 0 ? filters.join(' ') : 'none';
    const selectionState = {
      isSelected:
        Boolean((unit as Partial<{ selected: boolean }>).selected) ||
        (selectedCoord?.q === unit.coord.q && selectedCoord?.r === unit.coord.r),
      isPrimary: Boolean((unit as Partial<{ selected: boolean }>).selected)
    };
    const renderResult = drawUnitSprite(ctx, unit, {
      placement: placementInput,
      sprite: img,
      faction: unit.faction,
      motionStrength,
      cameraZoom: camera.zoom,
      selection: selectionState
    });
    if (fx?.pushUnitStatus) {
      const baseRadius = Math.max(renderResult.footprint.radiusX, renderResult.footprint.radiusY);
      const radius = Math.max(
        mapRenderer.hexSize * 0.32,
        Math.min(mapRenderer.hexSize * 0.72, baseRadius * 0.92)
      );
      const worldX = renderResult.footprint.centerX + origin.x;
      const worldY = renderResult.footprint.centerY + origin.y;
      const hp = Number.isFinite(unit.stats.health) ? Math.max(0, unit.stats.health) : 0;
      const shieldValue = typeof unit.getShield === 'function' ? unit.getShield() : 0;
      const shield = Number.isFinite(shieldValue) ? Math.max(0, shieldValue) : 0;
      const buffs = collectKeywordBuffs(unit.combatKeywords ?? null);

      fx.pushUnitStatus({
        id: unit.id,
        world: { x: worldX, y: worldY },
        radius,
        hp,
        maxHp: maxHealth,
        shield,
        faction: unit.faction,
        selected: selectionState.isSelected,
        buffs,
        visible: true
      });
    }
    if (isSisuBurstActive() && unit.faction === 'player') {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        renderResult.placement.drawX,
        renderResult.placement.drawY,
        renderResult.placement.width,
        renderResult.placement.height
      );
    }
    ctx.restore();
  }
}
