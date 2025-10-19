import rosterBadgeUrl from '../../assets/ui/saunoja-roster.svg';
import saunaBeerUrl from '../../assets/ui/sauna-beer.svg';
import resourceBadgeUrl from '../../assets/ui/resource.svg';
import soundBadgeUrl from '../../assets/ui/sound.svg';
import cadenceBadgeUrl from '../../assets/ui/hud-scaling.svg';

const integerFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export type SaunaTierId =
  | 'ember-circuit'
  | 'aurora-ward'
  | 'glacial-rhythm'
  | 'mythic-conclave'
  | 'solstice-cadence'
  | 'celestial-reserve';

export interface SaunaTierArt {
  /** Inline badge art for the tier chip. */
  badge: string;
  /** Optional background glow for accenting the badge. */
  glow?: string;
}

export type SaunaTierUnlock =
  | { type: 'default'; label: string }
  | { type: 'artocoin'; cost: number; label?: string };

export interface SaunaTier {
  id: SaunaTierId;
  name: string;
  rosterCap: number;
  description: string;
  art: SaunaTierArt;
  unlock: SaunaTierUnlock;
  /** Multiplier applied to the attendant spawn cadence. */
  spawnSpeedMultiplier?: number;
}

export interface SaunaTierContext {
  artocoinBalance: number;
  ownedTierIds: ReadonlySet<SaunaTierId> | SaunaTierId[];
}

export interface SaunaTierStatus {
  tier: SaunaTier;
  unlocked: boolean;
  owned: boolean;
  affordable: boolean;
  cost: number | null;
  progress: number;
  requirementLabel: string;
}

const DEFAULT_CONTEXT: SaunaTierContext = Object.freeze({
  artocoinBalance: 0,
  ownedTierIds: Object.freeze(new Set<SaunaTierId>())
});

const DEFAULT_UNLOCK_LABELS: Record<SaunaTierUnlock['type'], string> = {
  default: 'Included with the sauna key',
  artocoin: 'Invest artocoins'
};

function sanitizeSpawnSpeedMultiplier(value: number | null | undefined): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  const multiplier = Number(value);
  return multiplier > 0 ? multiplier : 1;
}

function formatSpawnSpeedLabel(multiplier: number | null | undefined): string | null {
  const sanitized = sanitizeSpawnSpeedMultiplier(multiplier);
  if (Math.abs(sanitized - 1) < 1e-6) {
    return null;
  }
  const percent = Math.round((sanitized - 1) * 100);
  if (percent === 0) {
    return 'Spawn cadence stabilized';
  }
  return percent > 0 ? `Spawn speed +${percent}%` : `Spawn speed ${percent}%`;
}

