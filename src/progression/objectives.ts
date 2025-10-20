import { GameState, Resource } from '../core/GameState.ts';
import type { HexMap } from '../hexmap.ts';
import type { BuildingType } from '../hex/HexTile.ts';
import type { AxialCoord } from '../hex/HexUtils.ts';
import type { HexTile } from '../hex/HexTile.ts';
import type { Sauna } from '../sim/sauna.ts';
import type {
  SaunaDamagedPayload,
  SaunaDestroyedPayload,
  UnitDiedPayload
} from '../events/types.ts';
import type { Unit } from '../units/Unit.ts';
import { eventBus } from '../events';
import { listStrongholds } from '../world/strongholds.ts';

export type ObjectiveOutcome = 'win' | 'lose';

export type ObjectiveCause = 'strongholds' | 'rosterWipe' | 'bankruptcy' | 'saunaDestroyed';

export interface StrongholdProgress {
  total: number;
  destroyed: number;
  remaining: number;
}

export interface RosterProgress {
  active: number;
  totalDeaths: number;
  wipeSince: number | null;
  wipeDurationMs: number;
}

export interface EconomyProgress {
  beer: number;
  worstBeer: number;
  bankruptSince: number | null;
  bankruptDurationMs: number;
}

export interface ObjectiveProgress {
  strongholds: StrongholdProgress;
  roster: RosterProgress;
  economy: EconomyProgress;
  sauna: SaunaProgress;
  enemyKills: number;
  exploration: ExplorationProgress;
  startedAt: number;
}

export interface SaunaProgress {
  maxHealth: number;
  health: number;
  destroyed: boolean;
  destroyedAt: number | null;
}

export interface ExplorationProgress {
  revealedHexes: number;
}

export interface ResourceSummary {
  readonly final: number;
  readonly delta: number;
}

export interface ObjectiveRewards {
  resources: Record<Resource, ResourceSummary>;
}

export interface ObjectiveResolution {
  outcome: ObjectiveOutcome;
  cause: ObjectiveCause;
  timestamp: number;
  durationMs: number;
  summary: ObjectiveProgress;
  rewards: ObjectiveRewards;
}

export type ObjectiveProgressListener = (progress: ObjectiveProgress) => void;
export type ObjectiveResolutionListener = (resolution: ObjectiveResolution) => void;

export interface ObjectiveTracker {
  onProgress(listener: ObjectiveProgressListener): void;
  offProgress(listener: ObjectiveProgressListener): void;
  onResolution(listener: ObjectiveResolutionListener): void;
  offResolution(listener: ObjectiveResolutionListener): void;
  getProgress(): ObjectiveProgress;
  dispose(): void;
}

export interface ObjectiveTrackerOptions {
  state: GameState;
  map: HexMap;
  /**
   * Function that returns the current roster count, including benched attendants.
   * The tracker calls this lazily when roster-affecting events fire.
   */
  getRosterCount: () => number;
  /** Reference to the player's sauna for defeat tracking. */
  sauna?: Sauna | null;
  /** Override the building types considered strongholds (defaults to `city`). */
  strongholdTypes?: readonly BuildingType[];
  /** Delay (ms) before a roster wipe causes defeat. */
  rosterWipeGraceMs?: number;
  /** Delay (ms) before upkeep bankruptcy causes defeat. */
  bankruptcyGraceMs?: number;
  /** Custom time source for testing. Defaults to `performance.now` / `Date.now`. */
  timeSource?: () => number;
}

const DEFAULT_STRONGHOLDS: readonly BuildingType[] = ['city'];
const DEFAULT_ROSTER_WIPE_GRACE_MS = 10_000;
const DEFAULT_BANKRUPTCY_GRACE_MS = 12_000;
function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function cloneProgress(progress: ObjectiveProgress): ObjectiveProgress {
  return Object.freeze({
    strongholds: { ...progress.strongholds },
    roster: { ...progress.roster },
    economy: { ...progress.economy },
    sauna: { ...progress.sauna },
    enemyKills: progress.enemyKills,
    exploration: { ...progress.exploration },
    startedAt: progress.startedAt
  });
}

