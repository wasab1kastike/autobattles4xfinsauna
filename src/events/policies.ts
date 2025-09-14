import { eventBus } from './EventBus';
import type { GameState } from '../core/GameState';
import { Resource } from '../core/GameState';

type PolicyPayload = { policy: string; state: GameState };

const onPolicyApplied = ({ policy, state }: PolicyPayload): void => {
  if (policy === 'eco') {
    // Increase gold generation by 1 when eco policy applied
    state.modifyPassiveGeneration(Resource.GOLD, 1);
    eventBus.off('policyApplied', onPolicyApplied);
  }
};

// Example policy listeners.
eventBus.on<PolicyPayload>('policyApplied', onPolicyApplied);
