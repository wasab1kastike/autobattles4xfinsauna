import { describe, expect, it } from 'vitest';
import { StrongholdSpawner } from './StrongholdSpawner.ts';

describe('StrongholdSpawner', () => {
  it('activates queued strongholds every 180 seconds', () => {
    const spawner = new StrongholdSpawner({
      inactiveStrongholds: ['ember-sanctum', 'glacier-bastion', 'spirit-thicket']
    });

    expect(spawner.update(60)).toEqual([]);
    expect(spawner.update(90)).toEqual([]);
    expect(spawner.update(30)).toEqual(['ember-sanctum']);
    expect(spawner.getQueue()).toEqual(['glacier-bastion', 'spirit-thicket']);

    expect(spawner.update(200)).toEqual(['glacier-bastion']);
    expect(spawner.update(180)).toEqual(['spirit-thicket']);
    expect(spawner.update(180)).toEqual([]);
  });

  it('handles multiple activation windows in a single update tick', () => {
    const spawner = new StrongholdSpawner({
      inactiveStrongholds: ['alpha', 'beta', 'gamma']
    });

    expect(spawner.update(540)).toEqual(['alpha', 'beta', 'gamma']);
    expect(spawner.getQueue()).toEqual([]);
    expect(spawner.update(0)).toEqual([]);
  });

  it('restores cooldown progress and queue from snapshots', () => {
    const spawner = new StrongholdSpawner({
      inactiveStrongholds: ['citadel', 'keep', 'bastion']
    });

    expect(spawner.update(200)).toEqual(['citadel']);
    const snapshot = spawner.getSnapshot();
    expect(snapshot.queue).toEqual(['keep', 'bastion']);
    expect(snapshot.timeUntilNextActivation).toBe(160);

    const restored = new StrongholdSpawner();
    restored.restore(snapshot);
    expect(restored.getSnapshot()).toEqual(snapshot);

    expect(restored.update(160)).toEqual(['keep']);
    const nextSnapshot = restored.getSnapshot();
    expect(nextSnapshot.queue).toEqual(['bastion']);
    expect(Math.round(nextSnapshot.timeUntilNextActivation)).toBe(180);

    expect(restored.update(180)).toEqual(['bastion']);
    expect(restored.update(0)).toEqual([]);
  });
});
