import type { AxialCoord } from '../../hex/HexUtils.ts';
import type { Unit } from '../../unit/index.ts';
import type { UnitBehavior } from '../../unit/types.ts';
import {
  SAUNOJA_DEFAULT_UPKEEP,
  makeSaunoja,
  type Saunoja,
  type SaunojaStatBlock
} from '../../units/saunoja.ts';
import type { RosterPersonaBaseline, RosterService } from '../runtime/rosterService.ts';

export function cloneStatBlock(stats: SaunojaStatBlock): SaunojaStatBlock {
  const clone: SaunojaStatBlock = {
    health: stats.health,
    attackDamage: stats.attackDamage,
    attackRange: stats.attackRange,
    movementRange: stats.movementRange
  } satisfies SaunojaStatBlock;

  if (typeof stats.defense === 'number') {
    clone.defense = stats.defense;
  }
  if (typeof stats.shield === 'number') {
    clone.shield = stats.shield;
  }
  if (typeof stats.visionRange === 'number') {
    clone.visionRange = stats.visionRange;
  }

  return clone;
}

export interface RosterSyncDependencies {
  rosterService: RosterService;
  saunojas: Saunoja[];
  saunojaPolicyBaselines: Map<Saunoja, RosterPersonaBaseline>;
  unitToSaunoja: Map<string, Saunoja>;
  saunojaToUnit: Map<string, string>;
  ensureSaunojaPolicyBaseline: (saunoja: Saunoja) => RosterPersonaBaseline;
  applySaunojaBehaviorPreference: (
    saunoja: Saunoja,
    behavior: UnitBehavior,
    unit: Unit
  ) => boolean;
  updateBaseStatsFromUnit: (saunoja: Saunoja, unit: Unit | null) => void;
  onRosterChanged: () => void;
  setSelectedCoord: (coord: AxialCoord) => unknown;
}

export interface ClaimSaunojaResult {
  saunoja: Saunoja;
  created: boolean;
  attached: boolean;
}

export interface RosterSyncService {
  loadUnits(): Saunoja[];
  claimSaunoja(unit: Unit): ClaimSaunojaResult;
  syncRosterWithUnits(units: Iterable<Unit>): boolean;
}

export function createRosterSyncService({
  rosterService,
  saunojas,
  saunojaPolicyBaselines,
  unitToSaunoja,
  saunojaToUnit,
  ensureSaunojaPolicyBaseline,
  applySaunojaBehaviorPreference,
  updateBaseStatsFromUnit,
  onRosterChanged,
  setSelectedCoord
}: RosterSyncDependencies): RosterSyncService {
  const loadUnits = (): Saunoja[] => {
    const roster = rosterService.loadUnits();
    const attachedUnitIds = new Set<string>();

    for (const attendant of roster) {
      ensureSaunojaPolicyBaseline(attendant);
      const attachedUnitId = saunojaToUnit.get(attendant.id);
      if (attachedUnitId) {
        unitToSaunoja.set(attachedUnitId, attendant);
        attachedUnitIds.add(attachedUnitId);
      }
    }

    for (const [unitId] of unitToSaunoja) {
      if (!attachedUnitIds.has(unitId)) {
        unitToSaunoja.delete(unitId);
      }
    }

    return roster;
  };

  const claimSaunoja = (unit: Unit): ClaimSaunojaResult => {
    const existing = unitToSaunoja.get(unit.id);
    if (existing) {
      return { saunoja: existing, created: false, attached: false };
    }

    let match = saunojas.find((candidate) => candidate.id === unit.id);
    if (!match) {
      match = saunojas.find((candidate) => !saunojaToUnit.has(candidate.id));
    }

    let created = false;
    if (!match) {
      match = makeSaunoja({
        id: `saunoja-${saunojas.length + 1}`,
        coord: { q: unit.coord.q, r: unit.coord.r }
      });
      saunojas.push(match);
      created = true;
      const upkeep = Number.isFinite(match.upkeep) ? Math.max(0, match.upkeep) : SAUNOJA_DEFAULT_UPKEEP;
      saunojaPolicyBaselines.set(match, {
        base: cloneStatBlock(match.baseStats),
        upkeep
      });
    }

    const previousUnitId = saunojaToUnit.get(match.id);
    if (previousUnitId && previousUnitId !== unit.id) {
      unitToSaunoja.delete(previousUnitId);
    }

    unitToSaunoja.set(unit.id, match);
    saunojaToUnit.set(match.id, unit.id);

    ensureSaunojaPolicyBaseline(match);
    applySaunojaBehaviorPreference(match, match.behavior, unit);
    updateBaseStatsFromUnit(match, unit);
    unit.setExperience(match.xp);
    if (typeof match.appearanceId === 'string' && match.appearanceId.trim().length > 0) {
      unit.setAppearanceId(match.appearanceId);
    }

    const personaMissing = rosterService.isPersonaMissing(match);
    if (created || personaMissing) {
      rosterService.refreshPersona(match);
    }

    return { saunoja: match, created, attached: true };
  };

  const syncRosterWithUnits = (units: Iterable<Unit>): boolean => {
    let changed = false;

    for (const unit of units) {
      if (unit.faction !== 'player' || unit.isDead()) {
        continue;
      }

      const { saunoja, created, attached } = claimSaunoja(unit);
      if (created || attached) {
        changed = true;
      }

      const normalizedHp = Number.isFinite(unit.stats.health) ? Math.max(0, unit.stats.health) : 0;
      if (saunoja.hp !== normalizedHp) {
        saunoja.hp = normalizedHp;
        changed = true;
      }

      const normalizedMaxHp = Number.isFinite(unit.getMaxHealth()) ? Math.max(1, unit.getMaxHealth()) : 1;
      if (saunoja.maxHp !== normalizedMaxHp) {
        saunoja.maxHp = normalizedMaxHp;
        changed = true;
      }

      const shieldValue = unit.getShield();
      const normalizedShield = Number.isFinite(shieldValue) ? Math.max(0, shieldValue) : 0;
      if (saunoja.shield !== normalizedShield) {
        saunoja.shield = normalizedShield;
        changed = true;
      }

      const unitWithLastHit = unit as unknown as { lastHitAt?: number };
      const lastHitAt = unitWithLastHit?.lastHitAt;
      if (Number.isFinite(lastHitAt) && saunoja.lastHitAt !== lastHitAt) {
        saunoja.lastHitAt = lastHitAt as number;
        changed = true;
      }

      const { q, r } = unit.coord;
      if (saunoja.coord.q !== q || saunoja.coord.r !== r) {
        saunoja.coord = { q, r };
        changed = true;
        if (saunoja.selected) {
          setSelectedCoord(saunoja.coord);
        }
      }
    }

    if (changed) {
      onRosterChanged();
    }

    return changed;
  };

  return {
    loadUnits,
    claimSaunoja,
    syncRosterWithUnits
  } satisfies RosterSyncService;
}