export const SAUNA_TIERS: readonly SaunaTier[] = Object.freeze([
  {
    id: 'ember-circuit',
    name: 'Ember Circuit Sauna',
    rosterCap: 3,
    description:
      'Charcoal-warmed benches and ember-glow lanterns cradle a trio of loyal guardians awaiting battle.',
    art: {
      badge: rosterBadgeUrl,
      glow: 'linear-gradient(145deg, rgba(255,161,76,0.65), rgba(255,226,173,0.18))'
    },
    unlock: {
      type: 'default',
      label: 'Included with the Ember Circuit sauna key'
    },
    spawnSpeedMultiplier: 1
  },
  {
    id: 'aurora-ward',
    name: 'Aurora Ward Gallery',
    rosterCap: 4,
    description:
      'Prismatic timberwork expands the benches, inviting a fourth attendant to stand guard beneath auroral light.',
    art: {
      badge: rosterBadgeUrl,
      glow: 'linear-gradient(140deg, rgba(128,208,255,0.7), rgba(61,184,255,0.2))'
    },
    unlock: {
      type: 'artocoin',
      cost: 70,
      label: 'Expand into the Aurora Ward for 70 artocoins'
    },
    spawnSpeedMultiplier: 1
  },
  {
    id: 'glacial-rhythm',
    name: 'Glacial Rhythm Retreat',
    rosterCap: 4,
    description:
      'Crystalline steam vents pulse in measured waves, accelerating attendant call-ups without crowding the benches.',
    art: {
      badge: saunaBeerUrl,
      glow: 'linear-gradient(135deg, rgba(120,215,255,0.65), rgba(167,255,238,0.18))'
    },
    unlock: {
      type: 'artocoin',
      cost: 110,
      label: 'Tune the Glacial Rhythm for 110 artocoins'
    },
    spawnSpeedMultiplier: 1.15
  },
  {
    id: 'mythic-conclave',
    name: 'Mythic Conclave Vault',
    rosterCap: 5,
    description:
      'Runic latticework folds the vault wider, granting a fifth sentinel to watch the sauna’s shimmering core.',
    art: {
      badge: resourceBadgeUrl,
      glow: 'linear-gradient(135deg, rgba(176,106,255,0.72), rgba(245,199,255,0.2))'
    },
    unlock: {
      type: 'artocoin',
      cost: 160,
      label: 'Endow the Mythic Conclave for 160 artocoins'
    },
    spawnSpeedMultiplier: 1.15
  },
  {
    id: 'solstice-cadence',
    name: 'Solstice Cadence Atelier',
    rosterCap: 5,
    description:
      'Sunstone gongs and mirrored vents quicken the spawn cadence, ushering reinforcements with blazing tempo.',
    art: {
      badge: soundBadgeUrl,
      glow: 'linear-gradient(135deg, rgba(255,209,112,0.72), rgba(255,130,96,0.18))'
    },
    unlock: {
      type: 'artocoin',
      cost: 210,
      label: 'Score the Solstice Cadence for 210 artocoins'
    },
    spawnSpeedMultiplier: 1.3
  },
  {
    id: 'celestial-reserve',
    name: 'Celestial Reserve Sanctum',
    rosterCap: 6,
    description:
      'Starlit balustrades unfurl a sixth berth while chronothermic conduits keep the accelerated muster steady.',
    art: {
      badge: cadenceBadgeUrl,
      glow: 'linear-gradient(135deg, rgba(222,199,255,0.76), rgba(152,209,255,0.22))'
    },
    unlock: {
      type: 'artocoin',
      cost: 280,
      label: 'Crown the Celestial Reserve for 280 artocoins'
    },
    spawnSpeedMultiplier: 1.3
  }
] satisfies readonly SaunaTier[]);

export const DEFAULT_SAUNA_TIER_ID: SaunaTierId = SAUNA_TIERS[0]!.id;

const TIER_PERK_LABELS: ReadonlyMap<SaunaTierId, string> = (() => {
  const entries: [SaunaTierId, string][] = [];
  let previousRosterCap = 0;
  let previousSpeed = 1;
  for (const tier of SAUNA_TIERS) {
    const rosterCap = Math.max(0, Math.floor(Number.isFinite(tier.rosterCap) ? tier.rosterCap : 0));
    const speed = sanitizeSpawnSpeedMultiplier(tier.spawnSpeedMultiplier);
    let perk: string | null = null;
    if (rosterCap > previousRosterCap) {
      perk = `Roster cap ${rosterCap}`;
    }
    const speedLabel = formatSpawnSpeedLabel(speed);
    if (!perk && speed > previousSpeed + 1e-6 && speedLabel) {
      perk = speedLabel;
    }
    if (!perk) {
      perk = speedLabel ?? `Roster cap ${rosterCap}`;
    }
    entries.push([tier.id, perk]);
    previousRosterCap = rosterCap;
    previousSpeed = speed;
  }
  return new Map(entries);
})();

function getTierPerkLabel(tier: SaunaTier): string {
  return TIER_PERK_LABELS.get(tier.id) ?? `Roster cap ${tier.rosterCap}`;
}

