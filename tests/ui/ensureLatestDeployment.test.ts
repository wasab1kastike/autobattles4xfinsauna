import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureLatestDeployment } from '../../src/bootstrap/ensureLatestDeployment.ts';

declare global {
  // eslint-disable-next-line no-var
  var __COMMIT__: string | undefined;
}

const CURRENT_COMMIT = 'abc1234';
const LIVE_COMMIT = 'def5678';

function createHtmlResponse() {
  return {
    ok: true,
    status: 200,
    text: () =>
      Promise.resolve(
        '<!doctype html><html><head></head><body><script src="/assets/index-123.js"></script></body></html>',
      ),
    url: 'http://localhost/index.html',
  } as Response;
}

function createBundleResponse() {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(`const commit = "${LIVE_COMMIT.toUpperCase()}".trim();`),
    url: 'http://localhost/assets/index-123.js',
  } as Response;
}

describe('ensureLatestDeployment', () => {
  let locationReplaceSpy: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    vi.restoreAllMocks();

    globalThis.__COMMIT__ = CURRENT_COMMIT;
    originalLocation = window.location;

    const locationUrl = new URL('http://localhost/index.html');
    const locationStub = {
      href: locationUrl.toString(),
      origin: locationUrl.origin,
      pathname: locationUrl.pathname,
      search: locationUrl.search,
      hash: locationUrl.hash,
    } as Location;

    locationReplaceSpy = vi.fn((url: string) => {
      const nextUrl = new URL(url, locationStub.href);
      locationStub.href = nextUrl.toString();
      locationStub.origin = nextUrl.origin;
      locationStub.pathname = nextUrl.pathname;
      locationStub.search = nextUrl.search;
      locationStub.hash = nextUrl.hash;
    });

    Object.defineProperty(locationStub, 'replace', {
      value: locationReplaceSpy,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(window, 'location', {
      value: locationStub,
      configurable: true,
      writable: true,
    });

    const storageStub = {
      length: 0,
      clear: vi.fn(),
      getItem: vi.fn(() => null),
      key: vi.fn(),
      removeItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error('denied');
      }),
    } as unknown as Storage;

    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => storageStub);

    vi.spyOn(window, 'history', 'get').mockReturnValue({
      replaceState: vi.fn(),
    } as unknown as History);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true,
    });
  });

  it('only reloads once when session storage cannot persist the guard', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createHtmlResponse())
      .mockResolvedValueOnce(createBundleResponse())
      .mockResolvedValueOnce(createHtmlResponse())
      .mockResolvedValueOnce(createBundleResponse());

    vi.stubGlobal('fetch', fetchMock);

    await ensureLatestDeployment({ force: true });
    expect(locationReplaceSpy).toHaveBeenCalledTimes(1);

    await ensureLatestDeployment({ force: true });
    expect(locationReplaceSpy).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