function captureResources(state: GameState): Record<Resource, number> {
  const snapshot: Record<Resource, number> = {
    [Resource.SAUNA_BEER]: 0,
    [Resource.SAUNAKUNNIA]: 0,
    [Resource.SISU]: 0
  };
  (Object.values(Resource) as Resource[]).forEach((res) => {
    snapshot[res] = state.getResource(res);
  });
  return snapshot;
}

class ObjectiveTrackerImpl implements ObjectiveTracker {
  private readonly timeSource: () => number;
  private readonly state: GameState;
  private readonly map: HexMap;
  private readonly getRosterCount: () => number;
  private readonly sauna: Sauna | null;
  private readonly strongholdTypes: Set<BuildingType>;
  private readonly rosterGraceMs: number;
  private readonly bankruptcyGraceMs: number;
  private readonly progress: ObjectiveProgress;
  private readonly startResources: Record<Resource, number>;
  private readonly strongholds = new Map<string, { alive: boolean }>();
  private readonly revealedTiles = new Set<string>();
  private readonly progressListeners = new Set<ObjectiveProgressListener>();
  private readonly resolutionListeners = new Set<ObjectiveResolutionListener>();
  private mapDisposer: (() => void) | null = null;
  private rosterTimeout: ReturnType<typeof setTimeout> | null = null;
  private bankruptcyTimeout: ReturnType<typeof setTimeout> | null = null;
  private bankruptSince: number | null = null;
  private wipeSince: number | null = null;
  private saunaDestroyedAt: number | null = null;
  private resolution: ObjectiveResolution | null = null;
  private disposed = false;

  constructor(options: ObjectiveTrackerOptions) {
    this.timeSource = typeof options.timeSource === 'function' ? options.timeSource : now;
    this.state = options.state;
    this.map = options.map;
    this.getRosterCount = options.getRosterCount;
    this.sauna = options.sauna ?? null;
    const strongholdTypes = options.strongholdTypes?.length
      ? options.strongholdTypes
      : DEFAULT_STRONGHOLDS;
    this.strongholdTypes = new Set(strongholdTypes);
    this.rosterGraceMs = Math.max(0, options.rosterWipeGraceMs ?? DEFAULT_ROSTER_WIPE_GRACE_MS);
    this.bankruptcyGraceMs = Math.max(
      0,
      options.bankruptcyGraceMs ?? DEFAULT_BANKRUPTCY_GRACE_MS
    );
    this.startResources = captureResources(this.state);

    const initialBeer = this.state.getResource(Resource.SAUNA_BEER);
    const rosterCount = this.sampleRosterCount();

    this.progress = {
      strongholds: { total: 0, destroyed: 0, remaining: 0 },
      roster: { active: rosterCount, totalDeaths: 0, wipeSince: null, wipeDurationMs: 0 },
      economy: {
        beer: initialBeer,
        worstBeer: initialBeer,
        bankruptSince: null,
        bankruptDurationMs: 0
      },
      sauna: this.createSaunaProgress(),
      enemyKills: 0,
      exploration: { revealedHexes: 0 },
      startedAt: this.timeSource()
    } satisfies ObjectiveProgress;

    this.bootstrapStrongholds();
    this.attachMapListener();
    this.attachEventListeners();
    this.emitProgress();
    this.evaluateResolution();
  }

  onProgress(listener: ObjectiveProgressListener): void {
    this.progressListeners.add(listener);
  }

  offProgress(listener: ObjectiveProgressListener): void {
    this.progressListeners.delete(listener);
  }

  onResolution(listener: ObjectiveResolutionListener): void {
    if (this.resolution) {
      listener(this.resolution);
      return;
    }
    this.resolutionListeners.add(listener);
  }

  offResolution(listener: ObjectiveResolutionListener): void {
    this.resolutionListeners.delete(listener);
  }

  getProgress(): ObjectiveProgress {
    return cloneProgress(this.progress);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.clearRosterTimer();
    this.clearBankruptcyTimer();
    if (this.mapDisposer) {
      try {
        this.mapDisposer();
      } catch (error) {
        console.warn('Failed to detach map listener', error);
      }
      this.mapDisposer = null;
    }
    eventBus.off('unitDied', this.handleUnitDied);
    eventBus.off('unitSpawned', this.handleUnitSpawned);
    eventBus.off('resourceChanged', this.handleResourceChanged);
    eventBus.off('saunaDamaged', this.handleSaunaDamaged);
    eventBus.off('saunaDestroyed', this.handleSaunaDestroyed);
  }

