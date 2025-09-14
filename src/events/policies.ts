import { eventBus } from './EventBus';
import type { GameState } from '../core/GameState';
import { Resource, PASSIVE_GENERATION } from '../core/GameState';

type PolicyPayload = { policy: string; state: GameState };

const onPolicyApplied = ({ policy, state }: PolicyPayload): void => {
  if (policy === 'eco') {
    // Increase gold generation by 1 when eco policy applied
    state.modifyPassiveGeneration(Resource.GOLD, 1);
    return;
  }
  if (policy === 'temperance') {
    const bonus = PASSIVE_GENERATION[Resource.GOLD] * 0.05;
    let active = false;
    const onTimeOfDay = ({ isNight }: { isNight: boolean }): void => {
      if (isNight && !active) {
        state.modifyPassiveGeneration(Resource.GOLD, bonus);
        active = true;
      } else if (!isNight && active) {
        state.modifyPassiveGeneration(Resource.GOLD, -bonus);
        active = false;
      }
    };
    eventBus.on('timeOfDayChanged', onTimeOfDay);
  }
};

// Example policy listeners.
eventBus.on<PolicyPayload>('policyApplied', onPolicyApplied);
