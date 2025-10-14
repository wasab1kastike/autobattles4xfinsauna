import type { UnitArchetypeDefinition, UnitArchetypeId } from './types.ts';

const soldierDefinition: UnitArchetypeDefinition = Object.freeze({
  id: 'soldier',
  displayName: 'Sauna Soldier',
  cost: 50,
  tags: ['infantry', 'melee'],
  stats: {
    health: { base: 20, growth: 6, curve: 'linear', round: 'round' },
    attackDamage: { base: 5, growth: 1, curve: 'linear', round: 'round' },
    attackRange: { base: 1, growth: 0, round: 'round' },
    movementRange: { base: 1, growth: 0, round: 'round' },
    visionRange: { base: 3, growth: 0, round: 'round' }
  }
} satisfies UnitArchetypeDefinition);

const archerDefinition: UnitArchetypeDefinition = Object.freeze({
  id: 'archer',
  displayName: 'Sauna Archer',
  cost: 75,
  tags: ['ranged'],
  stats: {
    health: { base: 15, growth: 4, curve: 'linear', round: 'round' },
    attackDamage: { base: 3, growth: 0.4, curve: 'accelerating', round: 'ceil' },
    attackRange: { base: 3, growth: 0.5, curve: 'diminishing', round: 'ceil', max: 5 },
    movementRange: { base: 1, growth: 0, round: 'round' },
    visionRange: { base: 3, growth: 0.25, curve: 'linear', round: 'round', max: 5 }
  }
} satisfies UnitArchetypeDefinition);

const marauderDefinition: UnitArchetypeDefinition = Object.freeze({
  id: 'avanto-marauder',
  displayName: 'Avanto Marauder',
  cost: 0,
  tags: ['enemy', 'melee'],
  stats: {
    health: { base: 12, growth: 5, curve: 'linear', round: 'round' },
    attackDamage: { base: 4, growth: 0.6, curve: 'accelerating', round: 'ceil' },
    attackRange: { base: 1, growth: 0, round: 'round' },
    movementRange: { base: 1, growth: 0.25, curve: 'linear', round: 'round', max: 2 },
    visionRange: { base: 3, growth: 0, round: 'round' }
  }
} satisfies UnitArchetypeDefinition);

const raiderDefinition: UnitArchetypeDefinition = Object.freeze({
  id: 'raider',
  displayName: 'Frost Raider',
  cost: 0,
  tags: ['enemy', 'melee'],
  stats: {
    health: { base: 16, growth: 5, curve: 'linear', round: 'round' },
    attackDamage: { base: 4, growth: 0.75, curve: 'accelerating', round: 'ceil' },
    attackRange: { base: 1, growth: 0, round: 'round' },
    movementRange: { base: 1, growth: 0.25, curve: 'linear', round: 'round', max: 2 },
    visionRange: { base: 3, growth: 0.25, curve: 'linear', round: 'round', max: 4 }
  }
} satisfies UnitArchetypeDefinition);

const raiderCaptainDefinition: UnitArchetypeDefinition = Object.freeze({
  id: 'raider-captain',
  displayName: 'Frost Raider Captain',
  cost: 0,
  tags: ['enemy', 'leader', 'melee'],
  stats: {
    health: { base: 22, growth: 6, curve: 'linear', round: 'round' },
    attackDamage: { base: 5, growth: 1, curve: 'accelerating', round: 'ceil' },
    attackRange: { base: 1, growth: 0, round: 'round' },
    movementRange: { base: 1, growth: 0.25, curve: 'linear', round: 'round', max: 2 },
    visionRange: { base: 3, growth: 0.3, curve: 'linear', round: 'round', max: 5 }
  }
} satisfies UnitArchetypeDefinition);

const raiderShamanDefinition: UnitArchetypeDefinition = Object.freeze({
  id: 'raider-shaman',
  displayName: 'Frost Raider Shaman',
  cost: 0,
  tags: ['enemy', 'caster', 'ranged'],
  stats: {
    health: { base: 14, growth: 4, curve: 'linear', round: 'round' },
    attackDamage: { base: 3, growth: 0.8, curve: 'accelerating', round: 'ceil' },
    attackRange: { base: 2, growth: 0.35, curve: 'diminishing', round: 'ceil', max: 4 },
    movementRange: { base: 1, growth: 0.25, curve: 'linear', round: 'round', max: 2 },
    visionRange: { base: 4, growth: 0.25, curve: 'linear', round: 'round', max: 6 }
  }
} satisfies UnitArchetypeDefinition);

const auroraWardenDefinition: UnitArchetypeDefinition = Object.freeze({
  id: 'aurora-warden',
  displayName: 'Aurora Warden',
  cost: 0,
  tags: ['enemy', 'boss', 'caster'],
  stats: {
    health: { base: 55, growth: 8, curve: 'linear', round: 'round' },
    attackDamage: { base: 8, growth: 1.2, curve: 'accelerating', round: 'ceil' },
    attackRange: { base: 3, growth: 0.35, curve: 'diminishing', round: 'ceil', max: 5 },
    movementRange: { base: 1, growth: 0.2, curve: 'linear', round: 'round', max: 2 },
    visionRange: { base: 5, growth: 0.25, curve: 'linear', round: 'round', max: 7 }
  }
} satisfies UnitArchetypeDefinition);

