const iconCache = new Map<string, HTMLImageElement>();

type IconLoadListener = (path: string, icon: HTMLImageElement) => void;

const iconListeners = new Map<string, Set<IconLoadListener>>();
const readyIcons = new WeakSet<HTMLImageElement>();
const pendingIcons = new WeakSet<HTMLImageElement>();

let resolvedBaseUrl: string | null = null;

function resolveBaseUrl(): string {
  if (resolvedBaseUrl) {
    return resolvedBaseUrl;
  }

  const base = import.meta.env.BASE_URL ?? '/';
  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(base);
  if (hasScheme) {
    resolvedBaseUrl = base;
    return resolvedBaseUrl;
  }

  const normalizedPath = base.startsWith('/') ? base : `/${base}`;

  if (typeof window !== 'undefined' && typeof window.location?.origin === 'string') {
    resolvedBaseUrl = `${window.location.origin}${normalizedPath}`;
  } else {
    resolvedBaseUrl = `http://localhost${normalizedPath}`;
  }

  return resolvedBaseUrl;
}

function queueMicrotaskSafe(callback: () => void): void {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(callback);
  } else {
    setTimeout(callback, 0);
  }
}

function isIconReady(icon: HTMLImageElement): boolean {
  return icon.complete && icon.naturalWidth > 0 && icon.naturalHeight > 0;
}

function notifyIconLoaded(path: string, icon: HTMLImageElement): void {
  if (readyIcons.has(icon)) {
    return;
  }

  readyIcons.add(icon);

  const listeners = iconListeners.get(path);
  if (!listeners || listeners.size === 0) {
    return;
  }

  iconListeners.delete(path);

  for (const listener of listeners) {
    try {
      listener(path, icon);
    } catch (error) {
      console.error('Icon load listener failed', error);
    }
  }
}

function registerImageLoadHandlers(path: string, icon: HTMLImageElement): void {
  if (readyIcons.has(icon) || pendingIcons.has(icon)) {
    return;
  }

  pendingIcons.add(icon);

  const handleLoaded = (): void => {
    pendingIcons.delete(icon);
    notifyIconLoaded(path, icon);
  };

  icon.addEventListener('load', handleLoaded, { once: true });

  if (typeof icon.decode === 'function') {
    icon
      .decode()
      .then(handleLoaded)
      .catch(() => {
        // Fall back to the load event when decode is unsupported or fails.
      });
  }

  if (isIconReady(icon)) {
    queueMicrotaskSafe(handleLoaded);
  }
}

export function onIconLoaded(path: string, listener: IconLoadListener): () => void {
  const icon = iconCache.get(path);
  if (icon && isIconReady(icon)) {
    queueMicrotaskSafe(() => {
      listener(path, icon);
    });
    return () => {};
  }

  let listeners = iconListeners.get(path);
  if (!listeners) {
    listeners = new Set();
    iconListeners.set(path, listeners);
  }

  listeners.add(listener);

  return () => {
    const existing = iconListeners.get(path);
    if (!existing) {
      return;
    }
    existing.delete(listener);
    if (existing.size === 0) {
      iconListeners.delete(path);
    }
  };
}

export function loadIcon(path: string): HTMLImageElement | undefined {
  let icon = iconCache.get(path);
  if (!icon) {
    icon = new Image();
    icon.decoding = 'async';
    const normalized = new URL(path, resolveBaseUrl()).href;
    icon.src = normalized;
    registerImageLoadHandlers(path, icon);
    iconCache.set(path, icon);
  } else if (!isIconReady(icon)) {
    registerImageLoadHandlers(path, icon);
  }

  if (isIconReady(icon)) {
    return icon;
  }

  return undefined;
}

export function clearIconCache(): void {
  iconCache.clear();
  iconListeners.clear();
  resolvedBaseUrl = null;
}
