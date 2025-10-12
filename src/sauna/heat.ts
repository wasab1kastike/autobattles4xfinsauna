export interface SaunaHeatConfig {
  /** Base threshold of heat required to trigger a spawn. */
  baseThreshold: number;
  /** Heat gained per simulated second. */
  heatPerSecond: number;
  /**
   * Growth applied to the threshold after each trigger. A value of 0.05
   * increases the threshold by 5% whenever heat is spent on a spawn.
   */
  thresholdGrowth: number;
  /** Passive cooling applied every simulated second. */
  coolingPerSecond: number;
  /** Optional cap on how much heat can be stored. */
  maxStoredHeat?: number;
}

export interface SaunaHeatInit extends Partial<SaunaHeatConfig> {
  /** Starting heat when the tracker is created. */
  initialHeat?: number;
  /** Optional override for the first threshold. */
  initialThreshold?: number;
}

export interface SaunaHeatAdvanceResult {
  /** Amount of heat successfully added during the advance call. */
  addedHeat: number;
  /** Amount of heat removed via passive cooling. */
  cooledHeat: number;
  /** Heat stored after the advance completes. */
  heat: number;
}

export const DEFAULT_SAUNA_HEAT_CONFIG: SaunaHeatConfig = {
  baseThreshold: 50,
  heatPerSecond: 50 / 30,
  thresholdGrowth: 0.05,
  coolingPerSecond: 0
};

function sanitizeNumber(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

export class SaunaHeat {
  private heat: number;
  private threshold: number;
  private readonly baseThreshold: number;
  private readonly thresholdGrowthFactor: number;
  private readonly heatPerSecond: number;
  private readonly coolingPerSecond: number;
  private readonly maxStoredHeat: number | null;

  constructor(config: SaunaHeatInit = {}) {
    const merged: SaunaHeatConfig = {
      ...DEFAULT_SAUNA_HEAT_CONFIG,
      ...config
    };

    const baseThreshold = Math.max(1, sanitizeNumber(merged.baseThreshold, 50));
    const initialThreshold = Math.max(
      1,
      sanitizeNumber(config.initialThreshold ?? baseThreshold, baseThreshold)
    );

    this.baseThreshold = baseThreshold;
    this.threshold = initialThreshold;
    this.thresholdGrowthFactor = 1 + Math.max(0, sanitizeNumber(merged.thresholdGrowth, 0));
    this.heatPerSecond = Math.max(0, sanitizeNumber(merged.heatPerSecond, 0));
    this.coolingPerSecond = Math.max(0, sanitizeNumber(merged.coolingPerSecond, 0));

    const maxStoredHeat = sanitizeNumber(merged.maxStoredHeat ?? Number.NaN, Number.NaN);
    this.maxStoredHeat = Number.isFinite(maxStoredHeat) && maxStoredHeat >= 0 ? maxStoredHeat : null;

    const initialHeat = Math.max(0, sanitizeNumber(config.initialHeat ?? 0, 0));
    this.heat = this.setHeatInternal(initialHeat);
  }

  /** Current stored heat. */
  getHeat(): number {
    return this.heat;
  }

  /** Heat required to trigger the next spawn. */
  getThreshold(): number {
    return this.threshold;
  }

  /** Passive heat gain rate per simulated second. */
  getBuildRate(): number {
    return this.heatPerSecond;
  }

  /** Passive cooling applied each simulated second. */
  getCoolingRate(): number {
    return this.coolingPerSecond;
  }

  /** Reset heat and threshold to their initial values. */
  reset(): void {
    this.heat = 0;
    this.threshold = this.baseThreshold;
  }

  /** Force the stored heat to a specific value, respecting any configured cap. */
  setHeat(value: number): number {
    const sanitized = Math.max(0, sanitizeNumber(value, 0));
    this.heat = this.setHeatInternal(sanitized);
    return this.heat;
  }

  private setHeatInternal(value: number): number {
    const sanitized = Math.max(0, sanitizeNumber(value, 0));
    if (this.maxStoredHeat === null) {
      this.heat = sanitized;
      return this.heat;
    }
    this.heat = Math.min(sanitized, this.maxStoredHeat);
    return this.heat;
  }

  private addHeat(amount: number): number {
    const sanitized = Math.max(0, sanitizeNumber(amount, 0));
    if (sanitized <= 0) {
      return 0;
    }
    const before = this.heat;
    const next = before + sanitized;
    this.heat = this.maxStoredHeat === null ? next : Math.min(next, this.maxStoredHeat);
    return this.heat - before;
  }

  /** Remove heat by a direct amount. */
  cool(amount: number): number {
    const sanitized = Math.max(0, sanitizeNumber(amount, 0));
    if (sanitized <= 0 || this.heat <= 0) {
      return 0;
    }
    const before = this.heat;
    this.heat = Math.max(0, this.heat - sanitized);
    return before - this.heat;
  }

  /** Reduce heat by a fraction of the current threshold. */
  vent(fraction = 1): number {
    const clamped = Math.max(0, Math.min(1, sanitizeNumber(fraction, 1)));
    if (clamped <= 0) {
      return 0;
    }
    return this.cool(this.threshold * clamped);
  }

  /**
   * Advance the simulation by a number of seconds, applying heat gain and
   * passive cooling. Returns how much heat changed during the advance.
   */
  advance(seconds: number, options?: { bonusHeat?: number; coolingMultiplier?: number }): SaunaHeatAdvanceResult {
    const dt = Math.max(0, sanitizeNumber(seconds, 0));
    const heatRate = this.heatPerSecond;
    const addedFromRate = dt > 0 ? heatRate * dt : 0;
    const bonusHeat = Math.max(0, sanitizeNumber(options?.bonusHeat ?? 0, 0));
    const totalAdded = addedFromRate + bonusHeat;
    const addedHeat = this.addHeat(totalAdded);

    const coolingMultiplier = Math.max(0, sanitizeNumber(options?.coolingMultiplier ?? 1, 1));
    const coolingTarget = dt > 0 ? this.coolingPerSecond * dt * coolingMultiplier : 0;
    const cooled = this.cool(coolingTarget);

    return {
      addedHeat,
      cooledHeat: cooled,
      heat: this.heat
    };
  }

  /** Check whether the stored heat meets or exceeds the current threshold. */
  hasTriggerReady(): boolean {
    return this.heat >= this.threshold - 1e-6;
  }

  /** Spend heat on a trigger, advancing the next threshold. */
  consumeTrigger(): boolean {
    if (!this.hasTriggerReady()) {
      return false;
    }
    this.cool(this.threshold);
    this.threshold = Math.max(this.baseThreshold, this.threshold * this.thresholdGrowthFactor);
    return true;
  }

  /** Seconds until the next trigger fires if heat gain continues unabated. */
  timeUntilNextTrigger(): number {
    if (this.hasTriggerReady()) {
      return 0;
    }
    if (this.heatPerSecond <= 0) {
      return Number.POSITIVE_INFINITY;
    }
    const remaining = Math.max(0, this.threshold - this.heat);
    return remaining / this.heatPerSecond;
  }

  /** Duration of a full heat cycle at the current threshold. */
  getCooldownSeconds(): number {
    if (this.heatPerSecond <= 0) {
      return Number.POSITIVE_INFINITY;
    }
    return this.threshold / this.heatPerSecond;
  }
}

export function createSaunaHeat(config?: SaunaHeatInit): SaunaHeat {
  return new SaunaHeat(config);
}
