const iconCache = new Map<string, HTMLImageElement>();

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

export function loadIcon(path: string): HTMLImageElement | undefined {
  let icon = iconCache.get(path);
  if (!icon) {
    icon = new Image();
    icon.decoding = 'async';
    const normalized = new URL(path, resolveBaseUrl()).href;
    icon.src = normalized;
    iconCache.set(path, icon);
  }

  if (icon.complete && icon.naturalWidth > 0 && icon.naturalHeight > 0) {
    return icon;
  }

  return undefined;
}

export function clearIconCache(): void {
  iconCache.clear();
  resolvedBaseUrl = null;
}
