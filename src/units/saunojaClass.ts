import type { SaunojaClass } from './saunoja.ts';

export const SAUNOJA_CLASS_IDS: readonly SaunojaClass[] = Object.freeze([
  'tank',
  'rogue',
  'wizard',
  'speedster'
]);

export const SAUNOJA_CLASS_DISPLAY_NAMES: Readonly<Record<SaunojaClass, string>> = Object.freeze({
  tank: 'Aegis Vanguard',
  rogue: 'Veilstrider',
  wizard: 'Aurora Sage',
  speedster: 'Gale Dancer'
} satisfies Record<SaunojaClass, string>);

export function formatSaunojaClassName(klass: SaunojaClass): string {
  return SAUNOJA_CLASS_DISPLAY_NAMES[klass] ?? klass;
}
