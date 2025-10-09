import type { BattleManager } from '../battle/BattleManager.ts';
import type { EventBus } from '../events/EventBus.ts';
import type { GameRuntime } from './runtime/GameRuntime.ts';
import type { RosterService } from './runtime/rosterService.ts';
import type { EnemyRampSummary } from '../ui/topbar.ts';
import type { HexMap } from '../hexmap.ts';
import type { Animator } from '../render/Animator.ts';
import type { HexMapRenderer } from '../render/HexMapRenderer.ts';
import type { Unit } from '../unit/index.ts';
import type { Saunoja } from '../units/saunoja.ts';
import type { Sauna } from '../sim/sauna.ts';
import type { UnitStatusPayload, SaunaStatusPayload } from '../ui/fx/types.ts';
import type { AxialCoord, PixelCoord } from '../hex/HexUtils.ts';
import type { VisionSource } from '../render/renderer.ts';
import type { DrawSaunojasOptions } from '../units/renderSaunoja.ts';
import type { LoadedAssets } from '../loader.ts';

export type RenderFn = (
  ctx: CanvasRenderingContext2D,
  mapRenderer: HexMapRenderer,
  assets: {
    images: LoadedAssets['images'];
    atlas: LoadedAssets['atlases']['units'];
  },
  units: Unit[],
  selected: AxialCoord | null,
  options: {
    saunojas?: {
      units: Saunoja[];
      draw: (
        ctx: CanvasRenderingContext2D,
        units: Saunoja[],
        options?: DrawSaunojasOptions
      ) => void;
      resolveRenderCoord: (attendant: Saunoja) => { q: number; r: number } | null;
      resolveSpriteId: (attendant: Saunoja) => string | null;
      fallbackSpriteId: string;
    };
    sauna: Sauna | undefined;
    saunaVision: VisionSource | null;
    fx?: {
      getUnitAlpha: (unit: Unit) => number;
      beginOverlayFrame: () => void;
      pushUnitStatus: (status: UnitStatusPayload) => void;
      pushSaunaStatus: (status: SaunaStatusPayload | null) => void;
      commitOverlayFrame: () => void;
    };
    animations: ReturnType<GameRuntime['getCombatAnimations']>;
    friendlyVisionSources: Unit[];
  }
) => void;

export interface GameControllerDependencies {
  eventBus: EventBus;
  getGameRuntime: () => GameRuntime;
  invalidateFrame: () => void;
  resetAutoFrame: () => void;
  notifyHudElapsed: () => void;
  notifyEnemyRamp: (summary: EnemyRampSummary | null) => void;
  setHudElapsedMs: (value: number) => void;
  friendlyVisionUnitScratch: Unit[];
  overlaySaunojasScratch: Saunoja[];
  units: Unit[];
  saunojas: Saunoja[];
  saunojaToUnit: Map<string, string>;
  unitsById: Map<string, Unit>;
  getAttachedUnitFor: (attendant: Saunoja) => Unit | null;
  getSauna: () => Sauna | null;
  rosterService: RosterService;
  render: RenderFn;
  getAssets: () => LoadedAssets | null;
  drawSaunojas: (
    ctx: CanvasRenderingContext2D,
    units: Saunoja[],
    options?: DrawSaunojasOptions
  ) => void;
  createHexMap: () => HexMap;
  createAnimator: (invalidate: () => void) => Animator;
  createBattleManager: (map: HexMap, animator: Animator) => BattleManager;
  createMapRenderer: (map: HexMap) => HexMapRenderer;
}

export class GameController {
  readonly map: HexMap;
  readonly animator: Animator;
  readonly battleManager: BattleManager;
  readonly mapRenderer: HexMapRenderer;

  private readonly invalidateTerrainCache: () => void;

  constructor(private readonly deps: GameControllerDependencies) {
    this.map = deps.createHexMap();
    this.animator = deps.createAnimator(() => deps.invalidateFrame());
    this.battleManager = deps.createBattleManager(this.map, this.animator);
    this.mapRenderer = deps.createMapRenderer(this.map);

    this.invalidateTerrainCache = () => {
      this.mapRenderer.invalidateCache();
      this.deps.invalidateFrame();
    };

    this.deps.eventBus.on('buildingPlaced', this.invalidateTerrainCache);
    this.deps.eventBus.on('buildingRemoved', this.invalidateTerrainCache);
    this.map.forEachTile((tile) => tile.setFogged(true));
    this.deps.resetAutoFrame();
  }

