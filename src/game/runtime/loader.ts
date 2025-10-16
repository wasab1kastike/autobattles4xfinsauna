import type { GameState } from '../../core/GameState.ts';
import type { EventBus } from '../../events/EventBus.ts';
import type { HexMap } from '../../hexmap.ts';
import type { AxialCoord } from '../../hex/HexUtils.ts';
import type { Unit } from '../../unit/index.ts';
import type { UnitBehavior } from '../../unit/types.ts';
import type { Saunoja } from '../../units/saunoja.ts';
import type { RosterPersonaBaseline, RosterService } from './rosterService.ts';
import {
  createRosterSyncService,
  type ClaimSaunojaResult
} from '../roster/rosterSync.ts';
import { pickStrongholdSpawnCoord, type StrongholdSpawnExclusionZone } from '../../world/spawn/strongholdSpawn.ts';
import type { LogEventPayload } from '../../ui/logging.ts';
import type { GameRuntime } from './GameRuntime.ts';
import type { NgPlusState } from '../../progression/ngplus.ts';

type RuntimeProvider = () => GameRuntime | null;

type LogEvent = (payload: LogEventPayload) => void;

type BaselineRefresher = (saunoja: Saunoja) => RosterPersonaBaseline;

type BehaviorPreferenceApplier = (saunoja: Saunoja, behavior: UnitBehavior, unit: Unit) => boolean;

type BaseStatUpdater = (saunoja: Saunoja, unit: Unit | null) => void;

type SelectionSetter = (coord: AxialCoord) => unknown;

type SyncSelectionOverlay = () => void;

type RosterPanelRefresher = () => void;

type RosterDisplayUpdater = () => void;

type SaunojaLookup = Map<string, Saunoja>;

type UnitLookup = Map<string, Unit>;

type PersonaLookup = Map<string, string>;

type VisionSnapshotStore = Map<string, { coordKey: string; radius: number }>;

type NgPlusApplier = (state: NgPlusState) => void;

type NgPlusSaver = (state: NgPlusState) => void;

type StrongholdExclusionZoneGetter = () => StrongholdSpawnExclusionZone | null;

type SaveUnitsFn = () => void;

type LoadUnitsFn = () => Saunoja[];

type RegisterUnitFn = (unit: Unit) => void;

type SyncRosterFn = () => boolean;

type ClaimSaunojaFn = (unit: Unit) => ClaimSaunojaResult;

type DetachSaunojaFn = (unitId: string) => void;

type PickSpawnTileFn = () => AxialCoord | undefined;

export interface GameLoaderDependencies {
  state: GameState;
  eventBus: EventBus;
  map: HexMap;
  units: Unit[];
  unitsById: UnitLookup;
  rosterService: RosterService;
  saunojas: Saunoja[];
  saunojaPolicyBaselines: Map<Saunoja, RosterPersonaBaseline>;
  unitToSaunoja: SaunojaLookup;
  saunojaToUnit: PersonaLookup;
  ensureSaunojaPolicyBaseline: BaselineRefresher;
  applySaunojaBehaviorPreference: BehaviorPreferenceApplier;
  updateBaseStatsFromUnit: BaseStatUpdater;
  setSelectedCoord: SelectionSetter;
  syncSelectionOverlay: SyncSelectionOverlay;
  refreshRosterPanel: RosterPanelRefresher;
  updateRosterDisplay: RosterDisplayUpdater;
  tryGetRuntimeInstance: RuntimeProvider;
  logEvent: LogEvent;
  getSaunaSpawnExclusionZone: StrongholdExclusionZoneGetter;
  unitVisionSnapshots: VisionSnapshotStore;
  initialNgPlusState: NgPlusState;
  applyNgPlusState: NgPlusApplier;
  saveNgPlusState: NgPlusSaver;
}

export interface GameLoaderResult {
  loadUnits: LoadUnitsFn;
  saveUnits: SaveUnitsFn;
  registerUnit: RegisterUnitFn;
  claimSaunoja: ClaimSaunojaFn;
  syncSaunojaRosterWithUnits: SyncRosterFn;
  detachSaunoja: DetachSaunojaFn;
  pickStrongholdSpawnTile: PickSpawnTileFn;
  restoredSave: boolean;
  ngPlusState: NgPlusState;
}

