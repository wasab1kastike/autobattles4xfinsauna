import type { AxialCoord, PixelCoord } from '../hex/HexUtils.ts';
import { axialToPixel, DIRECTIONS, hexDistance } from '../hex/HexUtils.ts';
import type { LoadedAssets } from '../loader.ts';
import type { Unit } from '../unit/index.ts';
import { isSisuBurstActive } from '../sisu/burst.ts';
import type { Sauna } from '../sim/sauna.ts';
import { HexMapRenderer } from './HexMapRenderer.ts';
import { camera } from '../camera/autoFrame.ts';
import type { Saunoja } from '../units/saunoja.ts';
import type { DrawSaunojasOptions } from '../units/renderSaunoja.ts';
import { drawSaunaOverlay } from './saunaOverlay.ts';
import { getSpritePlacement } from './units/draw.ts';
import type { SpritePlacementInput, SpritePlacement } from './units/draw.ts';
import { drawUnitSprite } from './units/UnitSprite.ts';
import type { UnitSpriteRenderResult } from './units/UnitSprite.ts';
import type { UnitSpriteAtlas, SpriteAtlasSlice } from './units/spriteAtlas.ts';
import type { SaunaStatusPayload, UnitStatusPayload, UnitStatusBuff } from '../ui/fx/types.ts';
import type { CombatKeywordEntry, CombatKeywordRegistry } from '../combat/resolve.ts';
import type { KeywordState } from '../keywords/index.ts';
import { snapForZoom } from './zoom.ts';
import type { CombatAnimationSampler } from './combatAnimations.ts';

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
    resolveSpriteId?: DrawSaunojasOptions['resolveSpriteId'];
    fallbackSpriteId?: DrawSaunojasOptions['fallbackSpriteId'];
  };
  sauna?: Sauna | null;
  saunaVision?: VisionSource | null;
  fx?: FxLayerOptions;
  animations?: CombatAnimationSampler | null;
  friendlyVisionSources?: readonly Unit[];
}

export interface RendererAssets {
  images: LoadedAssets['images'];
  atlas: UnitSpriteAtlas | null;
}

interface RenderEntry {
  unit: Unit;
  sprite: CanvasImageSource | null;
  atlasCanvas: CanvasImageSource | null;
  slice: SpriteAtlasSlice | null;
  placement: SpritePlacementInput;
  precomputedPlacement: SpritePlacement;
  selection: { isSelected: boolean; isPrimary: boolean };
  motionStrength: number;
  filter: string;
  shadowColor: string;
  shadowBlur: number;
  alpha: number;
  renderCoord: AxialCoord;
  maxHealth: number;
  animationOffset: PixelCoord | null;
}

interface RenderGroup {
  coord: AxialCoord;
  entries: RenderEntry[];
  primaryIndex: number;
}

const friendlyVisionScratch: VisionSource[] = [];
const renderEntriesScratch: RenderEntry[] = [];
const renderGroupsScratch: RenderGroup[] = [];
const renderGroupMapScratch: Map<string, RenderGroup> = new Map();
const spriteBatchesScratch: SpriteBatch[] = [];
const spriteCommandsScratch: SpriteCommand[] = [];

interface SpriteBatchItem {
  sx: number | null;
  sy: number | null;
  sw: number | null;
  sh: number | null;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  alpha: number;
}

interface SpriteBatch {
  key: string;
  image: CanvasImageSource;
  filter: string;
  shadowColor: string;
  shadowBlur: number;
  items: SpriteBatchItem[];
}

interface SpriteCommand {
  job: RenderJob;
  result: UnitSpriteRenderResult;
  alpha: number;
}

const spriteImageKeyCache = new WeakMap<CanvasImageSource, string>();
let spriteImageKeyCounter = 0;

function getSpriteImageKey(image: CanvasImageSource): string {
  let key = spriteImageKeyCache.get(image);
  if (!key) {
    key = `sprite-${++spriteImageKeyCounter}`;
    spriteImageKeyCache.set(image, key);
  }
  return key;
}

function getSpriteBatchKey(
  image: CanvasImageSource,
  filter: string,
  shadowColor: string,
  shadowBlur: number
): string {
  return `${getSpriteImageKey(image)}|${filter}|${shadowColor}|${shadowBlur}`;
}

function createSpriteBatch(
  key: string,
  image: CanvasImageSource,
  filter: string,
  shadowColor: string,
  shadowBlur: number
): SpriteBatch {
  return { key, image, filter, shadowColor, shadowBlur, items: [] } satisfies SpriteBatch;
}

