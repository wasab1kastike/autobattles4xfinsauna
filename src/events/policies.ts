import { eventBus } from './EventBus';
import type { GameState } from '../core/GameState';
import { Resource } from '../core/GameState';

type PolicyPayload = { policy: string; state: GameState };

// Example policy listeners.
eventBus.on<PolicyPayload>('policyApplied', ({ policy, state }) => {
  if (policy === 'eco') {
    // Increase gold generation by 1 when eco policy applied
    state.modifyPassiveGeneration(Resource.GOLD, 1);
  }
});
