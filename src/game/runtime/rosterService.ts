import type { AxialCoord } from '../../hex/HexUtils.ts';
import type { Unit } from '../../unit/index.ts';
import type { Saunoja, SaunojaStatBlock } from '../../units/saunoja.ts';

export interface RosterPersonaBaseline {
  base: SaunojaStatBlock;
  upkeep: number;
}

export interface RosterServiceDependencies {
  readonly roster: Saunoja[];
  loadRosterFromStorage(): Saunoja[];
  saveRosterToStorage(roster: readonly Saunoja[]): void;
  withBaseline<T>(saunoja: Saunoja, mutate: (baseline: RosterPersonaBaseline) => T): T;
  getAttachedUnitFor(saunoja: Saunoja): Unit | null;
  resolveAppearanceId(): string;
  generateTraits(): string[];
  rollUpkeep(): number;
}

export interface RosterService {
  loadUnits(): Saunoja[];
  saveUnits(): void;
  isPersonaMissing(saunoja: Saunoja): boolean;
  refreshPersona(saunoja: Saunoja): void;
  focusSaunoja(target: Saunoja): boolean;
  focusSaunojaById(unitId: string): boolean;
  deselectAllSaunojas(except?: Saunoja): boolean;
  clearSaunojaSelection(): boolean;
  setSelectedCoord(next: AxialCoord | null): boolean;
  getSelectedCoord(): AxialCoord | null;
  getSelectedUnitId(): string | null;
  setSelectedUnitId(next: string | null): void;
}

export function createRosterService(deps: RosterServiceDependencies): RosterService {
  let selectedCoord: AxialCoord | null = null;
  let selectedUnitId: string | null = null;

  const coordsEqual = (a: AxialCoord | null, b: AxialCoord | null): boolean => {
    if (!a || !b) {
      return a === b;
    }
    return a.q === b.q && a.r === b.r;
  };

  const loadUnits = (): Saunoja[] => {
    const stored = deps.loadRosterFromStorage();
    deps.roster.splice(0, deps.roster.length, ...stored);
    return deps.roster;
  };

  const saveUnits = (): void => {
    deps.saveRosterToStorage(deps.roster);
  };

  const isPersonaMissing = (saunoja: Saunoja): boolean => {
    const traits = Array.isArray(saunoja.traits) ? saunoja.traits : [];
    const hasTraits = traits.length >= 3;
    const upkeepValid = Number.isFinite(saunoja.upkeep);
    const xpValid = Number.isFinite(saunoja.xp);
    const appearanceValid =
      typeof saunoja.appearanceId === 'string' && saunoja.appearanceId.trim().length > 0;
    return !hasTraits || !upkeepValid || !xpValid || !appearanceValid;
  };

  const setSelectedCoord = (next: AxialCoord | null): boolean => {
    if (coordsEqual(selectedCoord, next)) {
      return false;
    }
    selectedCoord = next ? { q: next.q, r: next.r } : null;
    return true;
  };

  const deselectAllSaunojas = (except?: Saunoja): boolean => {
    let changed = false;
    for (const unit of deps.roster) {
      if (except && unit === except) {
        continue;
      }
      if (unit.selected) {
        unit.selected = false;
        changed = true;
      }
    }
    return changed;
  };

  const clearSaunojaSelection = (): boolean => {
    let changed = false;
    if (selectedUnitId !== null) {
      selectedUnitId = null;
      changed = true;
    }
    if (deselectAllSaunojas()) {
      changed = true;
    }
    if (setSelectedCoord(null)) {
      changed = true;
    }
    return changed;
  };

  const focusSaunoja = (target: Saunoja): boolean => {
    let changed = false;
    const previousUnitId = selectedUnitId;
    const attachedUnit = deps.getAttachedUnitFor(target);
    selectedUnitId = attachedUnit?.id ?? target.id;
    if (previousUnitId !== selectedUnitId) {
      changed = true;
    }
    if (!target.selected) {
      target.selected = true;
      changed = true;
    }
    if (deselectAllSaunojas(target)) {
      changed = true;
    }
    if (setSelectedCoord(target.coord)) {
      changed = true;
    }
    return changed;
  };

  const focusSaunojaById = (unitId: string): boolean => {
    const target = deps.roster.find((unit) => unit.id === unitId);
    if (!target) {
      return false;
    }
    return focusSaunoja(target);
  };

  const refreshPersona = (saunoja: Saunoja): void => {
    saunoja.traits = deps.generateTraits();
    const nextUpkeep = deps.rollUpkeep();
    deps.withBaseline(saunoja, (baseline) => {
      baseline.upkeep = nextUpkeep;
    });
    saunoja.xp = 0;
    if (typeof saunoja.appearanceId !== 'string' || saunoja.appearanceId.trim().length === 0) {
      saunoja.appearanceId = deps.resolveAppearanceId();
    }
    const attached = deps.getAttachedUnitFor(saunoja);
    attached?.setAppearanceId(saunoja.appearanceId);
  };

  return {
    loadUnits,
    saveUnits,
    isPersonaMissing,
    refreshPersona,
    focusSaunoja,
    focusSaunojaById,
    deselectAllSaunojas,
    clearSaunojaSelection,
    setSelectedCoord,
    getSelectedCoord: () => (selectedCoord ? { q: selectedCoord.q, r: selectedCoord.r } : null),
    getSelectedUnitId: () => selectedUnitId,
    setSelectedUnitId: (next) => {
      selectedUnitId = next;
    }
  } satisfies RosterService;
}
