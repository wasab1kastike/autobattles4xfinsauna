/**
 * Simple game state tracking resources and policies.
 * Handles saving/loading via localStorage and offline progress.
 */
import { eventBus } from '../events/EventBus';
import type { AxialCoord } from '../hex/HexUtils.ts';
import type { HexMap } from '../hexmap.ts';
import { Farm, Barracks, type Building } from '../buildings/index.ts';
import { markRevealed } from '../camera/autoFrame.ts';
import { safeLoadJSON } from '../loader.ts';

function coordKey(c: AxialCoord): string {
  return `${c.q},${c.r}`;
}

const BUILDING_FACTORIES: Record<string, () => Building> = {
  farm: () => new Farm(),
  barracks: () => new Barracks()
};

function createBuilding(type: string): Building | undefined {
  return BUILDING_FACTORIES[type]?.();
}

/** Available resource types. */
export enum Resource {
  SAUNA_BEER = 'sauna-beer',
  SAUNAKUNNIA = 'saunakunnia'
}

/** Default passive generation per tick for each resource. */
export const PASSIVE_GENERATION: Record<Resource, number> = {
  [Resource.SAUNA_BEER]: 1,
  [Resource.SAUNAKUNNIA]: 0
};

// Shape of the serialized game state stored in localStorage.
type SerializedState = {
  resources: Record<Resource, number>;
  lastSaved: number;
  buildings: Record<string, number>;
  buildingPlacements: Record<string, string>;
};

export class GameState {
  /** Current amounts of each resource. */
  resources: Record<Resource, number> = {
    [Resource.SAUNA_BEER]: 0,
    [Resource.SAUNAKUNNIA]: 0
  };

  /** Passive generation applied each tick. */
  private passiveGeneration: Record<Resource, number> = {
    ...PASSIVE_GENERATION
  };

  private lastSaved = Date.now();

  /** Track constructed buildings by type. */
  private buildings: Record<string, number> = {};

  /** Mapping of tile coordinates to constructed building instances. */
  private buildingPlacements = new Map<string, Building>();

  /** Policies currently applied. */
  private policies = new Set<string>();

  /** Modifier for work speed during night, affected by policies. */
  nightWorkSpeedMultiplier = 1;

  constructor(
    private readonly tickInterval: number,
    private readonly storageKey = 'gameState'
  ) {}

  /** Increment resources by passive generation. */
  tick(): void {
    (Object.keys(this.passiveGeneration) as Resource[]).forEach((res) => {
      this.addResource(res, this.passiveGeneration[res]);
    });
  }

  save(): void {
    this.lastSaved = Date.now();
    const placements: Record<string, string> = {};
    this.buildingPlacements.forEach((b, k) => {
      placements[k] = b.type;
    });
    const serialized: SerializedState = {
      resources: this.resources,
      lastSaved: this.lastSaved,
      buildings: this.buildings,
      buildingPlacements: placements
    };
    localStorage.setItem(this.storageKey, JSON.stringify(serialized));
  }

  load(map?: HexMap): void {
    const data = safeLoadJSON<Partial<SerializedState>>(this.storageKey);
    if (!data) {
      this.lastSaved = Date.now();
      return;
    }
    this.resources = { ...this.resources, ...data.resources };
    (Object.keys(this.resources) as Resource[]).forEach((res) => {
      if (!Number.isFinite(this.resources[res])) {
        this.resources[res] = 0;
      }
    });
    const validBuildings: Record<string, number> = {};
    Object.entries(data.buildings ?? {}).forEach(([type, count]) => {
      if (BUILDING_FACTORIES[type]) {
        validBuildings[type] = count;
      }
    });
    this.buildings = validBuildings;
    this.buildingPlacements.clear();
    if (data.buildingPlacements) {
      Object.entries(data.buildingPlacements).forEach(([key, type]) => {
        const b = createBuilding(type);
        if (!b) return;
        this.buildingPlacements.set(key, b);
        const [q, r] = key.split(',').map(Number);
        if (map) {
          const tile = map.ensureTile(q, r);
          tile.placeBuilding(b.type);
          tile.reveal();
          markRevealed({ q, r }, map.hexSize);
        }
        eventBus.emit('buildingPlaced', { building: b, coord: { q, r }, state: this });
      });
    }
    this.lastSaved = data.lastSaved ?? Date.now();
    const elapsed = Date.now() - this.lastSaved;
    const offlineTicks = Math.floor(elapsed / this.tickInterval);
    (Object.keys(this.passiveGeneration) as Resource[]).forEach((res) => {
      this.resources[res] += offlineTicks * this.passiveGeneration[res];
    });
  }

