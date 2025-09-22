const FALLBACKS = {
  player: {
    shell: 'rgba(30, 38, 58, 0.95)',
    mid: 'rgba(45, 60, 98, 0.94)',
    rim: 'rgba(118, 214, 255, 0.7)',
    highlight: 'rgba(190, 230, 255, 0.65)',
    ring: 'rgba(86, 151, 255, 0.65)',
    motionGlowRgb: '124 215 255',
    accentTint: 'rgba(56, 189, 248, 0.85)',
    accentHalo: 'rgba(14, 165, 233, 0.35)'
  },
  enemy: {
    shell: 'rgba(46, 24, 32, 0.95)',
    mid: 'rgba(66, 36, 44, 0.95)',
    rim: 'rgba(248, 140, 120, 0.7)',
    highlight: 'rgba(250, 190, 170, 0.55)',
    ring: 'rgba(255, 128, 96, 0.6)',
    motionGlowRgb: '255 140 110',
    accentTint: 'rgba(248, 113, 113, 0.85)',
    accentHalo: 'rgba(239, 68, 68, 0.35)'
  }
} as const satisfies Record<FactionKey, FactionPaletteTokens>;

const CSS_VARIABLES = {
  player: {
    shell: '--faction-player-shell',
    mid: '--faction-player-mid',
    rim: '--faction-player-rim',
    highlight: '--faction-player-highlight',
    ring: '--faction-player-ring',
    motionGlowRgb: '--faction-player-motion-glow-rgb',
    accentTint: '--faction-player-accent-tint',
    accentHalo: '--faction-player-accent-halo'
  },
  enemy: {
    shell: '--faction-enemy-shell',
    mid: '--faction-enemy-mid',
    rim: '--faction-enemy-rim',
    highlight: '--faction-enemy-highlight',
    ring: '--faction-enemy-ring',
    motionGlowRgb: '--faction-enemy-motion-glow-rgb',
    accentTint: '--faction-enemy-accent-tint',
    accentHalo: '--faction-enemy-accent-halo'
  }
} as const satisfies Record<FactionKey, Record<keyof FactionPaletteTokens, string>>;

type FactionKey = 'player' | 'enemy';

type FactionPaletteTokens = {
  readonly shell: string;
  readonly mid: string;
  readonly rim: string;
  readonly highlight: string;
  readonly ring: string;
  readonly motionGlowRgb: string;
  readonly accentTint: string;
  readonly accentHalo: string;
};

export interface FactionPalette {
  readonly shell: string;
  readonly mid: string;
  readonly rim: string;
  readonly highlight: string;
  readonly ring: string;
  readonly motionGlow: string;
}

export interface FactionAccent {
  readonly tint: string;
  readonly halo: string;
}

const paletteCache = new Map<FactionKey, FactionPaletteTokens>();

function getComputedRoot(): CSSStyleDeclaration | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }
  try {
    return getComputedStyle(document.documentElement);
  } catch (error) {
    console.warn('Failed to access root computed styles for faction palette', error);
    return null;
  }
}

function readCssVariable(
  computed: CSSStyleDeclaration,
  name: string,
  fallback: string
): string {
  const value = computed.getPropertyValue(name);
  if (!value) {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function parseRgb(value: string): [string, string, string] | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const sanitized = trimmed
    .replace(/,/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (sanitized.length < 3) {
    return null;
  }
  return [sanitized[0], sanitized[1], sanitized[2]];
}

function toMotionGlow(
  rgbValue: string,
  fallbackRgbValue: string,
  opacity: number
): string {
  const rgb = parseRgb(rgbValue) ?? parseRgb(fallbackRgbValue);
  const [r, g, b] = rgb ?? parseRgb(FALLBACKS.player.motionGlowRgb)!;
  return `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(3)})`;
}

function resolveTokens(faction: FactionKey): FactionPaletteTokens {
  const cached = paletteCache.get(faction);
  if (cached) {
    return cached;
  }

  const computed = getComputedRoot();
  if (!computed) {
    return FALLBACKS[faction];
  }

  const cssVars = CSS_VARIABLES[faction];
  const resolved: FactionPaletteTokens = {
    shell: readCssVariable(computed, cssVars.shell, FALLBACKS[faction].shell),
    mid: readCssVariable(computed, cssVars.mid, FALLBACKS[faction].mid),
    rim: readCssVariable(computed, cssVars.rim, FALLBACKS[faction].rim),
    highlight: readCssVariable(computed, cssVars.highlight, FALLBACKS[faction].highlight),
    ring: readCssVariable(computed, cssVars.ring, FALLBACKS[faction].ring),
    motionGlowRgb: readCssVariable(
      computed,
      cssVars.motionGlowRgb,
      FALLBACKS[faction].motionGlowRgb
    ),
    accentTint: readCssVariable(computed, cssVars.accentTint, FALLBACKS[faction].accentTint),
    accentHalo: readCssVariable(computed, cssVars.accentHalo, FALLBACKS[faction].accentHalo)
  };

  paletteCache.set(faction, resolved);
  return resolved;
}

export function getFactionPalette(faction: FactionKey, opacity: number): FactionPalette {
  const tokens = resolveTokens(faction);
  const fallbackTokens = FALLBACKS[faction];
  return {
    shell: tokens.shell,
    mid: tokens.mid,
    rim: tokens.rim,
    highlight: tokens.highlight,
    ring: tokens.ring,
    motionGlow: toMotionGlow(tokens.motionGlowRgb, fallbackTokens.motionGlowRgb, opacity)
  } satisfies FactionPalette;
}

export function getFactionAccent(faction: FactionKey): FactionAccent {
  const tokens = resolveTokens(faction);
  return {
    tint: tokens.accentTint,
    halo: tokens.accentHalo
  } satisfies FactionAccent;
}

export function resetFactionPaletteCacheForTest(): void {
  paletteCache.clear();
}
