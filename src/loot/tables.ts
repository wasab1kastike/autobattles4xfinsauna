import type { SaunojaItem, SaunojaItemRarity } from '../units/saunoja.ts';

export type LootQuantityRange = {
  readonly min: number;
  readonly max: number;
};

export interface LootBlueprint {
  readonly id: SaunojaItem['id'];
  readonly name: SaunojaItem['name'];
  readonly description?: SaunojaItem['description'];
  readonly icon?: SaunojaItem['icon'];
  readonly rarity: SaunojaItemRarity;
  readonly quantity?: number | LootQuantityRange;
  readonly weight?: number;
}

export interface LootTable {
  readonly id: string;
  readonly label: string;
  readonly entries: readonly LootBlueprint[];
}

export interface FactionLootTables {
  readonly base: LootTable;
  readonly elite?: LootTable;
}

export const RARITY_WEIGHT_MULTIPLIER: Record<SaunojaItemRarity, number> = Object.freeze({
  common: 1,
  uncommon: 0.6,
  rare: 0.35,
  epic: 0.18,
  legendary: 0.08,
  mythic: 0.03
});

const DEFAULT_LOOT_TABLE: LootTable = Object.freeze({
  id: 'general-salvage',
  label: 'General Salvage',
  entries: Object.freeze([
    {
      id: 'birch-sap-satchel',
      name: 'Birch Sap Satchel',
      description: 'Soothing birch sap that doubles as a brisk field tonic.',
      rarity: 'common',
      quantity: { min: 1, max: 3 },
      weight: 6
    },
    {
      id: 'steamed-bandages',
      name: 'Steamed Linen Bandages',
      description: 'Freshly steamed bandages infused with pine oils.',
      rarity: 'common',
      quantity: 1,
      weight: 5
    },
    {
      id: 'emberglass-shard',
      name: 'Emberglass Shard',
      description: 'A radiant shard used to kindle sauna braziers.',
      rarity: 'uncommon',
      quantity: 1,
      weight: 3
    },
    {
      id: 'aurora-distillate',
      name: 'Aurora Distillate',
      description: 'Vials of shimmering condensation that empower sauna rituals.',
      rarity: 'rare',
      quantity: 1,
      weight: 1.5
    },
    {
      id: 'myrsky-charm',
      name: 'Myrsky Charm',
      description: 'Storm-forged charm rumored to call down aurora flares.',
      rarity: 'epic',
      quantity: 1,
      weight: 0.7
    }
  ])
});

const ENEMY_LOOT: FactionLootTables = Object.freeze({
  base: Object.freeze({
    id: 'enemy-raiders',
    label: 'Avanto Marauder Spoils',
    entries: Object.freeze([
      {
        id: 'cracked-ice-amulet',
        name: 'Cracked Ice Amulet',
        description: 'Necklace of frostbitten charms that hum when danger nears.',
        rarity: 'common',
        quantity: 1,
        weight: 5
      },
      {
        id: 'stolen-sauna-tokens',
        name: 'Stolen Sauna Tokens',
        description: 'Pilfered entrance tokens, gladly accepted back at any sauna hall.',
        rarity: 'uncommon',
        quantity: { min: 2, max: 5 },
        weight: 3
      },
      {
        id: 'glacier-brand',
        name: 'Glacier Brand',
        description: 'A cleaver chilled in glacial meltwater that never dulls.',
        rarity: 'rare',
        quantity: 1,
        weight: 1.25
      }
    ])
  }),
  elite: Object.freeze({
    id: 'enemy-champions',
    label: 'Avanto Champion Cache',
    entries: Object.freeze([
      {
        id: 'frostwyrm-signet',
        name: 'Frostwyrm Signet',
        description: 'An icy signet ring that wreathes its bearer in frozen vapour.',
        rarity: 'epic',
        quantity: 1,
        weight: 1.1
      },
      {
        id: 'aurora-lattice',
        name: 'Aurora Lattice',
        description: 'Filigree latticework that channels auroral light into focused beams.',
        rarity: 'legendary',
        quantity: 1,
        weight: 0.4
      },
      {
        id: 'midnight-bloodwine',
        name: 'Midnight Bloodwine',
        description: 'A mythical draught said to rekindle a warrior\'s lost resolve.',
        rarity: 'mythic',
        quantity: 1,
        weight: 0.12
      }
    ])
  })
});

const DEEPWOOD_LOOT: FactionLootTables = Object.freeze({
  base: Object.freeze({
    id: 'deepwood-offerings',
    label: 'Deepwood Offerings',
    entries: Object.freeze([
      {
        id: 'spirit-oak-charm',
        name: 'Spirit Oak Charm',
        description: 'Carved from living oak, it whispers guidance between sauna rounds.',
        rarity: 'uncommon',
        quantity: 1,
        weight: 4
      },
      {
        id: 'sauna-incense',
        name: 'Sauna Incense Pouches',
        description: 'Fragrant blends that steady breathing before the next engagement.',
        rarity: 'common',
        quantity: { min: 1, max: 4 },
        weight: 5
      },
      {
        id: 'emberglass-arrow',
        name: 'Emberglass Arrow Bundle',
        description: 'Arrowheads that glow amber when a perfect shot reveals itself.',
        rarity: 'rare',
        quantity: { min: 1, max: 2 },
        weight: 1.75
      }
    ])
  }),
  elite: Object.freeze({
    id: 'deepwood-ritual-cache',
    label: 'Deepwood Ritual Cache',
    entries: Object.freeze([
      {
        id: 'windstep-totem',
        name: 'Windstep Totem',
        description: 'Totem etched with gale sigils that lighten every cautious stride.',
        rarity: 'epic',
        quantity: 1,
        weight: 0.9
      },
      {
        id: 'searing-chant-censer',
        name: 'Searing Chant Censer',
        description: 'An ornate censer that empowers allies with smouldering hymns.',
        rarity: 'legendary',
        quantity: 1,
        weight: 0.35
      }
    ])
  })
});

const FACTION_TABLES: Record<string, FactionLootTables> = Object.freeze({
  enemy: ENEMY_LOOT,
  deepwood: DEEPWOOD_LOOT
});

export function listFactionLootTables(): ReadonlyMap<string, FactionLootTables> {
  return new Map(Object.entries(FACTION_TABLES));
}

export function getFactionLootTables(factionId: string): FactionLootTables {
  return FACTION_TABLES[factionId] ?? { base: DEFAULT_LOOT_TABLE };
}

export function getLootTableForFaction(factionId: string, elite = false): LootTable {
  const tables = getFactionLootTables(factionId);
  if (elite && tables.elite) {
    return tables.elite;
  }
  return tables.base;
}

export function getLootEntries(factionId: string, elite = false): readonly LootBlueprint[] {
  return getLootTableForFaction(factionId, elite).entries;
}

export function isEliteTableAvailable(factionId: string): boolean {
  return Boolean(getFactionLootTables(factionId).elite);
}

export function getLootTableById(tableId: string): LootTable | null {
  const normalized = tableId?.trim();
  if (!normalized) {
    return null;
  }
  if (DEFAULT_LOOT_TABLE.id === normalized) {
    return DEFAULT_LOOT_TABLE;
  }
  for (const tables of Object.values(FACTION_TABLES)) {
    if (tables.base.id === normalized) {
      return tables.base;
    }
    if (tables.elite?.id === normalized) {
      return tables.elite;
    }
  }
  return null;
}
