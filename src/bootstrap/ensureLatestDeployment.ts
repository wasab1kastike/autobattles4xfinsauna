const BUILD_RELOAD_STORAGE_KEY = 'sauna:build-reload';
const BUILD_CACHE_PARAM = 'build';

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch (error) {
    console.warn('Session storage is unavailable:', error);
    return null;
  }
}

function readReloadGuard(storage: Storage | null): string | null {
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(BUILD_RELOAD_STORAGE_KEY);
  } catch (error) {
    console.warn('Unable to read stale build reload guard from session storage:', error);
    return null;
  }
}

function writeReloadGuard(storage: Storage | null, liveCommit: string): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(BUILD_RELOAD_STORAGE_KEY, liveCommit);
    return true;
  } catch (error) {
    console.warn('Unable to persist stale build reload guard in session storage:', error);
    return false;
  }
}

function clearReloadGuard(storage: Storage | null): void {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(BUILD_RELOAD_STORAGE_KEY);
  } catch (error) {
    console.warn('Unable to clear stale build reload guard from session storage:', error);
  }
}

function hasBuildCacheParam(url: URL, liveCommit: string): boolean {
  return url.searchParams.get(BUILD_CACHE_PARAM) === liveCommit;
}

function removeCacheBusterParam(): void {
  if (typeof window === 'undefined' || typeof window.history === 'undefined') {
    return;
  }

  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(BUILD_CACHE_PARAM)) {
      return;
    }

    url.searchParams.delete(BUILD_CACHE_PARAM);
    const nextSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
    window.history.replaceState(null, document.title, nextUrl);
  } catch (error) {
    console.warn('Unable to clear build cache bust parameter:', error);
  }
}

export interface EnsureLatestDeploymentOptions {
  force?: boolean;
}

export async function ensureLatestDeployment(
  options: EnsureLatestDeploymentOptions = {},
): Promise<void> {
  if (!options.force && (import.meta.env.DEV || typeof window === 'undefined')) {
    return;
  }

  const rawCommit = typeof __COMMIT__ === 'string' ? __COMMIT__.trim().toLowerCase() : '';
  if (!rawCommit || rawCommit === 'unknown') {
    return;
  }

  const storage = getSessionStorage();
  const origin = window.location.origin;
  const htmlUrl = new URL(window.location.pathname, origin);
  htmlUrl.searchParams.set('cb', Date.now().toString());

  const requestOptions: RequestInit = {
    cache: 'no-store',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  };

  try {
    const response = await fetch(htmlUrl, requestOptions);
    if (!response.ok) {
      console.warn(`Unable to verify live deployment: received HTTP ${response.status}`);
      return;
    }

    const html = await response.text();
    const scriptMatch = html.match(/<script[^>]+src="([^"]*index-[^"]+\.js)"/i);
    if (!scriptMatch) {
      console.warn('Unable to locate the published bundle reference while checking for stale builds.');
      return;
    }

    const htmlBaseUrl = response.url ? new URL(response.url) : htmlUrl;
    const htmlDirUrl = new URL('.', htmlBaseUrl);
    let scriptSrc = scriptMatch[1];

    if (
      scriptSrc.startsWith('/') &&
      htmlDirUrl.pathname !== '/' &&
      !scriptSrc.startsWith(htmlDirUrl.pathname)
    ) {
      const normalizedDir = htmlDirUrl.pathname.endsWith('/')
        ? htmlDirUrl.pathname.slice(0, -1)
        : htmlDirUrl.pathname;
      scriptSrc = `${normalizedDir}${scriptSrc}`;
    }

    const bundleUrl = new URL(scriptSrc, htmlDirUrl);
    bundleUrl.searchParams.set('cb', Date.now().toString());
    const bundleResponse = await fetch(bundleUrl, requestOptions);
    if (!bundleResponse.ok) {
      console.warn(
        `Unable to fetch published bundle while checking for stale builds: HTTP ${bundleResponse.status}`,
      );
      return;
    }

    const bundleSource = await bundleResponse.text();
    const commitMatch = bundleSource.match(/"([0-9a-f]{7})"\.trim\(\)/i);
    if (!commitMatch) {
      console.warn('Unable to resolve the published commit hash while checking for stale builds.');
      return;
    }

    const liveCommit = commitMatch[1].toLowerCase();
    if (liveCommit === rawCommit) {
      clearReloadGuard(storage);
      removeCacheBusterParam();
      return;
    }

    const priorReload = readReloadGuard(storage);
    if (priorReload === liveCommit) {
      console.warn('Skipping repeated stale build reload attempt for commit', liveCommit);
      return;
    }

    const nextUrl = new URL(window.location.href);
    const hasExistingGuard = hasBuildCacheParam(nextUrl, liveCommit);

    const guardPersisted = writeReloadGuard(storage, liveCommit);
    if (!guardPersisted && hasExistingGuard) {
      console.warn('Skipping repeated stale build reload attempt for commit', liveCommit);
      return;
    }

    nextUrl.searchParams.set(BUILD_CACHE_PARAM, liveCommit);
    window.location.replace(nextUrl.toString());
  } catch (error) {
    console.warn('Unable to verify the deployed build while checking for stale caches:', error);
  }
}
