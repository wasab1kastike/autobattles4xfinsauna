import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HexMap } from '../../src/hexmap.ts';
import type { Unit } from '../../src/units/Unit.ts';
import {
  activateStronghold,
  listStrongholds,
  resetStrongholdRegistry,
  seedEnemyStrongholds,
  STRONGHOLD_CONFIG
} from '../../src/world/strongholds.ts';

describe('activateStronghold helper', () => {
  beforeEach(() => {
    resetStrongholdRegistry();
  });

  afterEach(() => {
    resetStrongholdRegistry();
  });

  it('keeps dormant entries cloaked until activation', () => {
    const map = new HexMap(12, 12);
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG);

    const [firstStronghold] = listStrongholds();
    expect(firstStronghold).toBeDefined();

    const tile = map.getTile(firstStronghold!.coord.q, firstStronghold!.coord.r);
    expect(tile?.building).toBeNull();
    expect(tile?.isFogged).toBe(true);
    expect(firstStronghold!.structureUnitId).toBeNull();

    const registerUnit = vi.fn<(unit: Unit) => void>();

    const activated = activateStronghold(firstStronghold!.id, map, {
      registerUnit,
      encounters: { registerUnit }
    });

    expect(activated).toBeTruthy();
    expect(registerUnit).toHaveBeenCalledTimes(1);

    const updatedTile = map.getTile(firstStronghold!.coord.q, firstStronghold!.coord.r);
    expect(updatedTile?.building).toBe('city');
    expect(updatedTile?.isFogged).toBe(true);

    const refreshed = listStrongholds().find((entry) => entry.id === firstStronghold!.id);
    expect(refreshed?.structureUnitId).toBe(activated?.id ?? null);
    expect(refreshed?.structureHealth).toBeGreaterThan(0);
    expect(refreshed?.structureHealth).toBeLessThanOrEqual(refreshed?.structureMaxHealth ?? 0);
  });

  it('applies persisted visibility and health when activating', () => {
    const map = new HexMap(12, 12);
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG);

    const [firstStronghold] = listStrongholds();
    expect(firstStronghold).toBeDefined();

    firstStronghold!.structureMaxHealth = 360;
    firstStronghold!.structureHealth = 180;

    const registerUnit = vi.fn<(unit: Unit) => void>();

    const activated = activateStronghold(firstStronghold!.id, map, {
      registerUnit,
      encounters: { registerUnit },
      persisted: {
        structureHealth: 180,
        structureMaxHealth: 360,
        seen: true
      }
    });

    expect(activated).toBeTruthy();
    expect(registerUnit).toHaveBeenCalledTimes(1);

    const updatedTile = map.getTile(firstStronghold!.coord.q, firstStronghold!.coord.r);
    expect(updatedTile?.building).toBe('city');
    expect(updatedTile?.isFogged).toBe(false);

    const refreshed = listStrongholds().find((entry) => entry.id === firstStronghold!.id);
    expect(refreshed?.seen).toBe(true);
    expect(refreshed?.structureHealth).toBe(180);
    expect(activated?.stats.health).toBe(180);
    expect(activated?.getMaxHealth()).toBe(360);
  });
});
