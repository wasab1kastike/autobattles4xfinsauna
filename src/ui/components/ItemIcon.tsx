import type { SaunojaItem } from '../../units/saunoja.ts';

export interface ItemIconProps extends SaunojaItem {}

function buildTooltip(props: ItemIconProps): string {
  const segments: string[] = [props.name];
  if (props.description) {
    segments.push(props.description);
  }
  if (props.rarity) {
    segments.push(`Rarity: ${props.rarity}`);
  }
  if (props.quantity > 1) {
    segments.push(`Quantity: ${props.quantity}`);
  }
  return segments.join(' — ');
}

function renderFallbackGlyph(name: string): HTMLSpanElement {
  const glyph = document.createElement('span');
  glyph.classList.add('item-icon__fallback');
  const trimmed = name.trim();
  glyph.textContent = trimmed ? trimmed[0]?.toUpperCase() ?? '?' : '?';
  glyph.setAttribute('aria-hidden', 'true');
  return glyph;
}

function renderImage(src: string, name: string): HTMLImageElement {
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.decoding = 'async';
  img.loading = 'lazy';
  img.classList.add('item-icon__image');
  img.setAttribute('aria-hidden', 'true');
  img.title = name;
  return img;
}

export function renderItemIcon(props: ItemIconProps): HTMLLIElement {
  const root = document.createElement('li');
  root.classList.add('item-icon');
  root.dataset.itemId = props.id;
  const tooltip = buildTooltip(props);
  root.title = tooltip;
  root.setAttribute('aria-label', tooltip);
  root.setAttribute('role', 'listitem');
  if (props.rarity) {
    root.dataset.rarity = props.rarity.toLowerCase();
  }

  if (props.icon && props.icon.trim().length > 0) {
    root.appendChild(renderImage(props.icon, props.name));
  } else {
    root.appendChild(renderFallbackGlyph(props.name));
  }

  if (props.quantity > 1) {
    const badge = document.createElement('span');
    badge.classList.add('item-icon__quantity');
    badge.textContent = `×${props.quantity}`;
    badge.setAttribute('aria-hidden', 'true');
    root.appendChild(badge);
  }

  return root;
}
