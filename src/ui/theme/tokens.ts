export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
} as const;

export const radii = {
  sm: '2px',
  md: '4px',
  lg: '8px',
  pill: '999px',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(8, 25, 53, 0.25)',
  md: '0 8px 20px rgba(8, 25, 53, 0.35)',
  lg: '0 24px 48px rgba(8, 25, 53, 0.5)',
  glow: '0 0 36px rgba(56, 189, 248, 0.5)',
} as const;

export const zIndex = {
  hud: 850,
  overlay: 980,
  toast: 990,
  scrim: 1000,
} as const;
