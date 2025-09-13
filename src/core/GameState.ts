/**
 * Simple game state tracking a single numeric resource.
 * Handles saving/loading via localStorage and offline progress.
 */
export class GameState {
  resources = 0;
  private lastSaved = Date.now();

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
}
