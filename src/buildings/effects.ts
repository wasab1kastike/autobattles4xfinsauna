import { eventBus } from '../events/EventBus.ts';
import type { AxialCoord } from '../hex/HexUtils.ts';
import type { GameState } from '../core/GameState.ts';
import { Resource } from '../core/GameState.ts';
import { Farm } from './Farm.ts';
import { Barracks } from './Barracks.ts';
import type { Building } from './Building.ts';

export type BuildingPlacedPayload = {
  building: Building;
  coord: AxialCoord;
  state: GameState;
};

export type BuildingRemovedPayload = {
  building: Building;
  coord: AxialCoord;
  state: GameState;
};

const onBuildingPlaced = ({ building, coord, state }: BuildingPlacedPayload): void => {
  if (building instanceof Farm) {
    state.modifyPassiveGeneration(Resource.GOLD, building.foodPerTick);
  } else if (building instanceof Barracks) {
    // Spawn a basic unit for the player when barracks is placed
    import('../units/UnitFactory.ts').then(({ spawnUnit }) => {
      spawnUnit(state, 'soldier', `barracks-${coord.q}-${coord.r}`, coord, 'player');
    });
  }
};

const onBuildingRemoved = ({ building, state }: BuildingRemovedPayload): void => {
  if (building instanceof Farm) {
    state.modifyPassiveGeneration(Resource.GOLD, -building.foodPerTick);
  }
};

// register listeners for building effects
eventBus.on<BuildingPlacedPayload>('buildingPlaced', onBuildingPlaced);
eventBus.on<BuildingRemovedPayload>('buildingRemoved', onBuildingRemoved);
