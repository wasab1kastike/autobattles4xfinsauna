import { eventBus } from './EventBus';
import { listPolicies, type PolicyAppliedEvent, type PolicyEffectHook, type PolicyDefinition } from '../data/policies.ts';

const disposers: Array<() => void> = [];

function subscribeEffect(definition: PolicyDefinition, effect: PolicyEffectHook): void {
  const seenStates = new WeakSet<PolicyAppliedEvent['state']>();
  const listener = (payload: PolicyAppliedEvent): void => {
    if (payload.policy.id !== definition.id) {
      return;
    }
    if (effect.once !== false && seenStates.has(payload.state)) {
      return;
    }
    effect.invoke(payload);
    if (effect.once !== false) {
      seenStates.add(payload.state);
    }
  };

  eventBus.on<PolicyAppliedEvent>(effect.event, listener);
  disposers.push(() => eventBus.off(effect.event, listener));
}

for (const definition of listPolicies()) {
  for (const effect of definition.effects) {
    subscribeEffect(definition, effect);
  }
}

export function disposePolicyListeners(): void {
  while (disposers.length > 0) {
    const dispose = disposers.pop();
    dispose?.();
  }
}
