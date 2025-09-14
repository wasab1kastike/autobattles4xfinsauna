import { eventBus } from './EventBus';
import type { GameState } from '../core/GameState';
import { Resource } from '../core/GameState';

type PolicyPayload = { policy: string; state: GameState };

const applyEco = ({ policy, state }: PolicyPayload): void => {
  if (policy !== 'eco') return;
  // Increase gold generation by 1 when eco policy applied
  state.modifyPassiveGeneration(Resource.GOLD, 1);
  eventBus.off('policyApplied', applyEco);
};

const applyTemperance = ({ policy, state }: PolicyPayload): void => {
  if (policy !== 'temperance') return;
  state.nightWorkSpeedMultiplier *= 1.05;
  eventBus.off('policyApplied', applyTemperance);
};

eventBus.on<PolicyPayload>('policyApplied', applyEco);
eventBus.on<PolicyPayload>('policyApplied', applyTemperance);
