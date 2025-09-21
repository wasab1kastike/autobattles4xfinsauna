import rosterBadgeUrl from '../../assets/ui/saunoja-roster.svg';
import saunaBeerUrl from '../../assets/ui/sauna-beer.svg';
import resourceBadgeUrl from '../../assets/ui/resource.svg';

const integerFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export type SaunaTierId = 'ember-circuit' | 'aurora-ward' | 'mythic-conclave';

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
  /** Hex radius revealed around the sauna when this tier is active. */
  visionRange: number;
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

export const SAUNA_TIERS: readonly SaunaTier[] = Object.freeze([
  {
    id: 'ember-circuit',
    name: 'Ember Circuit',
    rosterCap: 3,
    description: 'Classic cedar benches with a loyal trio of attendants.',
    art: {
      badge: rosterBadgeUrl,
      glow: 'linear-gradient(145deg, rgba(255,161,76,0.65), rgba(255,226,173,0.18))'
    },
    visionRange: 4,
    unlock: {
      type: 'default',
      label: 'Available from the first steam session'
    }
  },
  {
    id: 'aurora-ward',
    name: 'Aurora Ward',
    rosterCap: 4,
    description: 'Glacial glass benches and a quartet ready to repel sieges.',
    art: {
      badge: saunaBeerUrl,
      glow: 'linear-gradient(140deg, rgba(128,208,255,0.7), rgba(61,184,255,0.2))'
    },
    visionRange: 10,
    unlock: {
      type: 'artocoin',
      cost: 150,
      label: 'Commission with 150 artocoins'
    }
  },
  {
    id: 'mythic-conclave',
    name: 'Mythic Conclave',
    rosterCap: 6,
    description: 'Runic obsidian tiers where six legends guard the löyly.',
    art: {
      badge: resourceBadgeUrl,
      glow: 'linear-gradient(135deg, rgba(176,106,255,0.72), rgba(245,199,255,0.2))'
    },
    visionRange: 20,
    unlock: {
      type: 'artocoin',
      cost: 275,
      label: 'Fund with 275 artocoins'
    }
  }
] satisfies readonly SaunaTier[]);

export const DEFAULT_SAUNA_TIER_ID: SaunaTierId = SAUNA_TIERS[0]!.id;

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
    let requirementLabel: string;
    if (owned) {
      requirementLabel = `Roster cap ${tier.rosterCap}`;
    } else {
      const baseLabel = tier.unlock.label ?? `Invest ${formattedCost} artocoins`;
      if (shortfall) {
        requirementLabel = `${baseLabel} — Need ${shortfall} more`;
      } else if (cost > 0) {
        requirementLabel = `${baseLabel} — Ready to unlock`;
      } else {
        requirementLabel = baseLabel;
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
