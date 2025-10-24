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

export interface SaunaTierHealingAura {
  radius: number;
  regenPerSecond: number;
}

export type SaunaTierUnlock =
  | { type: 'default'; label: string }
  | { type: 'artocoin'; cost: number; label?: string };

export type SaunaTierUpgrade = { type: 'saunakunnia'; cost: number; label?: string };

export interface SaunaTier {
  id: SaunaTierId;
  name: string;
  rosterCap: number;
  description: string;
  art: SaunaTierArt;
  unlock: SaunaTierUnlock;
  upgrade: SaunaTierUpgrade;
  healingAura?: SaunaTierHealingAura;
  /** Multiplier applied to the attendant spawn cadence. */
  spawnSpeedMultiplier?: number;
}

export const DEFAULT_SAUNA_AURA_RADIUS = 2;
export const DEFAULT_SAUNA_REGEN_PER_SECOND = 1;

export function sanitizeHealingAuraRadius(value: number | null | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SAUNA_AURA_RADIUS;
  }
  const radius = Math.floor(Number(value));
  return radius > 0 ? radius : DEFAULT_SAUNA_AURA_RADIUS;
}

export function sanitizeHealingAuraRegen(value: number | null | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SAUNA_REGEN_PER_SECOND;
  }
  const regen = Number(value);
  return regen > 0 ? regen : DEFAULT_SAUNA_REGEN_PER_SECOND;
}

export interface SaunaTierContext {
  artocoinBalance: number;
  saunakunniaBalance: number;
  unlockedTierIds: ReadonlySet<SaunaTierId> | SaunaTierId[];
  ownedTierIds: ReadonlySet<SaunaTierId> | SaunaTierId[];
}

export interface SaunaTierCostStatus {
  affordable: boolean;
  cost: number | null;
  progress: number;
  requirementLabel: string;
}

export interface SaunaTierStatus {
  tier: SaunaTier;
  unlocked: boolean;
  owned: boolean;
  requirementLabel: string;
  unlock: SaunaTierCostStatus;
  upgrade: SaunaTierCostStatus;
}

const DEFAULT_CONTEXT: SaunaTierContext = Object.freeze({
  artocoinBalance: 0,
  saunakunniaBalance: 0,
  unlockedTierIds: Object.freeze(new Set<SaunaTierId>()),
  ownedTierIds: Object.freeze(new Set<SaunaTierId>())
});

const DEFAULT_UPGRADE_LABEL = 'Channel Saunakunnia';

const auraRegenFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

