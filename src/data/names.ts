const GIVEN_NAMES = [
  'Aino',
  'Eero',
  'Ilona',
  'Kalevi',
  'Maija',
  'Sami',
  'Noora',
  'Tuomas',
  'Veera',
  'Lauri',
  'Sanna',
  'Tapio',
  'Eira',
  'Janne',
  'Kaisa',
  'Oskari',
  'Riikka',
  'Saara',
  'Ville',
  'Arvo',
  'Helmi',
  'Juhani',
  'Lumi',
  'Mika',
  'Otso',
  'Petra',
  'Taimi',
  'Ukko',
  'Väinö'
] as const;

const CLAN_NAMES = [
  'Aurinkiranta',
  'Frostwarden',
  'Havukoski',
  'Järvituuli',
  'Karhula',
  'Korventie',
  'Kuusimäki',
  'Löylymäki',
  'Metsämaa',
  'Niemelä',
  'Revontuli',
  'Saunamaa',
  'Silakkala',
  'Sisalintu',
  'Suomenvirta',
  'Talvilinna',
  'Ukonaho',
  'Vesiluoto',
  'Virtaniemi',
  'Yrttipelto'
] as const;

const EPITHETS = [
  'the Ember-Tender',
  'the Frost-Forged',
  'the Löyly Keeper',
  'the Steam-Seeker',
  'the Sauna Sage',
  'the Sisu-Bound',
  'the Birchbinder',
  'the Icebreaker',
  'the Stonebather',
  'the Hearth-Warden'
] as const;

function pick<T>(values: readonly T[], random: () => number): T | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const index = Math.floor(random() * values.length);
  return values[Math.max(0, Math.min(values.length - 1, index))];
}

function combineName(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function generateSaunojaName(random: () => number = Math.random): string {
  if (typeof random !== 'function') {
    random = Math.random;
  }

  const given = pick(GIVEN_NAMES, random) ?? '';
  const clan = pick(CLAN_NAMES, random) ?? '';
  const useEpithet = random() > 0.6;
  const epithet = useEpithet ? pick(EPITHETS, random) ?? '' : '';

  const name = combineName([given, clan, epithet]);
  return name.length > 0 ? name : 'Saunoja';
}

export function __testables() {
  return { GIVEN_NAMES, CLAN_NAMES, EPITHETS, pick, combineName };
}
