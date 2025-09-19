import { TerrainId } from '../map/terrain.ts';
import plainsIcon from '../../assets/tiles/plains.svg';
import forestIcon from '../../assets/tiles/forest.svg';
import hillsIcon from '../../assets/tiles/mountain.svg';
import lakeIcon from '../../assets/tiles/water.svg';
import { scaleForZoom } from './zoom.ts';

export type TerrainVisual = {
  /** Base color used to paint the underlying hex. */
  baseColor: string;
  /** Path to the vector icon that represents the terrain. */
  icon: string;
};

export const TERRAIN: Record<TerrainId, TerrainVisual> = {
  [TerrainId.Plains]: {
    baseColor: '#d8b869',
    icon: plainsIcon,
  },
  [TerrainId.Forest]: {
    baseColor: '#237a55',
    icon: forestIcon,
  },
  [TerrainId.Hills]: {
    baseColor: '#b57c57',
    icon: hillsIcon,
  },
  [TerrainId.Lake]: {
    baseColor: '#3185d5',
    icon: lakeIcon,
  },
};

export type RGB = readonly [number, number, number];

const WHITE: RGB = [255, 255, 255];
export const NEUTRAL_BASE_RGB: RGB = [12, 18, 28];
const BLACK: RGB = [0, 0, 0];

const DEFAULT_HIGHLIGHT = 'rgba(56, 189, 248, 0.85)';
const DEFAULT_HIGHLIGHT_GLOW = 'rgba(56, 189, 248, 0.45)';

let highlightStroke: string | null = null;
let highlightGlow: string | null = null;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function hexToRgb(hex: string): RGB {
  let normalized = hex.trim().replace('#', '');
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((char) => char + char)
      .join('');
  }
  const value = Number.parseInt(normalized, 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

export function mixRgb(
  base: RGB,
  target: RGB,
  amount: number
): [number, number, number] {
  const t = clamp01(amount);
  return [
    Math.round(base[0] + (target[0] - base[0]) * t),
    Math.round(base[1] + (target[1] - base[1]) * t),
    Math.round(base[2] + (target[2] - base[2]) * t),
  ];
}

export function rgbString(rgb: RGB): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export function rgbaString(rgb: RGB, alpha = 1): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

export function neutral(alpha = 1): string {
  return rgbaString(NEUTRAL_BASE_RGB, alpha);
}

export function lightenNeutral(amount: number, alpha = 1): string {
  return rgbaString(mixRgb(NEUTRAL_BASE_RGB, WHITE, amount), alpha);
}

export function darkenNeutral(amount: number, alpha = 1): string {
  return rgbaString(mixRgb(NEUTRAL_BASE_RGB, BLACK, amount), alpha);
}

export type OutlineWeight = 'terrain' | 'hover' | 'selection';

const OUTLINE_BASE: Record<OutlineWeight, number> = {
  terrain: 0.05,
  hover: 0.065,
  selection: 0.085,
};

const OUTLINE_MIN: Record<OutlineWeight, number> = {
  terrain: 1,
  hover: 1.35,
  selection: 2.1,
};

export function getOutlineWidth(
  hexSize: number,
  zoom: number,
  weight: OutlineWeight = 'terrain'
): number {
  const base = hexSize * OUTLINE_BASE[weight];
  const adjusted = scaleForZoom(base, zoom);
  return Math.max(OUTLINE_MIN[weight], adjusted);
}

export function getHighlightTokens(): { stroke: string; glow: string } {
  if (highlightStroke && highlightGlow) {
    return { stroke: highlightStroke, glow: highlightGlow };
  }

  if (typeof window !== 'undefined') {
    const styles = getComputedStyle(document.documentElement);
    const stroke = styles.getPropertyValue('--tile-highlight-ring').trim();
    const glow = styles.getPropertyValue('--tile-highlight-glow').trim();
    highlightStroke = stroke || DEFAULT_HIGHLIGHT;
    highlightGlow = glow || DEFAULT_HIGHLIGHT_GLOW;
  } else {
    highlightStroke = DEFAULT_HIGHLIGHT;
    highlightGlow = DEFAULT_HIGHLIGHT_GLOW;
  }

  return { stroke: highlightStroke, glow: highlightGlow };
}