  /** Current amount of a resource. */
  getResource(res: Resource): number {
    return this.resources[res];
  }

  /** Determine if the player can afford a cost. */
  canAfford(cost: number, res: Resource = Resource.SAUNA_BEER): boolean {
    return this.resources[res] >= cost;
  }

  private spend(cost: number, res: Resource = Resource.SAUNA_BEER): boolean {
    if (!this.canAfford(cost, res)) {
      return false;
    }
    this.resources[res] -= cost;
    eventBus.emit('resourceChanged', {
      resource: res,
      amount: -cost,
      total: this.resources[res]
    });
    return true;
  }

  /** Add resources and emit change event. */
  addResource(res: Resource, amount: number): void {
    this.resources[res] += amount;
    eventBus.emit('resourceChanged', {
      resource: res,
      amount,
      total: this.resources[res]
    });
  }

  /** Modify passive generation for a resource. */
  modifyPassiveGeneration(res: Resource, delta: number): void {
    this.passiveGeneration[res] =
      (this.passiveGeneration[res] ?? 0) + delta;
  }

  /** Spend resources to construct a building of the given type. */
  construct(building: string, cost: number, res: Resource = Resource.SAUNA_BEER): boolean {
    if (!this.spend(cost, res)) {
      return false;
    }
    this.buildings[building] = (this.buildings[building] ?? 0) + 1;
    return true;
  }

  /**
   * Place a building instance on the given map coordinate if affordable and vacant.
   * Returns true on success.
   */
  placeBuilding(
    building: Building,
    coord: AxialCoord,
    map: HexMap,
    res: Resource = Resource.SAUNA_BEER
  ): boolean {
    const tile = map.getTile(coord.q, coord.r);
    if (!tile || tile.building) {
      return false;
    }
    if (!this.construct(building.type, building.cost, res)) {
      return false;
    }
    this.buildingPlacements.set(coordKey(coord), building);
    tile.placeBuilding(building.type);
    eventBus.emit('buildingPlaced', { building, coord, state: this });
    return true;
  }

  /** Retrieve a building instance at the given coordinate, if any. */
  getBuildingAt(coord: AxialCoord): Building | undefined {
    return this.buildingPlacements.get(coordKey(coord));
  }

  /**
   * Remove a building at the given coordinate if one exists.
   * Returns true if a building was removed.
   */
  removeBuilding(coord: AxialCoord, map: HexMap): boolean {
    const key = coordKey(coord);
    const building = this.buildingPlacements.get(key);
    if (!building) {
      return false;
    }
    this.buildingPlacements.delete(key);
    const tile = map.getTile(coord.q, coord.r);
    tile?.placeBuilding(null);
    if (this.buildings[building.type] !== undefined) {
      this.buildings[building.type] -= 1;
      if (this.buildings[building.type] <= 0) {
        delete this.buildings[building.type];
      }
    }
    eventBus.emit('buildingRemoved', { building, coord, state: this });
    return true;
  }

  /** Spend resources to upgrade a building. */
  upgrade(building: string, cost: number, res: Resource = Resource.SAUNA_BEER): boolean {
    return this.construct(`upgrade:${building}`, cost, res);
  }

  /** Spend resources to apply a policy. */
  applyPolicy(
    policy: string,
    cost: number,
    res: Resource = Resource.SAUNAKUNNIA
  ): boolean {
    if (!this.spend(cost, res)) {
      return false;
    }
    this.policies.add(policy);
    eventBus.emit('policyApplied', { policy, state: this });
    return true;
  }

  /** Check if a policy has been applied. */
  hasPolicy(policy: string): boolean {
    return this.policies.has(policy);
  }
}