const TIERS_BY_ID = new Map<SaunaTierId, SaunaTier>(SAUNA_TIERS.map((tier) => [tier.id, tier]));

export function listSaunaTiers(): readonly SaunaTier[] {
  return SAUNA_TIERS;
}

export function getSaunaTier(id: SaunaTierId | string | null | undefined): SaunaTier {
  if (id && TIERS_BY_ID.has(id as SaunaTierId)) {
    return TIERS_BY_ID.get(id as SaunaTierId)!;
  }
  return TIERS_BY_ID.get(DEFAULT_SAUNA_TIER_ID)!;
}

function clampUnit(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (min === max) {
    return min;
  }
  const clamped = Math.max(min, Math.min(max, value));
  if (Number.isNaN(clamped)) {
    return min;
  }
  return clamped;
}

function resolveUnlockLabel(unlock: SaunaTierUnlock): string {
  if (unlock.label) {
    return unlock.label;
  }
  const base = DEFAULT_UNLOCK_LABELS[unlock.type];
  if (!base) {
    return '';
  }
  if (unlock.type === 'artocoin') {
    const cost = Math.max(0, Math.floor(Number.isFinite(unlock.cost) ? unlock.cost : 0));
    if (cost > 0) {
      return `${base} ${integerFormatter.format(cost)}`;
    }
  }
  return base;
}

export function evaluateSaunaTier(
  tier: SaunaTier,
  context: SaunaTierContext | null | undefined
): SaunaTierStatus {
  const safeContext = context ?? DEFAULT_CONTEXT;
  const ownedSource = safeContext.ownedTierIds;
  const ownedSet =
    ownedSource instanceof Set
      ? ownedSource
      : new Set(Array.isArray(ownedSource) ? ownedSource : []);

  if (tier.unlock.type === 'default') {
    return {
      tier,
      unlocked: true,
      owned: true,
      affordable: true,
      cost: null,
      progress: 1,
      requirementLabel: resolveUnlockLabel(tier.unlock)
    } satisfies SaunaTierStatus;
  }

  if (tier.unlock.type === 'artocoin') {
    const cost = Math.max(0, Math.floor(Number.isFinite(tier.unlock.cost) ? tier.unlock.cost : 0));
    const balance = Math.max(0, Math.floor(Number.isFinite(safeContext.artocoinBalance) ? safeContext.artocoinBalance : 0));
    const owned = ownedSet.has(tier.id);
    const affordable = balance >= cost;
    const unlocked = owned;
    const progress = owned ? 1 : cost === 0 ? 1 : clampUnit(balance / cost, 0, 1);
    const deficit = Math.max(0, cost - balance);
    const formattedCost = integerFormatter.format(cost);
    const shortfall = deficit > 0 ? integerFormatter.format(deficit) : null;
    const perkLabel = getTierPerkLabel(tier);
    let requirementLabel: string;
    if (owned) {
      requirementLabel = perkLabel;
    } else {
      const baseLabel = tier.unlock.label ?? `Invest ${formattedCost} artocoins`;
      const augmentedLabel = perkLabel ? `${baseLabel} (${perkLabel})` : baseLabel;
      if (shortfall) {
        requirementLabel = `${augmentedLabel} — Need ${shortfall} more`;
      } else if (cost > 0) {
        requirementLabel = `${augmentedLabel} — Ready to unlock`;
      } else {
        requirementLabel = augmentedLabel;
      }
    }

    return {
      tier,
      unlocked,
      owned,
      affordable,
      cost,
      progress,
      requirementLabel
    } satisfies SaunaTierStatus;
  }

  return {
    tier,
    unlocked: false,
    owned: false,
    affordable: false,
    cost: null,
    progress: 0,
    requirementLabel: resolveUnlockLabel(tier.unlock)
  } satisfies SaunaTierStatus;
}
