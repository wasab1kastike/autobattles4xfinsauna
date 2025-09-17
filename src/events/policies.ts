import { eventBus } from './EventBus';
import type { GameState } from '../core/GameState';
import { Resource } from '../core/GameState';

type PolicyPayload = { policy: string; state: GameState };

const applyEco = ({ policy, state }: PolicyPayload): void => {
  if (policy !== 'eco') return;
  // Infuse the sauna beer reserves with +1 passive bottle each tick
  state.modifyPassiveGeneration(Resource.SAUNA_BEER, 1);
  eventBus.off('policyApplied', applyEco);
};

const applyTemperance = ({ policy, state }: PolicyPayload): void => {
  if (policy !== 'temperance') return;
  state.nightWorkSpeedMultiplier *= 1.05;
  eventBus.off('policyApplied', applyTemperance);
};

const applySteamDiplomats = ({ policy, state }: PolicyPayload): void => {
  if (policy !== 'steam-diplomats') return;
  state.modifyPassiveGeneration(Resource.SAUNAKUNNIA, 1);
  eventBus.off('policyApplied', applySteamDiplomats);
};

eventBus.on<PolicyPayload>('policyApplied', applyEco);
eventBus.on<PolicyPayload>('policyApplied', applyTemperance);
eventBus.on<PolicyPayload>('policyApplied', applySteamDiplomats);
