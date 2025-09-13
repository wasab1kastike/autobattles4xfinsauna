/**
 * Simple game state tracking a single numeric resource.
 * Handles saving/loading via localStorage and offline progress.
 */
export class GameState {
  resources = 0;
  private lastSaved = Date.now();

  /** Track constructed buildings by type. */
  private buildings: Record<string, number> = {};

  /** Policies currently applied. */
  private policies = new Set<string>();

  constructor(
    private readonly tickInterval: number,
    private readonly resourcePerTick = 1,
    private readonly storageKey = 'gameState'
  ) {}

  tick(): void {
    this.resources += this.resourcePerTick;
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
      const data = JSON.parse(raw) as { resources?: number; lastSaved?: number };
      this.resources = data.resources ?? 0;
      this.lastSaved = data.lastSaved ?? Date.now();
      const elapsed = Date.now() - this.lastSaved;
      const offlineTicks = Math.floor(elapsed / this.tickInterval);
      this.resources += offlineTicks * this.resourcePerTick;
    } catch {
      this.lastSaved = Date.now();
    }
  }

  /** Determine if the player can afford a cost. */
  canAfford(cost: number): boolean {
    return this.resources >= cost;
  }

  /** Spend resources to construct a building of the given type. */
  construct(building: string, cost: number): boolean {
    if (!this.canAfford(cost)) {
      return false;
    }
    this.resources -= cost;
    this.buildings[building] = (this.buildings[building] ?? 0) + 1;
    return true;
  }

  /** Spend resources to upgrade a building. */
  upgrade(building: string, cost: number): boolean {
    return this.construct(`upgrade:${building}`, cost);
  }

  /** Spend resources to apply a policy. */
  applyPolicy(policy: string, cost: number): boolean {
    if (!this.canAfford(cost)) {
      return false;
    }
    this.resources -= cost;
    this.policies.add(policy);
    return true;
  }
}