  getTerrainInvalidator(): () => void {
    return this.invalidateTerrainCache;
  }

  setupGame(canvasEl: HTMLCanvasElement, resourceBarEl: HTMLElement, overlayEl: HTMLElement): void {
    this.deps.setHudElapsedMs(0);
    this.deps.notifyHudElapsed();
    this.deps.notifyEnemyRamp(null);
    this.deps.getGameRuntime().setupGame(canvasEl, resourceBarEl, overlayEl);
  }

  draw(): void {
    const runtime = this.deps.getGameRuntime();
    runtime.markFrameClean();
    runtime.resetIdleFrameCount();
    const canvas = runtime.getCanvas();
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    const assets = this.deps.getAssets();
    if (!ctx || !assets) {
      runtime.markFrameDirty();
      return;
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const combatAnimations = runtime.getCombatAnimations();
    if (combatAnimations) {
      combatAnimations.step(now);
    }

    const unitFx = runtime.getUnitFx();
    if (unitFx) {
      unitFx.step(now);
    }

    const shakeOffset = unitFx?.getShakeOffset() ?? { x: 0, y: 0 };
    const fxOptions = unitFx
      ? {
          getUnitAlpha: (unit: Unit) => unitFx.getUnitAlpha(unit.id),
          beginOverlayFrame: () => unitFx.beginStatusFrame(),
          pushUnitStatus: (status: UnitStatusPayload) => unitFx.pushUnitStatus(status),
          pushSaunaStatus: (status: SaunaStatusPayload | null) => unitFx.pushSaunaStatus(status),
          commitOverlayFrame: () => unitFx.commitStatusFrame()
        }
      : undefined;

    const friendlyVisionSources = this.deps.friendlyVisionUnitScratch;
    friendlyVisionSources.length = 0;
    for (const unit of this.deps.units) {
      if (unit.faction === 'player' && !unit.isDead()) {
        friendlyVisionSources.push(unit);
      }
    }

    const overlaySaunojas = this.deps.overlaySaunojasScratch;
    overlaySaunojas.length = 0;
    for (const attendant of this.deps.saunojas) {
      const attachedId = this.deps.saunojaToUnit.get(attendant.id);
      if (!attachedId) {
        continue;
      }
      const attachedUnit = this.deps.unitsById.get(attachedId) ?? null;
      if (!attachedUnit || attachedUnit.isDead()) {
        overlaySaunojas.push(attendant);
      }
    }

    const sauna = this.deps.getSauna();
    const saunaVision: VisionSource | null = sauna
      ? {
          coord: sauna.pos,
          range: sauna.visionRange
        }
      : null;

    ctx.save();
    if (shakeOffset.x !== 0 || shakeOffset.y !== 0) {
      ctx.translate(shakeOffset.x, shakeOffset.y);
    }

    const selected = this.deps.rosterService.getSelectedCoord();
    const saunojaLayer =
      overlaySaunojas.length > 0
        ? {
            units: overlaySaunojas,
            draw: this.deps.drawSaunojas,
            resolveRenderCoord: (attendant: Saunoja) => {
              const unit = this.deps.getAttachedUnitFor(attendant);
              if (!unit) {
                return null;
              }
              return unit.renderCoord ?? unit.coord;
            },
            resolveSpriteId: (attendant: Saunoja) => {
              const unit = this.deps.getAttachedUnitFor(attendant);
              if (unit) {
                return unit.getAppearanceId();
              }
              return typeof attendant.appearanceId === 'string' ? attendant.appearanceId : null;
            },
            fallbackSpriteId: 'saunoja-guardian'
          }
        : undefined;

    this.deps.render(
      ctx,
      this.mapRenderer,
      { images: assets.images, atlas: assets.atlases.units },
      this.deps.units,
      selected,
      {
        saunojas: saunojaLayer,
        sauna: sauna ?? undefined,
        saunaVision,
        fx: fxOptions,
        animations: combatAnimations,
        friendlyVisionSources
      }
    );

    friendlyVisionSources.length = 0;
    overlaySaunojas.length = 0;
    ctx.restore();
  }

  handleCanvasClick(world: PixelCoord): void {
    this.deps.getGameRuntime().handleCanvasClick(world);
  }

  async start(): Promise<void> {
    await this.deps.getGameRuntime().start();
  }

  cleanup(): void {
    this.deps.eventBus.off('buildingPlaced', this.invalidateTerrainCache);
    this.deps.eventBus.off('buildingRemoved', this.invalidateTerrainCache);
    this.deps.getGameRuntime().cleanup();
  }
}