  private bootstrapStrongholds(): void {
    this.map.forEachTile((tile, coord) => {
      this.captureExploration(coord, tile);
      if (this.isStronghold(tile.building)) {
        const key = this.coordKey(coord);
        this.strongholds.set(key, { alive: true });
      }
    });
    for (const metadata of listStrongholds()) {
      const key = this.coordKey(metadata.coord);
      const entry = this.strongholds.get(key);
      const alive = !metadata.captured;
      if (!entry) {
        this.strongholds.set(key, { alive });
      } else {
        entry.alive = alive;
      }
    }
    this.updateStrongholdTotals();
  }

  private attachMapListener(): void {
    this.mapDisposer = this.map.addTileChangeListener((coord: AxialCoord, tile: HexTile, change) => {
      let shouldEmit = false;
      if (change === 'fog' || change === 'created') {
        if (this.captureExploration(coord, tile)) {
          shouldEmit = true;
        }
      }
      if (change === 'building' || change === 'created') {
        const key = this.coordKey(coord);
        const entry = this.strongholds.get(key);
        const isStrongholdNow = this.isStronghold(tile.building);
        if (isStrongholdNow) {
          if (!entry) {
            this.strongholds.set(key, { alive: true });
          } else if (!entry.alive) {
            entry.alive = true;
          }
        } else if (entry?.alive) {
          entry.alive = false;
        }
        this.updateStrongholdTotals();
        shouldEmit = true;
      }
      if (shouldEmit) {
        this.emitProgress();
        this.evaluateResolution();
      }
    });
  }

  private captureExploration(coord: AxialCoord, tile: HexTile): boolean {
    if (tile.isFogged) {
      return false;
    }
    const key = this.coordKey(coord);
    const sizeBefore = this.revealedTiles.size;
    if (!this.revealedTiles.has(key)) {
      this.revealedTiles.add(key);
      this.progress.exploration.revealedHexes = this.revealedTiles.size;
    }
    return this.revealedTiles.size !== sizeBefore;
  }

  private attachEventListeners(): void {
    eventBus.on('unitDied', this.handleUnitDied);
    eventBus.on('unitSpawned', this.handleUnitSpawned);
    eventBus.on('resourceChanged', this.handleResourceChanged);
    eventBus.on('saunaDamaged', this.handleSaunaDamaged);
    eventBus.on('saunaDestroyed', this.handleSaunaDestroyed);
  }

  private readonly handleUnitDied = ({ unitFaction }: UnitDiedPayload): void => {
    if (unitFaction === 'player') {
      this.progress.roster.totalDeaths += 1;
      this.refreshRosterStatus();
      this.emitProgress();
      this.evaluateResolution();
      return;
    }
    this.progress.enemyKills += 1;
    this.emitProgress();
  };

  private readonly handleUnitSpawned = ({ unit }: { unit: Unit }): void => {
    if (unit.faction !== 'player') {
      return;
    }
    this.refreshRosterStatus();
    this.emitProgress();
  };

  private readonly handleResourceChanged = ({
    resource,
    total
  }: {
    resource: Resource;
    amount: number;
    total: number;
  }): void => {
    if (resource !== Resource.SAUNA_BEER) {
      return;
    }
    this.progress.economy.beer = total;
    if (total < this.progress.economy.worstBeer) {
      this.progress.economy.worstBeer = total;
    }
    if (total < 0) {
      if (this.bankruptSince === null) {
        this.bankruptSince = this.timeSource();
        this.progress.economy.bankruptSince = this.bankruptSince;
        this.startBankruptcyTimer();
      }
    } else {
      this.updateBankruptcyDuration();
      this.bankruptSince = null;
      this.progress.economy.bankruptSince = null;
      this.clearBankruptcyTimer();
    }
    this.emitProgress();
  };

  private readonly handleSaunaDamaged = ({ remainingHealth }: SaunaDamagedPayload): void => {
    if (this.disposed) {
      return;
    }
    this.updateSaunaSnapshot(remainingHealth);
    this.emitProgress();
  };

