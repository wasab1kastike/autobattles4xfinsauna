import { describe, expect, it, vi } from 'vitest';

import { ModifierRuntime } from '../../src/mods/runtime.ts';

describe('ModifierRuntime', () => {
  it('cleans up state when onApply throws', () => {
    const runtime = new ModifierRuntime(null);
    const listener = vi.fn();
    runtime.on('modifierAdded', listener);

    expect(() =>
      runtime.add({
        id: 'unstable-mod',
        duration: 5,
        hooks: {
          tick: () => {}
        },
        onApply: () => {
          throw new Error('kaboom');
        }
      })
    ).toThrowError('kaboom');

    expect(runtime.has('unstable-mod')).toBe(false);
    expect(runtime.list()).toHaveLength(0);

    const internals = runtime as unknown as {
      hookIndex: Map<string, Set<string>>;
    };
    expect(internals.hookIndex.has('tick')).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });
});
