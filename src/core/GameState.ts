/**
 * Simple game state tracking resources and policies.
 * Handles saving/loading via localStorage and offline progress.
 */
import { eventBus } from '../events/EventBus';

/** Available resource types. */
export enum Resource {
  GOLD = 'gold'
}

/** Default passive generation per tick for each resource. */
export const PASSIVE_GENERATION: Record<Resource, number> = {
  [Resource.GOLD]: 1
};

export class GameState {
  /** Current amounts of each resource. */
  resources: Record<Resource, number> = {
    [Resource.GOLD]: 0
  };

  /** Passive generation applied each tick. */
  private passiveGeneration: Record<Resource, number> = {
    ...PASSIVE_GENERATION
  };

  private lastSaved = Date.now();

  /** Track constructed buildings by type. */
  private buildings: Record<string, number> = {};

  /** Policies currently applied. */
  private policies = new Set<string>();

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
    localStorage.setItem(
      this.storageKey,
      JSON.stringify({ resources: this.resources, lastSaved: this.lastSaved })
    );
  }

  load(): void {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      this.lastSaved = Date.now();
      return;
    }
    try {
      const data = JSON.parse(raw) as {
        resources?: Record<Resource, number>;
        lastSaved?: number;
      };
      this.resources = { ...this.resources, ...data.resources };
      this.lastSaved = data.lastSaved ?? Date.now();
      const elapsed = Date.now() - this.lastSaved;
      const offlineTicks = Math.floor(elapsed / this.tickInterval);
      (Object.keys(this.passiveGeneration) as Resource[]).forEach((res) => {
        this.resources[res] += offlineTicks * this.passiveGeneration[res];
      });
    } catch {
      this.lastSaved = Date.now();
    }
  }

  /** Current amount of a resource. */
  getResource(res: Resource): number {
    return this.resources[res];
  }

  /** Determine if the player can afford a cost. */
  canAfford(cost: number, res: Resource = Resource.GOLD): boolean {
    return this.resources[res] >= cost;
  }

  private spend(cost: number, res: Resource = Resource.GOLD): boolean {
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
  construct(building: string, cost: number, res: Resource = Resource.GOLD): boolean {
    if (!this.spend(cost, res)) {
      return false;
    }
    this.buildings[building] = (this.buildings[building] ?? 0) + 1;
    return true;
  }

  /** Spend resources to upgrade a building. */
  upgrade(building: string, cost: number, res: Resource = Resource.GOLD): boolean {
    return this.construct(`upgrade:${building}`, cost, res);
  }

  /** Spend resources to apply a policy. */
  applyPolicy(policy: string, cost: number, res: Resource = Resource.GOLD): boolean {
    if (!this.spend(cost, res)) {
      return false;
    }
    this.policies.add(policy);
    eventBus.emit('policyApplied', { policy, state: this });
    return true;
  }
}
