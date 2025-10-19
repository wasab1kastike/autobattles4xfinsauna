export interface UnitStats {
  health: number;
  attackDamage: number;
  attackRange: number;
  movementRange: number;
  visionRange?: number;
  defense?: number;
  damageTakenMultiplier?: number;
}

export type UnitBehavior = 'defend' | 'attack' | 'explore';

export type LevelCurve = 'linear' | 'accelerating' | 'diminishing';

export type RoundingMode = 'floor' | 'ceil' | 'round' | 'none';

export interface StatProgression {
  /** Base value applied at level 1. */
  base: number;
  /** Increment applied according to {@link curve} for each level beyond 1. */
  growth: number;
  /** Curve to apply when scaling beyond the base level. */
  curve?: LevelCurve;
  /** Minimum bound applied after growth and rounding. */
  min?: number;
  /** Maximum bound applied after growth and rounding. */
  max?: number;
  /** How the computed value should be rounded. */
  round?: RoundingMode;
}

export interface UnitProgressionMap {
  health: StatProgression;
  attackDamage: StatProgression;
  attackRange: StatProgression;
  movementRange: StatProgression;
  visionRange?: StatProgression;
}

export type UnitArchetypeId =
  | 'soldier'
  | 'archer'
  | 'avanto-marauder'
  | 'raider'
  | 'raider-captain'
  | 'raider-shaman'
  | 'aurora-warden'
  | 'glacier-sentinel'
  | 'spirit-keeper'
  | 'ember-highlord'
  | 'stronghold-structure';

export interface UnitArchetypeDefinition {
  id: UnitArchetypeId;
  displayName: string;
  description?: string;
  cost: number;
  tags?: string[];
  priorityFactions?: string[];
  stats: UnitProgressionMap;
}

export interface UnitBuildOptions {
  /** Optional level override; defaults to 1. */
  level?: number;
  /** Preferred battlefield routine. */
  behavior?: UnitBehavior;
}
