export const POS = [
  'Resolute Sauna Guardian',
  'Steam Scholar',
  'Frost-Hardened',
  'Loyal Watchbearer',
  'Aura Whisperer',
  'Shield Brother',
  'Stonefooted Scout',
  'Sisu-Forged Veteran',
  'Brewmaster Quartermaster',
  'Icebreaker Herald',
  'Runic Tactician',
  'Torchbearer'
] as const;

export const NEG = [
  'Heat Fickle',
  'Soot Allergic',
  'Slow to Spark',
  'Overconfident',
  'Distracted Dreamer',
  'Stubborn Stoker',
  'Thirsty Between Battles',
  'Clumsy Footwork',
  'Rust-Prone Gear',
  'Echo-Lost Listener'
] as const;

type RandomSource = () => number;

function pickUnique(source: readonly string[], count: number, random: RandomSource): string[] {
  const pool = [...source];
  const picked: string[] = [];
  const safeCount = Math.max(0, Math.min(count, pool.length));
  for (let i = 0; i < safeCount; i++) {
    const index = Math.floor(random() * pool.length);
    const [trait] = pool.splice(index, 1);
    if (trait) {
      picked.push(trait);
    }
  }
  return picked;
}

function shuffle<T>(values: T[], random: RandomSource): T[] {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

/**
 * Generate a flavorful collection of Saunoja personality traits.
 * Returns a shuffled mix of positive and negative quirks.
 */
export function generateTraits(random: RandomSource = Math.random): string[] {
  if (typeof random !== 'function') {
    random = Math.random;
  }
  const positives = pickUnique(POS, 2, random);
  const negatives = pickUnique(NEG, 1, random);
  const traits = [...positives, ...negatives];
  return shuffle(traits, random)
    .map((trait) => trait.trim())
    .filter((trait) => trait.length > 0);
}