export function draw(
  ctx: CanvasRenderingContext2D,
  mapRenderer: HexMapRenderer,
  assets: RendererAssets,
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

  mapRenderer.draw(ctx, assets.images, selected ?? undefined);
  const saunojaLayer = options?.saunojas;
  if (saunojaLayer && Array.isArray(saunojaLayer.units) && saunojaLayer.units.length > 0) {
    saunojaLayer.draw(ctx, saunojaLayer.units, {
      assets: assets.images,
      originX: origin.x,
      originY: origin.y,
      hexRadius: mapRenderer.hexSize,
      zoom: camera.zoom,
      resolveRenderCoord: saunojaLayer.resolveRenderCoord,
      resolveSpriteId: saunojaLayer.resolveSpriteId,
      fallbackSpriteId: saunojaLayer.fallbackSpriteId,
      pushStatus: options?.fx?.pushUnitStatus
    });
  }
  drawUnits(
    ctx,
    mapRenderer,
    { images: assets.images, atlas: assets.atlas },
    units,
    origin,
    options?.fx,
    options?.animations ?? null,
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
  assets: RendererAssets,
  units: Unit[],
  origin: PixelCoord,
  fx?: FxLayerOptions,
  animations?: CombatAnimationSampler | null,
  visionSources?: readonly Unit[],
  saunaVision?: SaunaVisionSource | null,
  selectedCoord?: AxialCoord | null
): void {
  const visionUnits = visionSources ?? units;
  const friendlyVisionSources = friendlyVisionScratch;
  friendlyVisionSources.length = 0;
  for (const unit of visionUnits) {
    if (unit.faction === 'player' && !unit.isDead()) {
      friendlyVisionSources.push({
        coord: unit.coord,
        range: unit.getVisionRange()
      });
    }
  }

  const resolvedSaunaVision = resolveSaunaVision(saunaVision);
  if (resolvedSaunaVision) {
    friendlyVisionSources.push(resolvedSaunaVision);
  }

  const visibleEntries = renderEntriesScratch;
  visibleEntries.length = 0;

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const placeholder = assets.images['placeholder'] ?? null;

  for (const unit of units) {
    if (unit.isDead()) {
      continue;
    }
    if (unit.faction === 'enemy') {
      let visible = false;
      for (let index = 0; index < friendlyVisionSources.length; index++) {
        const source = friendlyVisionSources[index];
        if (hexDistance(source.coord, unit.coord) <= source.range) {
          visible = true;
          break;
        }
      }
      if (!visible) {
        continue;
      }
    }

    const appearanceId = unit.getAppearanceId();
    const spriteKey = `unit-${appearanceId}`;
    const fallbackSprite = assets.images[spriteKey] ?? placeholder;
    const slice = assets.atlas?.slices[spriteKey] ?? null;
    const atlasCanvas = assets.atlas ? assets.atlas.canvas : null;
    const maxHealth = unit.getMaxHealth();
    const alpha = fx?.getUnitAlpha?.(unit);
    const normalizedAlpha = typeof alpha === 'number' ? clamp(alpha, 0, 1) : 1;
    if (normalizedAlpha <= 0) {
      continue;
    }

    const renderCoord = unit.renderCoord ?? unit.coord;
    const placementInput: SpritePlacementInput = {
      coord: renderCoord,
      hexSize: mapRenderer.hexSize,
      origin,
      zoom: camera.zoom,
      type: appearanceId
    };
    const precomputedPlacement = getSpritePlacement(placementInput);

    const filters: string[] = [];
    if (unit.stats.health / maxHealth < 0.5) {
      filters.push('saturate(0)');
    }

    const deltaQ = Math.abs(renderCoord.q - unit.coord.q);
    const deltaR = Math.abs(renderCoord.r - unit.coord.r);
    const motionStrength = Math.min(1, deltaQ + deltaR);
    let shadowColor = 'rgba(0, 0, 0, 0)';
    let shadowBlur = 0;
    if (motionStrength > 0.01) {
      filters.push('contrast(1.08)');
      shadowColor = 'rgba(255, 255, 255, 0.28)';
      shadowBlur = Math.max(6, 12 * camera.zoom * motionStrength);
    }

    const animationSample = animations?.getState(unit.id) ?? null;
    let animationOffset: PixelCoord | null = null;
    if (animationSample) {
      animationOffset = {
        x: animationSample.offset.x * mapRenderer.hexSize,
        y: animationSample.offset.y * mapRenderer.hexSize
      } satisfies PixelCoord;
      if (animationSample.glow > 0.01) {
        const glow = clamp(animationSample.glow, 0, 1);
        const factionGlow = unit.faction === 'player'
          ? `rgba(255, 236, 192, ${(0.32 + glow * 0.45).toFixed(3)})`
          : `rgba(255, 168, 168, ${(0.28 + glow * 0.4).toFixed(3)})`;
        shadowColor = factionGlow;
        shadowBlur = Math.max(shadowBlur, Math.max(14, 22 * camera.zoom * (0.4 + glow * 0.6)));
        filters.push(`saturate(${(1 + glow * 0.45).toFixed(3)})`);
      }
      if (animationSample.flash > 0.01) {
        const flash = clamp(animationSample.flash, 0, 1);
        filters.push(`brightness(${(1 + flash * 0.35).toFixed(3)})`);
        filters.push(`contrast(${(1 + flash * 0.18).toFixed(3)})`);
      }
    }

    const selectionState = {
      isSelected:
        Boolean((unit as Partial<{ selected: boolean }>).selected) ||
        (selectedCoord?.q === unit.coord.q && selectedCoord?.r === unit.coord.r),
      isPrimary: Boolean((unit as Partial<{ selected: boolean }>).selected)
    };

    visibleEntries.push({
      unit,
      sprite: fallbackSprite ?? null,
      atlasCanvas: atlasCanvas ?? null,
      slice,
      placement: placementInput,
      precomputedPlacement,
      selection: selectionState,
      motionStrength,
      filter: filters.length > 0 ? filters.join(' ') : 'none',
      shadowColor,
      shadowBlur,
      alpha: normalizedAlpha,
      renderCoord,
      maxHealth,
      animationOffset
    });
  }

  if (visibleEntries.length <= 0) {
    friendlyVisionSources.length = 0;
    return;
  }

  const groupMap = renderGroupMapScratch;
  groupMap.clear();

  const resolvePrimaryIndex = (entries: RenderEntry[]): number => {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      let score = -index * 0.001;
      if (entry.selection.isPrimary) {
        score += 200;
      } else if (entry.selection.isSelected) {
        score += 120;
      }
      if (entry.motionStrength > 0.01) {
        score += 40 + entry.motionStrength * 10;
      }
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    return bestIndex;
  };

  for (const entry of visibleEntries) {
    const key = `${entry.renderCoord.q},${entry.renderCoord.r}`;
    let group = groupMap.get(key);
    if (!group) {
      group = { coord: entry.renderCoord, entries: [], primaryIndex: 0 };
      groupMap.set(key, group);
    }
    group.entries.push(entry);
  }

  const compareFloats = (a: number, b: number) => {
    const diff = a - b;
    if (Math.abs(diff) < 1e-6) {
      return 0;
    }
    return diff < 0 ? -1 : 1;
  };

  const factionRank = (faction: string | undefined): number => {
    if (!faction) {
      return 2;
    }
    const normalized = faction.toLowerCase();
    if (normalized === 'player') {
      return 0;
    }
    if (normalized === 'enemy') {
      return 1;
    }
    return 2;
  };

  const groups = renderGroupsScratch;
  groups.length = 0;
  for (const group of groupMap.values()) {
    group.primaryIndex = resolvePrimaryIndex(group.entries);
    groups.push(group);
  }

  groups.sort((a, b) => {
    const rCompare = compareFloats(a.coord.r, b.coord.r);
    if (rCompare !== 0) {
      return rCompare;
    }
    const qCompare = compareFloats(a.coord.q, b.coord.q);
    if (qCompare !== 0) {
      return qCompare;
    }
    const aPrimary = a.entries[a.primaryIndex];
    const bPrimary = b.entries[b.primaryIndex];
    const factionCompare = factionRank(aPrimary.unit.faction) - factionRank(bPrimary.unit.faction);
    if (factionCompare !== 0) {
      return factionCompare;
    }
    const selectionCompare = Number(Boolean(bPrimary.selection.isSelected)) - Number(Boolean(aPrimary.selection.isSelected));
    if (selectionCompare !== 0) {
      return selectionCompare;
    }
    return aPrimary.unit.id.localeCompare(bPrimary.unit.id);
  });

  const stackAlpha = 0.76;

  const computeStackOffset = (index: number): PixelCoord => {
    const direction = DIRECTIONS[index % DIRECTIONS.length];
    const tier = Math.floor(index / DIRECTIONS.length) + 1;
    const magnitude = 0.22 * tier;
    const axialOffset = { q: direction.q * magnitude, r: direction.r * magnitude } satisfies AxialCoord;
    const rawPixel = axialToPixel(axialOffset, mapRenderer.hexSize);
    return {
      x: snapForZoom(rawPixel.x, camera.zoom),
      y: snapForZoom(rawPixel.y, camera.zoom)
    } satisfies PixelCoord;
  };

  const mergeOffsets = (
    base: PixelCoord | null,
    extra: PixelCoord | null
  ): PixelCoord | null => {
    if (!base && !extra) {
      return null;
    }
    if (!base) {
      return extra ? { x: extra.x, y: extra.y } : null;
    }
    if (!extra) {
      return { x: base.x, y: base.y } satisfies PixelCoord;
    }
    return { x: base.x + extra.x, y: base.y + extra.y } satisfies PixelCoord;
  };

  interface RenderJob {
    entry: RenderEntry;
    drawBase: boolean;
    offset: PixelCoord | null;
    anchor: PixelCoord | null;
    anchorSource: RenderJob | null;
    alphaMultiplier: number;
  }

  const jobs: RenderJob[] = [];

  for (const group of groups) {
    const primary = group.entries[group.primaryIndex];
    const primaryJob: RenderJob = {
      entry: primary,
      drawBase: true,
      offset: primary.animationOffset ? { ...primary.animationOffset } : null,
      anchor: null,
      anchorSource: null,
      alphaMultiplier: 1
    } satisfies RenderJob;
    jobs.push(primaryJob);

    const extras: RenderEntry[] = [];
    for (let index = 0; index < group.entries.length; index++) {
      if (index === group.primaryIndex) {
        continue;
      }
      extras.push(group.entries[index]);
    }
    extras.sort((a, b) => a.unit.id.localeCompare(b.unit.id));

    extras.forEach((entry, stackIndex) => {
      const offset = computeStackOffset(stackIndex);
      jobs.push({
        entry,
        drawBase: false,
        offset: mergeOffsets(entry.animationOffset, offset),
        anchor: null,
        anchorSource: primaryJob,
        alphaMultiplier: stackAlpha
      });
    });
  }

  groups.length = 0;
  groupMap.clear();

  if (jobs.length === 0) {
    visibleEntries.length = 0;
    friendlyVisionSources.length = 0;
    return;
  }

  const baseResults = new Map<RenderJob, UnitSpriteRenderResult>();

  ctx.save();
  ctx.filter = 'none';
  ctx.shadowColor = 'rgba(0, 0, 0, 0)';
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  for (const job of jobs) {
    if (!job.drawBase) {
      continue;
    }
    const result = drawUnitSprite(ctx, job.entry.unit, {
      placement: job.entry.placement,
      precomputedPlacement: job.entry.precomputedPlacement,
      sprite: null,
      atlas: null,
      slice: null,
      faction: job.entry.unit.faction,
      motionStrength: job.entry.motionStrength,
      cameraZoom: camera.zoom,
      selection: job.entry.selection,
      anchorHint: job.anchor,
      offset: job.offset,
      drawBase: true,
      renderSprite: false
    });
    baseResults.set(job, result);
  }

  ctx.restore();

  for (const job of jobs) {
    if (job.anchorSource) {
      const anchorResult = baseResults.get(job.anchorSource);
      job.anchor = anchorResult ? { x: anchorResult.center.x, y: anchorResult.center.y } : null;
    }
  }

  const spriteBatches = spriteBatchesScratch;
  spriteBatches.length = 0;
  const spriteCommands = spriteCommandsScratch;
  spriteCommands.length = 0;

  ctx.save();
  ctx.filter = 'none';
  ctx.shadowColor = 'rgba(0, 0, 0, 0)';
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  let activeBatch: SpriteBatch | null = null;

  for (const job of jobs) {
    const { entry } = job;
    const finalAlpha = entry.alpha * job.alphaMultiplier;
    if (finalAlpha <= 0) {
      continue;
    }

    const renderResult = drawUnitSprite(ctx, entry.unit, {
      placement: entry.placement,
      precomputedPlacement: entry.precomputedPlacement,
      sprite: entry.sprite,
      atlas: entry.atlasCanvas,
      slice: entry.slice,
      faction: entry.unit.faction,
      motionStrength: entry.motionStrength,
      cameraZoom: camera.zoom,
      selection: entry.selection,
      anchorHint: job.anchor,
      offset: job.offset,
      drawBase: false,
      renderSprite: false
    });

    spriteCommands.push({ job, result: renderResult, alpha: finalAlpha });

    const image = entry.slice && entry.atlasCanvas ? entry.atlasCanvas : entry.sprite;
    if (!image) {
      continue;
    }

    const batchKey = getSpriteBatchKey(image, entry.filter, entry.shadowColor, entry.shadowBlur);
    if (!activeBatch || activeBatch.key !== batchKey) {
      if (activeBatch) {
        spriteBatches.push(activeBatch);
      }
      activeBatch = createSpriteBatch(batchKey, image, entry.filter, entry.shadowColor, entry.shadowBlur);
    }

    activeBatch.items.push({
      sx: entry.slice ? entry.slice.sx : null,
      sy: entry.slice ? entry.slice.sy : null,
      sw: entry.slice ? entry.slice.sw : null,
      sh: entry.slice ? entry.slice.sh : null,
      dx: renderResult.placement.drawX,
      dy: renderResult.placement.drawY,
      dw: renderResult.placement.width,
      dh: renderResult.placement.height,
      alpha: finalAlpha
    });
  }

  if (activeBatch) {
    spriteBatches.push(activeBatch);
  }

  let activeFilter = ctx.filter;
  let activeShadowColor = ctx.shadowColor as string;
  let activeShadowBlur = ctx.shadowBlur;
  let activeAlpha = ctx.globalAlpha;

  for (const batch of spriteBatches) {
    if (batch.filter !== activeFilter) {
      ctx.filter = batch.filter;
      activeFilter = ctx.filter;
    }
    if (batch.shadowColor !== activeShadowColor) {
      ctx.shadowColor = batch.shadowColor;
      activeShadowColor = ctx.shadowColor as string;
    }
    if (batch.shadowBlur !== activeShadowBlur) {
      ctx.shadowBlur = batch.shadowBlur;
      activeShadowBlur = ctx.shadowBlur;
    }

    for (const item of batch.items) {
      if (item.alpha !== activeAlpha) {
        ctx.globalAlpha = item.alpha;
        activeAlpha = ctx.globalAlpha;
      }

      if (
        item.sx !== null &&
        item.sy !== null &&
        item.sw !== null &&
        item.sh !== null
      ) {
        ctx.drawImage(batch.image, item.sx, item.sy, item.sw, item.sh, item.dx, item.dy, item.dw, item.dh);
      } else {
        ctx.drawImage(batch.image, item.dx, item.dy, item.dw, item.dh);
      }
    }
  }

  ctx.filter = 'none';
  ctx.shadowColor = 'rgba(0, 0, 0, 0)';
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  for (const command of spriteCommands) {
    const { job, result, alpha } = command;
    const { entry } = job;
    if (alpha <= 0) {
      continue;
    }

    if (fx?.pushUnitStatus) {
      const baseRadius = Math.max(result.footprint.radiusX, result.footprint.radiusY);
      const radius = Math.max(
        mapRenderer.hexSize * 0.32,
        Math.min(mapRenderer.hexSize * 0.72, baseRadius * 0.92)
      );
      const worldX = result.footprint.centerX + origin.x;
      const worldY = result.footprint.centerY + origin.y;
      const hp = Number.isFinite(entry.unit.stats.health) ? Math.max(0, entry.unit.stats.health) : 0;
      const shieldValue = typeof entry.unit.getShield === 'function' ? entry.unit.getShield() : 0;
      const shield = Number.isFinite(shieldValue) ? Math.max(0, shieldValue) : 0;
      const buffs = collectKeywordBuffs(entry.unit.combatKeywords ?? null);

      fx.pushUnitStatus({
        id: entry.unit.id,
        world: { x: worldX, y: worldY },
        radius,
        hp,
        maxHp: entry.maxHealth,
        shield,
        faction: entry.unit.faction,
        selected: entry.selection.isSelected,
        buffs,
        visible: true
      });
    }

    if (isSisuBurstActive() && entry.unit.faction === 'player') {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        result.placement.drawX,
        result.placement.drawY,
        result.placement.width,
        result.placement.height
      );
    }
  }

  for (const batch of spriteBatches) {
    batch.items.length = 0;
  }
  spriteBatches.length = 0;
  spriteCommands.length = 0;

  visibleEntries.length = 0;
  friendlyVisionSources.length = 0;
  ctx.restore();
}