  private readonly handleSaunaDestroyed = (_payload: SaunaDestroyedPayload): void => {
    if (this.disposed) {
      return;
    }
    this.markSaunaDestroyed();
    this.emitProgress();
    this.resolve('lose', 'saunaDestroyed');
  };

  private startBankruptcyTimer(): void {
    if (this.bankruptcyTimeout !== null) {
      return;
    }
    if (this.bankruptcyGraceMs <= 0) {
      this.resolve('lose', 'bankruptcy');
      return;
    }
    this.bankruptcyTimeout = setTimeout(() => {
      this.updateBankruptcyDuration();
      this.resolve('lose', 'bankruptcy');
    }, this.bankruptcyGraceMs);
  }

  private clearBankruptcyTimer(): void {
    if (this.bankruptcyTimeout !== null) {
      clearTimeout(this.bankruptcyTimeout);
      this.bankruptcyTimeout = null;
    }
  }

  private startRosterTimer(): void {
    if (this.rosterTimeout !== null) {
      return;
    }
    if (this.rosterGraceMs <= 0) {
      this.resolve('lose', 'rosterWipe');
      return;
    }
    this.rosterTimeout = setTimeout(() => {
      this.updateRosterDuration();
      this.resolve('lose', 'rosterWipe');
    }, this.rosterGraceMs);
  }

  private clearRosterTimer(): void {
    if (this.rosterTimeout !== null) {
      clearTimeout(this.rosterTimeout);
      this.rosterTimeout = null;
    }
  }

  private updateStrongholdTotals(): void {
    const total = this.strongholds.size;
    let alive = 0;
    for (const entry of this.strongholds.values()) {
      if (entry.alive) {
        alive += 1;
      }
    }
    this.progress.strongholds.total = total;
    this.progress.strongholds.remaining = alive;
    this.progress.strongholds.destroyed = Math.max(0, total - alive);
  }

  private sampleRosterCount(): number {
    const raw = Number(this.getRosterCount());
    const normalized = Number.isFinite(raw) ? raw : 0;
    return Math.max(0, Math.round(normalized));
  }

  private refreshRosterStatus(): void {
    const count = this.sampleRosterCount();
    this.progress.roster.active = count;
    if (count <= 0) {
      if (this.wipeSince === null) {
        this.wipeSince = this.timeSource();
        this.progress.roster.wipeSince = this.wipeSince;
      }
      this.startRosterTimer();
    } else {
      this.updateRosterDuration();
      this.wipeSince = null;
      this.progress.roster.wipeSince = null;
      this.clearRosterTimer();
    }
  }

  private updateBankruptcyDuration(): void {
    if (this.bankruptSince === null) {
      return;
    }
    const duration = this.timeSource() - this.bankruptSince;
    if (duration > this.progress.economy.bankruptDurationMs) {
      this.progress.economy.bankruptDurationMs = duration;
    }
  }

  private updateRosterDuration(): void {
    if (this.wipeSince === null) {
      return;
    }
    const duration = this.timeSource() - this.wipeSince;
    if (duration > this.progress.roster.wipeDurationMs) {
      this.progress.roster.wipeDurationMs = duration;
    }
  }

  private evaluateResolution(): void {
    if (this.resolution) {
      return;
    }
    if (this.progress.sauna.destroyed) {
      this.resolve('lose', 'saunaDestroyed');
      return;
    }
    if (
      this.progress.strongholds.total > 0 &&
      this.progress.strongholds.remaining === 0
    ) {
      this.resolve('win', 'strongholds');
      return;
    }
    if (this.wipeSince !== null && this.rosterGraceMs <= 0) {
      this.resolve('lose', 'rosterWipe');
      return;
    }
    if (this.bankruptSince !== null && this.bankruptcyGraceMs <= 0) {
      this.resolve('lose', 'bankruptcy');
    }
  }

  private resolve(outcome: ObjectiveOutcome, cause: ObjectiveCause): void {
    if (this.resolution) {
      return;
    }
    this.updateRosterDuration();
    this.updateBankruptcyDuration();
    const timestamp = this.timeSource();
    const durationMs = Math.max(0, timestamp - this.progress.startedAt);
    const summary = cloneProgress({
      ...this.progress,
      roster: { ...this.progress.roster, wipeSince: this.wipeSince },
      economy: { ...this.progress.economy, bankruptSince: this.bankruptSince },
      sauna: { ...this.progress.sauna, destroyedAt: this.saunaDestroyedAt }
    });
    const rewards = this.computeRewards();
    this.resolution = Object.freeze({
      outcome,
      cause,
      timestamp,
      durationMs,
      summary,
      rewards
    });
    this.emitResolution();
    this.dispose();
  }