const glacierSentinelDefinition: UnitArchetypeDefinition = Object.freeze({
  id: 'glacier-sentinel',
  displayName: 'Glacier Sentinel',
  cost: 0,
  tags: ['enemy', 'boss', 'melee'],
  stats: {
    health: { base: 70, growth: 10, curve: 'linear', round: 'round' },
    attackDamage: { base: 9, growth: 1.5, curve: 'accelerating', round: 'ceil' },
    attackRange: { base: 1, growth: 0, round: 'round' },
    movementRange: { base: 1, growth: 0.2, curve: 'linear', round: 'round', max: 2 },
    visionRange: { base: 4, growth: 0.2, curve: 'linear', round: 'round', max: 6 }
  }
} satisfies UnitArchetypeDefinition);

const spiritKeeperDefinition: UnitArchetypeDefinition = Object.freeze({
  id: 'spirit-keeper',
  displayName: 'Spirit Keeper',
  cost: 0,
  tags: ['enemy', 'boss', 'support'],
  stats: {
    health: { base: 60, growth: 9, curve: 'linear', round: 'round' },
    attackDamage: { base: 7, growth: 1.1, curve: 'accelerating', round: 'ceil' },
    attackRange: { base: 2, growth: 0.4, curve: 'diminishing', round: 'ceil', max: 4 },
    movementRange: { base: 1, growth: 0.25, curve: 'linear', round: 'round', max: 2 },
    visionRange: { base: 5, growth: 0.3, curve: 'linear', round: 'round', max: 7 }
  }
} satisfies UnitArchetypeDefinition);

const emberHighlordDefinition: UnitArchetypeDefinition = Object.freeze({
  id: 'ember-highlord',
  displayName: 'Ember Highlord',
  cost: 0,
  tags: ['enemy', 'boss', 'melee'],
  stats: {
    health: { base: 65, growth: 9, curve: 'linear', round: 'round' },
    attackDamage: { base: 10, growth: 1.6, curve: 'accelerating', round: 'ceil' },
    attackRange: { base: 1, growth: 0, round: 'round' },
    movementRange: { base: 1, growth: 0.3, curve: 'linear', round: 'round', max: 3 },
    visionRange: { base: 4, growth: 0.2, curve: 'linear', round: 'round', max: 6 }
  }
} satisfies UnitArchetypeDefinition);

const strongholdStructureDefinition: UnitArchetypeDefinition = Object.freeze({
  id: 'stronghold-structure',
  displayName: 'Stronghold Core',
  cost: 0,
  tags: ['enemy', 'structure'],
  stats: {
    health: { base: 320, growth: 0, curve: 'linear', round: 'round' },
    attackDamage: { base: 0, growth: 0, round: 'round' },
    attackRange: { base: 0, growth: 0, round: 'round' },
    movementRange: { base: 0, growth: 0, round: 'round' },
    visionRange: { base: 0, growth: 0, round: 'round' }
  }
} satisfies UnitArchetypeDefinition);

const UNIT_ARCHETYPES: Record<UnitArchetypeId, UnitArchetypeDefinition> = Object.freeze({
  soldier: soldierDefinition,
  archer: archerDefinition,
  'avanto-marauder': marauderDefinition,
  raider: raiderDefinition,
  'raider-captain': raiderCaptainDefinition,
  'raider-shaman': raiderShamanDefinition,
  'aurora-warden': auroraWardenDefinition,
  'glacier-sentinel': glacierSentinelDefinition,
  'spirit-keeper': spiritKeeperDefinition,
  'ember-highlord': emberHighlordDefinition,
  'stronghold-structure': strongholdStructureDefinition
});

export function getUnitArchetype(id: UnitArchetypeId): UnitArchetypeDefinition {
  const archetype = UNIT_ARCHETYPES[id];
  if (!archetype) {
    throw new Error(`Unknown unit archetype: ${id}`);
  }
  return archetype;
}

export function tryGetUnitArchetype(id: UnitArchetypeId | string): UnitArchetypeDefinition | null {
  const archetype = UNIT_ARCHETYPES[id as UnitArchetypeId];
  return archetype ?? null;
}

export const UNIT_ARCHETYPE_IDS: readonly UnitArchetypeId[] = Object.freeze(
  Object.keys(UNIT_ARCHETYPES) as UnitArchetypeId[]
);

export { soldierDefinition as SOLDIER_ARCHETYPE };
export { archerDefinition as ARCHER_ARCHETYPE };
export { marauderDefinition as AVANTO_MARAUDER_ARCHETYPE };
export { raiderDefinition as RAIDER_ARCHETYPE };
export { raiderCaptainDefinition as RAIDER_CAPTAIN_ARCHETYPE };
export { raiderShamanDefinition as RAIDER_SHAMAN_ARCHETYPE };
export { auroraWardenDefinition as AURORA_WARDEN_ARCHETYPE };
export { glacierSentinelDefinition as GLACIER_SENTINEL_ARCHETYPE };
export { spiritKeeperDefinition as SPIRIT_KEEPER_ARCHETYPE };
export { emberHighlordDefinition as EMBER_HIGHLORD_ARCHETYPE };
export { strongholdStructureDefinition as STRONGHOLD_STRUCTURE_ARCHETYPE };