function formatHealingAuraLabel(tier: SaunaTier): string | null {
  if (!tier.healingAura) {
    return null;
  }
  const radius = sanitizeHealingAuraRadius(tier.healingAura.radius);
  const regen = sanitizeHealingAuraRegen(tier.healingAura.regenPerSecond);
  if (radius <= 0 || regen <= 0) {
    return null;
  }
  const regenLabel = auraRegenFormatter.format(regen);
  return `Healing aura ${radius}-hex (${regenLabel} HP/s)`;
}

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
    upgrade: { type: 'saunakunnia', cost: 0, label: 'Foundational Ember Circuit charter' },
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
    upgrade: {
      type: 'saunakunnia',
      cost: 80,
      label: 'Commission Aurora Ward benches for 80 Saunakunnia'
    },
    spawnSpeedMultiplier: 1
  },
  {
    id: 'glacial-rhythm',
    name: 'Glacial Rhythm Retreat',
    rosterCap: 4,
    description:
      'Crystalline steam vents pulse in measured waves, accelerating attendant call-ups while frost-mist widens a tri-hex healing aura.',
    art: {
      badge: saunaBeerUrl,
      glow: 'linear-gradient(135deg, rgba(120,215,255,0.65), rgba(167,255,238,0.18))'
    },
    unlock: {
      type: 'artocoin',
      cost: 110,
      label: 'Tune the Glacial Rhythm for 110 artocoins'
    },
    upgrade: {
      type: 'saunakunnia',
      cost: 140,
      label: 'Crystalize Glacial Rhythm vents for 140 Saunakunnia'
    },
    healingAura: { radius: 3, regenPerSecond: 1.5 },
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
    upgrade: {
      type: 'saunakunnia',
      cost: 210,
      label: 'Seal Mythic Conclave vault wards for 210 Saunakunnia'
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
    upgrade: {
      type: 'saunakunnia',
      cost: 280,
      label: 'Ignite Solstice Cadence gongs for 280 Saunakunnia'
    },
    spawnSpeedMultiplier: 1.3
  },
  {
    id: 'celestial-reserve',
    name: 'Celestial Reserve Sanctum',
    rosterCap: 6,
    description:
      'Starlit balustrades unfurl a sixth berth while chronothermic conduits bathe allies in a tri-hex, high-flux healing halo.',
    art: {
      badge: cadenceBadgeUrl,
      glow: 'linear-gradient(135deg, rgba(222,199,255,0.76), rgba(152,209,255,0.22))'
    },
    unlock: {
      type: 'artocoin',
      cost: 280,
      label: 'Crown the Celestial Reserve for 280 artocoins'
    },
    upgrade: {
      type: 'saunakunnia',
      cost: 360,
      label: 'Anoint the Celestial Reserve sanctum for 360 Saunakunnia'
    },
    healingAura: { radius: 3, regenPerSecond: 1.5 },
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
    const auraLabel = formatHealingAuraLabel(tier);
    if (auraLabel) {
      perk = auraLabel;
    } else if (rosterCap > previousRosterCap) {
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

function resolveUpgradeLabel(upgrade: SaunaTierUpgrade): string {
  if (upgrade.label) {
    return upgrade.label;
  }
  const base = DEFAULT_UPGRADE_LABEL;
  const cost = Math.max(0, Math.floor(Number.isFinite(upgrade.cost) ? upgrade.cost : 0));
  if (cost <= 0) {
    return base;
  }
  return `${base} ${integerFormatter.format(cost)}`;
}

export function evaluateSaunaTier(
  tier: SaunaTier,
  context: SaunaTierContext | null | undefined
): SaunaTierStatus {
  const safeContext = context ?? DEFAULT_CONTEXT;
  const ownedSource = safeContext.ownedTierIds;
  const unlockedSource = safeContext.unlockedTierIds;
  const ownedSet =
    ownedSource instanceof Set
      ? ownedSource
      : new Set(Array.isArray(ownedSource) ? ownedSource : []);
  const unlockedSet =
    unlockedSource instanceof Set
      ? unlockedSource
      : new Set(Array.isArray(unlockedSource) ? unlockedSource : []);

  const artocoinBalance = Math.max(
    0,
    Math.floor(Number.isFinite(safeContext.artocoinBalance) ? safeContext.artocoinBalance : 0)
  );
  const saunakunniaBalance = Math.max(
    0,
    Math.floor(Number.isFinite(safeContext.saunakunniaBalance) ? safeContext.saunakunniaBalance : 0)
  );

  const perkLabel = getTierPerkLabel(tier);

  const unlockCost =
    tier.unlock.type === 'artocoin'
      ? Math.max(0, Math.floor(Number.isFinite(tier.unlock.cost) ? tier.unlock.cost : 0))
      : 0;
  const unlockAffordable = tier.unlock.type === 'artocoin' ? artocoinBalance >= unlockCost : true;
  const unlocked =
    tier.unlock.type === 'default' || unlockCost === 0 || unlockedSet.has(tier.id);
  const unlockProgress = unlocked
    ? 1
    : unlockCost === 0
      ? 1
      : clampUnit(artocoinBalance / Math.max(1, unlockCost), 0, 1);
  const unlockDeficit = Math.max(0, unlockCost - artocoinBalance);
  const unlockShortfall = unlockDeficit > 0 ? integerFormatter.format(unlockDeficit) : null;
  const unlockFormattedCost = integerFormatter.format(unlockCost);
  const unlockBaseLabel = tier.unlock.label ?? `Invest ${unlockFormattedCost} artocoins`;
  const unlockAugmentedLabel = perkLabel ? `${unlockBaseLabel} (${perkLabel})` : unlockBaseLabel;
  const unlockRequirementLabel =
    tier.unlock.type === 'default'
      ? perkLabel
      : unlocked
        ? perkLabel
        : unlockShortfall
          ? `${unlockAugmentedLabel} — Need ${unlockShortfall} more`
          : unlockCost > 0
            ? `${unlockAugmentedLabel} — Ready to unlock`
            : unlockAugmentedLabel;

  const upgrade = tier.upgrade ?? { type: 'saunakunnia', cost: 0 };
  const upgradeCost = Math.max(0, Math.floor(Number.isFinite(upgrade.cost) ? upgrade.cost : 0));
  const upgradeAffordable = saunakunniaBalance >= upgradeCost;
  const owned =
    unlocked && (upgradeCost === 0 ? true : ownedSet.has(tier.id));
  const upgradeProgress = owned
    ? 1
    : upgradeCost === 0
      ? 1
      : clampUnit(saunakunniaBalance / Math.max(1, upgradeCost), 0, 1);
  const upgradeDeficit = Math.max(0, upgradeCost - saunakunniaBalance);
  const upgradeShortfall = upgradeDeficit > 0 ? integerFormatter.format(upgradeDeficit) : null;
  const upgradeBaseLabel = resolveUpgradeLabel(upgrade);
  const upgradeAugmentedLabel = perkLabel ? `${upgradeBaseLabel} (${perkLabel})` : upgradeBaseLabel;
  const upgradeRequirementLabel = owned
    ? perkLabel
    : upgradeShortfall
      ? `${upgradeAugmentedLabel} — Need ${upgradeShortfall} more`
      : upgradeCost > 0
        ? `${upgradeAugmentedLabel} — Ready to upgrade`
        : upgradeAugmentedLabel;

  const requirementLabel = !unlocked
    ? unlockRequirementLabel
    : owned
      ? perkLabel
      : upgradeRequirementLabel;

  return {
    tier,
    unlocked,
    owned,
    requirementLabel,
    unlock: {
      affordable: unlockAffordable,
      cost: tier.unlock.type === 'default' ? null : unlockCost,
      progress: unlockProgress,
      requirementLabel: unlockRequirementLabel
    },
    upgrade: {
      affordable: upgradeAffordable,
      cost: upgradeCost,
      progress: upgradeProgress,
      requirementLabel: upgradeRequirementLabel
    }
  } satisfies SaunaTierStatus;
}