  private emitProgress(): void {
    const snapshot = this.getProgress();
    for (const listener of this.progressListeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('Objective progress listener failed', error);
      }
    }
  }

  private emitResolution(): void {
    if (!this.resolution) {
      return;
    }
    const snapshot = this.resolution;
    for (const listener of this.resolutionListeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('Objective resolution listener failed', error);
      }
    }
    this.resolutionListeners.clear();
  }

  private computeRewards(): ObjectiveRewards {
    const finalResources = captureResources(this.state);
    const resources: Record<Resource, ResourceSummary> = {
      [Resource.SAUNA_BEER]: {
        final: finalResources[Resource.SAUNA_BEER],
        delta: finalResources[Resource.SAUNA_BEER] - this.startResources[Resource.SAUNA_BEER]
      },
      [Resource.SAUNAKUNNIA]: {
        final: finalResources[Resource.SAUNAKUNNIA],
        delta:
          finalResources[Resource.SAUNAKUNNIA] - this.startResources[Resource.SAUNAKUNNIA]
      },
      [Resource.SISU]: {
        final: finalResources[Resource.SISU],
        delta: finalResources[Resource.SISU] - this.startResources[Resource.SISU]
      }
    };
    return { resources } satisfies ObjectiveRewards;
  }

  private coordKey(coord: AxialCoord): string {
    return `${coord.q},${coord.r}`;
  }

  private isStronghold(building: BuildingType | null): boolean {
    if (!building) {
      return false;
    }
    return this.strongholdTypes.has(building);
  }

  private createSaunaProgress(): SaunaProgress {
    if (!this.sauna) {
      return { maxHealth: 0, health: 0, destroyed: false, destroyedAt: null };
    }
    const maxHealth = Math.max(0, Math.round(this.sauna.maxHealth ?? 0));
    const health = Math.max(0, Math.round(this.sauna.health ?? 0));
    const destroyed = Boolean(this.sauna.destroyed) || health <= 0;
    if (destroyed && this.saunaDestroyedAt === null) {
      this.saunaDestroyedAt = this.timeSource();
    }
    return {
      maxHealth,
      health,
      destroyed,
      destroyedAt: destroyed ? this.saunaDestroyedAt : null
    } satisfies SaunaProgress;
  }

  private updateSaunaSnapshot(remainingHealth: number): void {
    const normalizedRemaining = Number.isFinite(remainingHealth)
      ? Math.max(0, Math.round(remainingHealth))
      : 0;
    const saunaMax = this.sauna ? Math.max(0, Math.round(this.sauna.maxHealth ?? 0)) : 0;
    const currentMax = this.progress.sauna.maxHealth;
    const nextMax = Math.max(currentMax, saunaMax, normalizedRemaining);
    this.progress.sauna.maxHealth = nextMax;
    const clamped = Math.max(0, Math.min(nextMax, normalizedRemaining));
    this.progress.sauna.health = clamped;
    if (clamped > 0) {
      this.progress.sauna.destroyed = false;
      this.progress.sauna.destroyedAt = null;
      this.saunaDestroyedAt = null;
    }
  }

  private markSaunaDestroyed(): void {
    if (this.sauna) {
      const saunaMax = Math.max(0, Math.round(this.sauna.maxHealth ?? 0));
      if (saunaMax > this.progress.sauna.maxHealth) {
        this.progress.sauna.maxHealth = saunaMax;
      }
    }
    this.progress.sauna.health = 0;
    this.progress.sauna.destroyed = true;
    if (this.saunaDestroyedAt === null) {
      this.saunaDestroyedAt = this.timeSource();
    }
    this.progress.sauna.destroyedAt = this.saunaDestroyedAt;
  }
}

export function createObjectiveTracker(options: ObjectiveTrackerOptions): ObjectiveTracker {
  return new ObjectiveTrackerImpl(options);
}

