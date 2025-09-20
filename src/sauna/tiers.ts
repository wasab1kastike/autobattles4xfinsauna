import rosterBadgeUrl from '../../assets/ui/saunoja-roster.svg';
import saunaBeerUrl from '../../assets/ui/sauna-beer.svg';
import resourceBadgeUrl from '../../assets/ui/resource.svg';

export type SaunaTierId = 'ember-circuit' | 'aurora-ward' | 'mythic-conclave';

export interface SaunaTierArt {
  /** Inline badge art for the tier chip. */
  badge: string;
  /** Optional background glow for accenting the badge. */
  glow?: string;
}

export type SaunaTierUnlock =
  | { type: 'default'; label: string }
  | { type: 'ngPlusLevel'; level: number; label?: string }
  | { type: 'unlockSlots'; slots: number; label?: string };

export interface SaunaTier {
  id: SaunaTierId;
  name: string;
  rosterCap: number;
  description: string;
  art: SaunaTierArt;
  unlock: SaunaTierUnlock;
}

export interface SaunaTierContext {
  ngPlusLevel: number;
  unlockSlots: number;
}

export interface SaunaTierStatus {
  tier: SaunaTier;
  unlocked: boolean;
  progress: number;
  requirementLabel: string;
}

const DEFAULT_CONTEXT: SaunaTierContext = Object.freeze({
  ngPlusLevel: 0,
  unlockSlots: 0
});

const DEFAULT_UNLOCK_LABELS: Record<SaunaTierUnlock['type'], string> = {
  default: 'Included with the sauna key',
  ngPlusLevel: 'Reach NG+ level',
  unlockSlots: 'Earn roster unlocks'
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
    unlock: {
      type: 'unlockSlots',
      slots: 2,
      label: 'Secure 2 roster unlocks'
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
    unlock: {
      type: 'ngPlusLevel',
      level: 3,
      label: 'Prestige to NG+ level 3'
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
  switch (unlock.type) {
    case 'ngPlusLevel':
      return `${base} ${unlock.level}`;
    case 'unlockSlots':
      return `${base} ${unlock.slots}`;
    default:
      return base;
  }
}

export function evaluateSaunaTier(
  tier: SaunaTier,
  context: SaunaTierContext | null | undefined
): SaunaTierStatus {
  const safeContext = context ?? DEFAULT_CONTEXT;
  if (tier.unlock.type === 'default') {
    return {
      tier,
      unlocked: true,
      progress: 1,
      requirementLabel: resolveUnlockLabel(tier.unlock)
    } satisfies SaunaTierStatus;
  }

  if (tier.unlock.type === 'ngPlusLevel') {
    const progress = clampUnit(safeContext.ngPlusLevel / tier.unlock.level, 0, 1);
    return {
      tier,
      unlocked: safeContext.ngPlusLevel >= tier.unlock.level,
      progress,
      requirementLabel: resolveUnlockLabel(tier.unlock)
    } satisfies SaunaTierStatus;
  }

  if (tier.unlock.type === 'unlockSlots') {
    const progress = clampUnit(safeContext.unlockSlots / tier.unlock.slots, 0, 1);
    return {
      tier,
      unlocked: safeContext.unlockSlots >= tier.unlock.slots,
      progress,
      requirementLabel: resolveUnlockLabel(tier.unlock)
    } satisfies SaunaTierStatus;
  }

  return {
    tier,
    unlocked: false,
    progress: 0,
    requirementLabel: resolveUnlockLabel(tier.unlock)
  } satisfies SaunaTierStatus;
}
