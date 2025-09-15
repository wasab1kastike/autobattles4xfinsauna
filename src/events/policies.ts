import { eventBus } from './EventBus';
import { Resource } from '../core/GameState';
import type { PolicyAppliedEvent } from './types.ts';

const applyEco = ({ policy, state }: PolicyAppliedEvent): void => {
  if (policy !== 'eco') return;
  // Increase gold generation by 1 when eco policy applied
  state.modifyPassiveGeneration(Resource.GOLD, 1);
  eventBus.off('policyApplied', applyEco);
};

const applyTemperance = ({ policy, state }: PolicyAppliedEvent): void => {
  if (policy !== 'temperance') return;
  state.nightWorkSpeedMultiplier *= 1.05;
  eventBus.off('policyApplied', applyTemperance);
};

eventBus.on<PolicyAppliedEvent>('policyApplied', applyEco);
eventBus.on<PolicyAppliedEvent>('policyApplied', applyTemperance);
