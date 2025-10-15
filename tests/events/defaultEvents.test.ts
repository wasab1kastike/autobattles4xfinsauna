import { describe, expect, it, vi } from 'vitest';

const DEFAULT_ART_PATHS = [
  '/assets/ui/saunoja-roster.svg',
  '/assets/ui/resource.svg',
  '/assets/ui/sauna-beer.svg'
];

describe('default events asset resolution', () => {
  it('uses resolveAssetUrl for art assets', async () => {
    vi.resetModules();
    const originalBase = import.meta.env.BASE_URL;
    import.meta.env.BASE_URL = '/custom-base/';

    const scheduleMock = vi.fn();
    vi.doMock('../../src/events/scheduler.ts', () => ({
      eventScheduler: { schedule: scheduleMock }
    }));

    try {
      const loader = await import('../../src/loader.ts');
      const { defaultEvents } = await import('../../src/events/defaultEvents.ts');

      const resolvedArt = defaultEvents.map((event) => event.content.art);
      const expectedArt = DEFAULT_ART_PATHS.map((path) => loader.resolveAssetUrl(path));

      expect(resolvedArt).toStrictEqual(expectedArt);
      expect(scheduleMock).toHaveBeenCalledTimes(defaultEvents.length);
    } finally {
      import.meta.env.BASE_URL = originalBase;
      vi.doUnmock('../../src/events/scheduler.ts');
      vi.resetModules();
    }
  });
});
