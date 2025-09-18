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

const UNIT_ARCHETYPES: Record<UnitArchetypeId, UnitArchetypeDefinition> = Object.freeze({
  soldier: soldierDefinition,
  archer: archerDefinition,
  'avanto-marauder': marauderDefinition
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