export function configureGameLoader({
  state,
  eventBus,
  map,
  units,
  unitsById,
  rosterService,
  saunojas,
  saunojaPolicyBaselines,
  unitToSaunoja,
  saunojaToUnit,
  ensureSaunojaPolicyBaseline,
  applySaunojaBehaviorPreference,
  updateBaseStatsFromUnit,
  setSelectedCoord,
  syncSelectionOverlay,
  refreshRosterPanel,
  updateRosterDisplay,
  tryGetRuntimeInstance,
  logEvent,
  getSaunaSpawnExclusionZone,
  unitVisionSnapshots,
  initialNgPlusState,
  applyNgPlusState,
  saveNgPlusState
}: GameLoaderDependencies): GameLoaderResult {
  const saveUnits: SaveUnitsFn = () => {
    rosterService.saveUnits();
  };

  const rosterSync = createRosterSyncService({
    rosterService,
    saunojas,
    saunojaPolicyBaselines,
    unitToSaunoja,
    saunojaToUnit,
    ensureSaunojaPolicyBaseline,
    applySaunojaBehaviorPreference,
    updateBaseStatsFromUnit,
    onRosterChanged: () => {
      saveUnits();
      syncSelectionOverlay();
    },
    setSelectedCoord
  });

  const loadUnits: LoadUnitsFn = () => rosterSync.loadUnits();

  const claimSaunoja: ClaimSaunojaFn = (unit) => rosterSync.claimSaunoja(unit);

  const syncSaunojaRosterWithUnits: SyncRosterFn = () => rosterSync.syncRosterWithUnits(units);

  const describeUnit = (unit: Unit, attachedSaunoja?: Saunoja | null): string => {
    if (unit.type === 'stronghold-structure') {
      return 'enemy stronghold';
    }

    if (unit.faction === 'player') {
      const persona = attachedSaunoja ?? unitToSaunoja.get(unit.id) ?? null;
      const name = persona?.name?.trim();
      if (name) {
        return name;
      }
    }

    const ctorName = unit.constructor?.name ?? 'Unit';
    const spacedName = ctorName.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    return `${spacedName} ${unit.id}`.trim();
  };

  const registerUnit: RegisterUnitFn = (unit) => {
    if (unitsById.has(unit.id)) {
      return;
    }

    units.push(unit);
    unitsById.set(unit.id, unit);

    let persona: Saunoja | null = null;
    if (unit.faction === 'player') {
      const changed = syncSaunojaRosterWithUnits();
      if (!changed) {
        refreshRosterPanel();
      }
      persona = unitToSaunoja.get(unit.id) ?? null;
    }

    const runtime = tryGetRuntimeInstance();
    if (runtime?.getCanvas()) {
      runtime.invalidateFrame();
    }

    if (unit.faction === 'player') {
      const steward = 'Our';
      const unitName = describeUnit(unit, persona);
      logEvent({
        type: 'spawn',
        message: `${steward} ${unitName} emerges from the steam.`,
        metadata: {
          unitId: unit.id,
          unitName,
          steward
        }
      });
      updateRosterDisplay();
    }
  };

  const coordKey = (coord: AxialCoord): string => `${coord.q},${coord.r}`;

  const pickEdgeFallback = (): AxialCoord | undefined => {
    const occupied = new Set<string>();
    for (const unit of units) {
      if (!unit.isDead()) {
        occupied.add(coordKey(unit.coord));
      }
    }

    const candidates: AxialCoord[] = [];
    const { minQ, maxQ, minR, maxR } = map;

    const addCandidate = (coord: AxialCoord): void => {
      const key = coordKey(coord);
      if (occupied.has(key)) {
        return;
      }
      map.ensureTile(coord.q, coord.r);
      candidates.push(coord);
    };

    for (let q = minQ; q <= maxQ; q++) {
      addCandidate({ q, r: minR });
      if (maxR !== minR) {
        addCandidate({ q, r: maxR });
      }
    }

    for (let r = minR + 1; r <= maxR - 1; r++) {
      addCandidate({ q: minQ, r });
      if (maxQ !== minQ) {
        addCandidate({ q: maxQ, r });
      }
    }

    if (candidates.length === 0) {
      return undefined;
    }

    const index = Math.floor(Math.random() * candidates.length);
    return candidates[index];
  };

  const pickStrongholdSpawnTile: PickSpawnTileFn = () => {
    const saunaExclusionZone = getSaunaSpawnExclusionZone();
    const strongholdCoord = pickStrongholdSpawnCoord({
      map,
      units,
      random: Math.random,
      excludeZones: saunaExclusionZone ? [saunaExclusionZone] : undefined
    });
    if (strongholdCoord) {
      return strongholdCoord;
    }
    return pickEdgeFallback();
  };

  const detachSaunoja: DetachSaunojaFn = (unitId) => {
    const saunoja = unitToSaunoja.get(unitId);
    if (!saunoja) {
      return;
    }
    saunojaPolicyBaselines.delete(saunoja);
    unitVisionSnapshots.delete(unitId);
    unitToSaunoja.delete(unitId);
    if (saunojaToUnit.get(saunoja.id) === unitId) {
      saunojaToUnit.delete(saunoja.id);
    }
  };

  const onUnitSpawned = ({ unit }: { unit: Unit }): void => {
    registerUnit(unit);
  };

  eventBus.on('unitSpawned', onUnitSpawned);

  const restoredSave = state.load(map);

  let ngPlusState: NgPlusState;
  if (restoredSave) {
    const hydratedNgPlus = state.getNgPlusState();
    applyNgPlusState(hydratedNgPlus);
    saveNgPlusState(hydratedNgPlus);
    ngPlusState = hydratedNgPlus;
  } else {
    const seededNgPlus = state.setNgPlusState(initialNgPlusState);
    applyNgPlusState(seededNgPlus);
    saveNgPlusState(seededNgPlus);
    ngPlusState = seededNgPlus;
  }

  return {
    loadUnits,
    saveUnits,
    registerUnit,
    claimSaunoja,
    syncSaunojaRosterWithUnits,
    detachSaunoja,
    pickStrongholdSpawnTile,
    restoredSave,
    ngPlusState
  };
}
