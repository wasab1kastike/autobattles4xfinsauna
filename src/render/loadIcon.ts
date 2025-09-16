const iconCache = new Map<string, HTMLImageElement>();

export function loadIcon(path: string): HTMLImageElement | undefined {
  let icon = iconCache.get(path);
  if (!icon) {
    icon = new Image();
    icon.decoding = 'async';
    const normalized = new URL(path, import.meta.env.BASE_URL).href;
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
}
