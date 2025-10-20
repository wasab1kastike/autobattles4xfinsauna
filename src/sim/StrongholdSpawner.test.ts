import { describe, expect, it } from 'vitest';
import { StrongholdSpawner, type StrongholdSpawnerSnapshot } from './StrongholdSpawner.ts';

describe('StrongholdSpawner', () => {
  it('emits queued strongholds after every 180 second interval', () => {
    const spawner = new StrongholdSpawner({ initialQueue: ['alpha', 'beta', 'gamma'] });

    expect(spawner.update(120)).toEqual([]);
    expect(spawner.update(60)).toEqual(['alpha']);

    expect(spawner.update(100)).toEqual([]);
    expect(spawner.update(80)).toEqual(['beta']);

    expect(spawner.update(400)).toEqual(['gamma']);
    expect(spawner.update(10)).toEqual([]);

    spawner.queueStronghold('delta');
    expect(spawner.update(0.5)).toEqual(['delta']);
  });

  it('prevents duplicate queueing and supports manual removal', () => {
    const spawner = new StrongholdSpawner();

    spawner.queueStronghold('alpha');
    spawner.queueStronghold('alpha');
    spawner.queueStrongholds(['beta', 'beta', 'gamma']);
    spawner.removeStronghold('beta');

    expect(spawner.getSnapshot().queue).toEqual(['alpha', 'gamma']);
  });

  it('restores elapsed seconds, cooldown, and queue from snapshot', () => {
    const spawner = new StrongholdSpawner({ initialQueue: ['alpha', 'beta'] });

    expect(spawner.update(90)).toEqual([]);
    const snapshot = spawner.getSnapshot();

    const restored = new StrongholdSpawner({ snapshot });
    restored.queueStronghold('gamma');

    expect(restored.update(100)).toEqual(['alpha']);
    expect(restored.update(160)).toEqual([]);
    expect(restored.update(20)).toEqual(['beta']);

    const secondSnapshot: StrongholdSpawnerSnapshot = {
      ...restored.getSnapshot(),
      cooldownRemaining: 10,
      queue: ['gamma']
    };

    restored.restore(secondSnapshot);
    expect(restored.update(10)).toEqual(['gamma']);
  });
});
