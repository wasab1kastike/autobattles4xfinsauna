const GIVEN_NAMES = [
  'Aino',
  'Eero',
  'Ilona',
  'Kalevi',
  'Lumi',
  'Mika',
  'Noora',
  'Oskari',
  'Saana',
  'Tapio',
  'Veera',
  'Yrjö'
] as const;

const HONORIFICS = [
  'Emberguard',
  'Frostwalker',
  'Steamcaller',
  'Dawnwatch',
  'Gritforged',
  'Stormchant',
  'Snowborn',
  'Torchbearer',
  'Chillwarden',
  'Sisuheart'
] as const;

const FAMILY_NAMES = [
  'Aalto',
  'Halla',
  'Karhu',
  'Korhonen',
  'Laine',
  'Metsä',
  'Niemi',
  'Salmi',
  'Tuomi',
  'Virta'
] as const;

function pick<T>(values: readonly T[], random: () => number): T {
  if (values.length === 0) {
    throw new Error('Cannot select a name from an empty collection.');
  }
  const index = Math.floor(random() * values.length);
  return values[Math.min(index, values.length - 1)];
}

/**
 * Generate a flavorful Saunoja name composed of a given name, heroic epithet,
 * and family name. The structure mirrors the heroic tone of the HUD copy while
 * keeping pronunciation approachable.
 */
export function generateSaunojaName(random: () => number = Math.random): string {
  const first = pick(GIVEN_NAMES, random);
  const honorific = pick(HONORIFICS, random);
  const family = pick(FAMILY_NAMES, random);
  return `${first} "${honorific}" ${family}`;
}

export { GIVEN_NAMES, HONORIFICS, FAMILY_NAMES };
