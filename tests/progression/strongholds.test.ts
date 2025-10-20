import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GameState } from '../../src/core/GameState.ts';
import { HexMap } from '../../src/hexmap.ts';
import { createObjectiveTracker } from '../../src/progression/objectives.ts';
import { calculateKillExperience, XP_BOSS_KILL } from '../../src/game/experience.ts';
import type { Unit } from '../../src/units/Unit.ts';
import { createUnit } from '../../src/units/UnitFactory.ts';
import {
  activateStronghold,
  getStrongholdSnapshot,
  listStrongholds,
  resetStrongholdRegistry,
  seedEnemyStrongholds,
  STRONGHOLD_CONFIG
} from '../../src/world/strongholds.ts';
import {
  abandonStrongholdEncounters,
  resetStrongholdEncounters,
  spawnStrongholdBoss
} from '../../src/world/strongholdEncounters.ts';

function makeTracker(map: HexMap): ReturnType<typeof createObjectiveTracker> {
  return createObjectiveTracker({
    state: new GameState(1000),
    map,
    getRosterCount: () => 0
  });
}

describe('enemy strongholds integration', () => {
  beforeEach(() => {
    resetStrongholdRegistry();
    resetStrongholdEncounters();
  });

  afterEach(() => {
    resetStrongholdRegistry();
    resetStrongholdEncounters();
  });

  it('reports seeded totals for a fresh session', () => {
    const map = new HexMap(10, 10);
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG);
    const tracker = makeTracker(map);

    const progress = tracker.getProgress();
    const expectedTotal = STRONGHOLD_CONFIG.strongholds.length;

    expect(progress.strongholds.total).toBe(expectedTotal);
    expect(progress.strongholds.remaining).toBe(expectedTotal);
    expect(progress.strongholds.destroyed).toBe(0);

    tracker.dispose();
  });

  it('keeps strongholds cloaked until they are activated', () => {
    const map = new HexMap(10, 10);
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG);

    for (const stronghold of STRONGHOLD_CONFIG.strongholds) {
      const tile = map.getTile(stronghold.coord.q, stronghold.coord.r);
      expect(tile).toBeDefined();
      expect(tile?.building).toBeNull();
      expect(tile?.isFogged).toBe(true);
    }
  });

  it('decrements remaining strongholds when a city falls', () => {
    const map = new HexMap(10, 10);
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG);
    const tracker = makeTracker(map);

    const [firstStronghold] = listStrongholds();
    expect(firstStronghold).toBeDefined();
    const hooks = {
      registerUnit: (_unit: Unit) => {
        /* no-op */
      }
    };
    activateStronghold(firstStronghold!.id, map, { encounters: hooks, registerUnit: hooks.registerUnit });
    const tile = map.getTile(firstStronghold.coord.q, firstStronghold.coord.r);
    expect(tile?.building).toBe('city');

    tile?.placeBuilding(null);

    const progress = tracker.getProgress();
    const expectedRemaining = STRONGHOLD_CONFIG.strongholds.length - 1;

    expect(progress.strongholds.remaining).toBe(expectedRemaining);
    expect(progress.strongholds.destroyed).toBe(1);

    tracker.dispose();
  });

  it('clears stronghold tiles and awards boss XP when the leader falls', () => {
    const map = new HexMap(10, 10);
    const spawned: Unit[] = [];
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG, null, {
      encounters: {
        registerUnit: (unit) => spawned.push(unit),
        random: () => 0.41
      }
    });

    for (const entry of STRONGHOLD_CONFIG.strongholds) {
      activateStronghold(entry.id, map, {
        encounters: {
          registerUnit: (unit) => spawned.push(unit),
          random: () => 0.41
        },
        registerUnit: (unit) => spawned.push(unit)
      });
    }

    const [firstStronghold] = listStrongholds();
    expect(firstStronghold).toBeDefined();
    const tile = map.getTile(firstStronghold.coord.q, firstStronghold.coord.r);
    expect(tile?.building).toBe('city');

    const structures = spawned.filter((unit) => unit.type === 'stronghold-structure');
    expect(structures).toHaveLength(STRONGHOLD_CONFIG.strongholds.length);

    const structure = structures.find(
      (unit) =>
        unit.coord.q === firstStronghold.coord.q && unit.coord.r === firstStronghold.coord.r
    );
    expect(structure).toBeDefined();

    const attacker = createUnit(
      'soldier',
      'test-attacker',
      { q: firstStronghold.coord.q + 1, r: firstStronghold.coord.r },
      'player'
    );
    expect(attacker).toBeTruthy();

    structure!.takeDamage(structure!.getMaxHealth() + 50, attacker ?? undefined);

    const bosses = spawned.filter((unit) => unit.isBoss);
    expect(bosses).toHaveLength(1);
    const boss = bosses[0];
    expect(boss).toBeDefined();
    expect(boss!.coord.q).toBe(firstStronghold.coord.q);
    expect(boss!.coord.r).toBe(firstStronghold.coord.r);

    const snapshotAfterCapture = getStrongholdSnapshot();
    expect(snapshotAfterCapture[firstStronghold.id]?.captured).toBe(true);
    expect(snapshotAfterCapture[firstStronghold.id]?.structureDestroyed).toBe(true);
    expect(snapshotAfterCapture[firstStronghold.id]?.structureHealth).toBe(0);
    expect(snapshotAfterCapture[firstStronghold.id]?.boss?.spawned).toBe(true);
    expect(snapshotAfterCapture[firstStronghold.id]?.boss?.defeated).toBeUndefined();

    boss!.takeDamage(boss!.stats.health + 50, attacker ?? undefined);

    expect(tile?.building).toBeNull();
    expect(tile?.isFogged).toBe(false);

    const snapshot = getStrongholdSnapshot();
    expect(snapshot[firstStronghold.id]?.captured).toBe(true);
    expect(snapshot[firstStronghold.id]?.boss?.spawned).toBe(true);
    expect(snapshot[firstStronghold.id]?.boss?.defeated).toBe(true);

    const xpSummary = calculateKillExperience(boss!);
    expect(xpSummary.boss).toBe(true);
    expect(xpSummary.xp).toBe(XP_BOSS_KILL);
  });

  it('persists partially damaged structures across reloads', () => {
    const map = new HexMap(10, 10);
    const spawned: Unit[] = [];
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG, null, {
      encounters: {
        registerUnit: (unit) => spawned.push(unit)
      }
    });

    for (const entry of STRONGHOLD_CONFIG.strongholds) {
      activateStronghold(entry.id, map, {
        encounters: {
          registerUnit: (unit) => spawned.push(unit)
        },
        registerUnit: (unit) => spawned.push(unit)
      });
    }

    const [firstStronghold] = listStrongholds();
    expect(firstStronghold).toBeDefined();

    const structure = spawned.find(
      (unit) =>
        unit.type === 'stronghold-structure' &&
        unit.coord.q === firstStronghold!.coord.q &&
        unit.coord.r === firstStronghold!.coord.r
    );
    expect(structure).toBeDefined();

    const attacker = createUnit(
      'soldier',
      'persistence-attacker',
      { q: firstStronghold!.coord.q + 1, r: firstStronghold!.coord.r },
      'player'
    );
    expect(attacker).toBeTruthy();

    const initialHealth = structure!.stats.health;
    structure!.takeDamage(50, attacker ?? undefined);
    expect(structure!.stats.health).toBeLessThan(initialHealth);

    const snapshot = getStrongholdSnapshot();
    const entry = snapshot[firstStronghold!.id];
    expect(entry?.structureDestroyed).toBeUndefined();
    expect(entry?.structureHealth).toBeGreaterThan(0);
    expect(entry?.structureHealth).toBeLessThan(entry?.structureMaxHealth ?? Infinity);

    resetStrongholdRegistry();

    const mapReloaded = new HexMap(10, 10);
    const respawned: Unit[] = [];

    seedEnemyStrongholds(mapReloaded, STRONGHOLD_CONFIG, snapshot, {
      encounters: {
        registerUnit: (unit) => respawned.push(unit)
      }
    });

    for (const entry of STRONGHOLD_CONFIG.strongholds) {
      activateStronghold(entry.id, mapReloaded, {
        encounters: {
          registerUnit: (unit) => respawned.push(unit)
        },
        registerUnit: (unit) => respawned.push(unit),
        persisted: snapshot[entry.id] ?? null
      });
    }

    const reloadedStructure = respawned.find(
      (unit) =>
        unit.type === 'stronghold-structure' &&
        unit.coord.q === firstStronghold!.coord.q &&
        unit.coord.r === firstStronghold!.coord.r
    );
    expect(reloadedStructure).toBeDefined();
    expect(reloadedStructure!.stats.health).toBe(entry?.structureHealth);
    expect(reloadedStructure!.getMaxHealth()).toBe(entry?.structureMaxHealth);
  });

  it('spawns boss encounters after destruction when loading persistence', () => {
    const map = new HexMap(10, 10);
    const spawned: Unit[] = [];
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG, null, {
      encounters: {
        registerUnit: (unit) => spawned.push(unit)
      }
    });

    for (const entry of STRONGHOLD_CONFIG.strongholds) {
      activateStronghold(entry.id, map, {
        encounters: {
          registerUnit: (unit) => spawned.push(unit)
        },
        registerUnit: (unit) => spawned.push(unit)
      });
    }

    const [firstStronghold] = listStrongholds();
    expect(firstStronghold).toBeDefined();

    const structure = spawned.find(
      (unit) =>
        unit.type === 'stronghold-structure' &&
        unit.coord.q === firstStronghold!.coord.q &&
        unit.coord.r === firstStronghold!.coord.r
    );
    expect(structure).toBeDefined();

    const attacker = createUnit(
      'soldier',
      'reload-attacker',
      { q: firstStronghold!.coord.q + 1, r: firstStronghold!.coord.r },
      'player'
    );
    expect(attacker).toBeTruthy();

    structure!.takeDamage(structure!.getMaxHealth() + 10, attacker ?? undefined);

    const snapshot = getStrongholdSnapshot();

    resetStrongholdRegistry();

    const mapReloaded = new HexMap(10, 10);
    const respawned: Unit[] = [];

    seedEnemyStrongholds(mapReloaded, STRONGHOLD_CONFIG, snapshot, {
      encounters: {
        registerUnit: (unit) => respawned.push(unit)
      }
    });

    for (const entry of STRONGHOLD_CONFIG.strongholds) {
      activateStronghold(entry.id, mapReloaded, {
        encounters: {
          registerUnit: (unit) => respawned.push(unit)
        },
        registerUnit: (unit) => respawned.push(unit),
        persisted: snapshot[entry.id] ?? null
      });
    }

    const reloadedTile = mapReloaded.getTile(firstStronghold!.coord.q, firstStronghold!.coord.r);
    expect(reloadedTile?.building).toBeNull();
    const bosses = respawned.filter((unit) => unit.isBoss);
    expect(bosses).toHaveLength(1);
    expect(bosses[0]?.coord.q).toBe(firstStronghold!.coord.q);
    expect(bosses[0]?.coord.r).toBe(firstStronghold!.coord.r);
  });

  it('abandoning active stronghold bosses clears the battlefield', () => {
    const map = new HexMap(10, 10);
    const activeUnits = new Map<string, Unit>();
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG, null, {
      encounters: {
        registerUnit: (unit) => {
          activeUnits.set(unit.id, unit);
          unit.onDeath(() => {
            activeUnits.delete(unit.id);
          });
        },
        random: () => 0.23
      }
    });

    for (const entry of STRONGHOLD_CONFIG.strongholds) {
      activateStronghold(entry.id, map, {
        encounters: {
          registerUnit: (unit) => {
            activeUnits.set(unit.id, unit);
            unit.onDeath(() => {
              activeUnits.delete(unit.id);
            });
          },
          random: () => 0.23
        },
        registerUnit: (unit) => {
          activeUnits.set(unit.id, unit);
          unit.onDeath(() => {
            activeUnits.delete(unit.id);
          });
        }
      });
    }

    const [firstStronghold] = listStrongholds();
    expect(firstStronghold).toBeDefined();
    const boss = spawnStrongholdBoss(firstStronghold!.id);
    expect(boss).toBeTruthy();
    expect(boss?.isDead()).toBe(false);
    expect(activeUnits.has(boss!.id)).toBe(true);

    abandonStrongholdEncounters();

    expect(activeUnits.has(boss!.id)).toBe(false);
    expect(boss?.isDead()).toBe(true);

    const snapshot = getStrongholdSnapshot();
    expect(snapshot[firstStronghold!.id]?.boss?.defeated).toBe(true);
  });
});
