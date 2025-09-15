import { eventBus } from '../events';
import { Resource } from '../core/GameState.ts';
import { Farm } from './Farm.ts';
import { Barracks } from './Barracks.ts';
import type { BuildingPlacedEvent, BuildingRemovedEvent } from '../events';

const onBuildingPlaced = ({ building, coord, state }: BuildingPlacedEvent): void => {
  if (building instanceof Farm) {
    state.modifyPassiveGeneration(Resource.GOLD, building.foodPerTick);
  } else if (building instanceof Barracks) {
    // Spawn a basic unit for the player when barracks is placed
    import('../units/UnitFactory.ts').then(({ spawnUnit }) => {
      spawnUnit(state, 'soldier', `barracks-${coord.q}-${coord.r}`, coord, 'player');
    });
  }
};

const onBuildingRemoved = ({ building, state }: BuildingRemovedEvent): void => {
  if (building instanceof Farm) {
    state.modifyPassiveGeneration(Resource.GOLD, -building.foodPerTick);
  }
};

// register listeners for building effects
eventBus.on<BuildingPlacedEvent>('buildingPlaced', onBuildingPlaced);
eventBus.on<BuildingRemovedEvent>('buildingRemoved', onBuildingRemoved);
