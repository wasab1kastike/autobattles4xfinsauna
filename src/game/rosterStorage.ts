import type { Saunoja, SaunojaItem } from '../units/saunoja.ts';
import { makeSaunoja } from '../units/saunoja.ts';
import { EQUIPMENT_SLOT_IDS } from '../items/types.ts';

export const SAUNOJA_STORAGE_KEY = 'autobattles:saunojas';

export function getSaunojaStorage(): Storage | null {
  try {
    const globalWithStorage = globalThis as typeof globalThis & { localStorage?: Storage };
    return globalWithStorage.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadUnits(): Saunoja[] {
  const storage = getSaunojaStorage();
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(SAUNOJA_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const restored: Saunoja[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const data = entry as Record<string, unknown>;
      const idValue = data.id;
      if (typeof idValue !== 'string' || idValue.length === 0) continue;

      const coordSource = data.coord as { q?: unknown; r?: unknown } | undefined;
      const coord =
        coordSource &&
        typeof coordSource === 'object' &&
        typeof coordSource.q === 'number' &&
        Number.isFinite(coordSource.q) &&
        typeof coordSource.r === 'number' &&
        Number.isFinite(coordSource.r)
          ? { q: coordSource.q, r: coordSource.r }
          : undefined;

      const traitsSource = data.traits;
      const traits = Array.isArray(traitsSource)
        ? traitsSource.filter((trait): trait is string => typeof trait === 'string')
        : undefined;

      const upkeepValue = typeof data.upkeep === 'number' ? data.upkeep : undefined;
      const xpValue = typeof data.xp === 'number' ? data.xp : undefined;

      restored.push(
        makeSaunoja({
          id: idValue,
          name: typeof data.name === 'string' ? data.name : undefined,
          appearanceId: data.appearanceId,
          coord,
          maxHp: typeof data.maxHp === 'number' ? data.maxHp : undefined,
          hp: typeof data.hp === 'number' ? data.hp : undefined,
          steam: typeof data.steam === 'number' ? data.steam : undefined,
          behavior: data.behavior,
          traits,
          upkeep: upkeepValue,
          xp: xpValue,
          selected: Boolean(data.selected),
          items: Array.isArray(data.items) ? data.items : undefined,
          baseStats: data.baseStats,
          effectiveStats: data.effectiveStats,
          equipment: data.equipment,
          modifiers: Array.isArray(data.modifiers) ? data.modifiers : undefined,
          klass: data.klass,
          damageDealtMultiplier:
            typeof data.damageDealtMultiplier === 'number'
              ? data.damageDealtMultiplier
              : undefined,
          damageTakenMultiplier:
            typeof data.damageTakenMultiplier === 'number'
              ? data.damageTakenMultiplier
              : undefined,
          arcaneNovaRadius:
            typeof data.arcaneNovaRadius === 'number' ? data.arcaneNovaRadius : undefined,
          arcaneNovaMultiplier:
            typeof data.arcaneNovaMultiplier === 'number'
              ? data.arcaneNovaMultiplier
              : undefined,
          tauntActive: typeof data.tauntActive === 'boolean' ? data.tauntActive : undefined
        })
      );
    }

    return restored;
  } catch (error) {
    console.warn('Failed to load Saunoja units from storage', error);
    return [];
  }
}

export function saveUnits(units: readonly Saunoja[]): void {
  const storage = getSaunojaStorage();
  if (!storage) {
    return;
  }

  try {
    const payload = units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      coord: { q: unit.coord.q, r: unit.coord.r },
      appearanceId: unit.appearanceId,
      maxHp: unit.maxHp,
      hp: unit.hp,
      steam: unit.steam,
      behavior: unit.behavior,
      traits: [...unit.traits],
      upkeep: unit.upkeep,
      xp: unit.xp,
      selected: unit.selected,
      ...(unit.klass ? { klass: unit.klass } : {}),
      ...(typeof unit.damageDealtMultiplier === 'number'
        ? { damageDealtMultiplier: unit.damageDealtMultiplier }
        : {}),
      ...(typeof unit.damageTakenMultiplier === 'number'
        ? { damageTakenMultiplier: unit.damageTakenMultiplier }
        : {}),
      ...(typeof unit.arcaneNovaRadius === 'number'
        ? { arcaneNovaRadius: unit.arcaneNovaRadius }
        : {}),
      ...(typeof unit.arcaneNovaMultiplier === 'number'
        ? { arcaneNovaMultiplier: unit.arcaneNovaMultiplier }
        : {}),
      tauntActive: Boolean(unit.tauntActive),
      baseStats: {
        health: unit.baseStats.health,
        attackDamage: unit.baseStats.attackDamage,
        attackRange: unit.baseStats.attackRange,
        movementRange: unit.baseStats.movementRange,
        ...(typeof unit.baseStats.defense === 'number' && Number.isFinite(unit.baseStats.defense)
          ? { defense: unit.baseStats.defense }
          : {}),
        ...(typeof unit.baseStats.shield === 'number' && Number.isFinite(unit.baseStats.shield)
          ? { shield: unit.baseStats.shield }
          : {}),
        ...(typeof unit.baseStats.visionRange === 'number' && Number.isFinite(unit.baseStats.visionRange)
          ? { visionRange: unit.baseStats.visionRange }
          : {})
      },
      effectiveStats: {
        health: unit.effectiveStats.health,
        attackDamage: unit.effectiveStats.attackDamage,
        attackRange: unit.effectiveStats.attackRange,
        movementRange: unit.effectiveStats.movementRange,
        ...(typeof unit.effectiveStats.defense === 'number' && Number.isFinite(unit.effectiveStats.defense)
          ? { defense: unit.effectiveStats.defense }
          : {}),
        ...(typeof unit.effectiveStats.shield === 'number' && Number.isFinite(unit.effectiveStats.shield)
          ? { shield: unit.effectiveStats.shield }
          : {}),
        ...(typeof unit.effectiveStats.visionRange === 'number' &&
        Number.isFinite(unit.effectiveStats.visionRange)
          ? { visionRange: unit.effectiveStats.visionRange }
          : {})
      },
      equipment: EQUIPMENT_SLOT_IDS.reduce<Record<string, unknown>>((acc, slot) => {
        const equipped = unit.equipment?.[slot] ?? null;
        acc[slot] = equipped
          ? {
              id: equipped.id,
              name: equipped.name,
              description: equipped.description,
              icon: equipped.icon,
              rarity: equipped.rarity,
              quantity: equipped.quantity,
              slot: equipped.slot
            }
          : null;
        return acc;
      }, {}),
      items: unit.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        icon: item.icon,
        rarity: item.rarity,
        quantity: item.quantity
      })),
      modifiers: unit.modifiers.map((modifier) => ({
        id: modifier.id,
        name: modifier.name,
        description: modifier.description,
        remaining: modifier.remaining,
        duration: modifier.duration,
        appliedAt: modifier.appliedAt,
        stacks: modifier.stacks,
        source: modifier.source
      }))
    }));
    storage.setItem(SAUNOJA_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to persist Saunoja units', error);
  }
}

export function persistRosterSelection(
  units: readonly Saunoja[],
  selectedUnitId: string | null,
  options: { keepItems?: readonly SaunojaItem[] } = {}
): void {
  const storage = getSaunojaStorage();
  if (!storage) {
    return;
  }

  if (!selectedUnitId) {
    try {
      storage.removeItem(SAUNOJA_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear Saunoja roster selection', error);
    }
    return;
  }

  const selected = units.find((unit) => unit.id === selectedUnitId);
  if (!selected) {
    try {
      storage.removeItem(SAUNOJA_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear Saunoja roster selection', error);
    }
    return;
  }

  const existingItems = new Map<string, SaunojaItem>();
  for (const item of selected.items) {
    if (typeof item?.id === 'string' && item.id.length > 0 && !existingItems.has(item.id)) {
      existingItems.set(item.id, item);
    }
  }

  const sanitizedItems: SaunojaItem[] = [];
  const seenIds = new Set<string>();
  for (const candidate of options.keepItems ?? []) {
    if (!candidate) {
      continue;
    }
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    if (!id || seenIds.has(id)) {
      continue;
    }
    const source = existingItems.get(id) ?? candidate;
    const nameSource =
      typeof source.name === 'string' && source.name.trim().length > 0
        ? source.name.trim()
        : typeof candidate.name === 'string'
          ? candidate.name.trim()
          : '';
    if (!nameSource) {
      continue;
    }
    const description =
      typeof source.description === 'string' ? source.description : candidate.description;
    const icon = typeof source.icon === 'string' ? source.icon : candidate.icon;
    const rarity = typeof source.rarity === 'string' ? source.rarity : candidate.rarity;
    const attackAnimation =
      typeof source.attackAnimation === 'string' && source.attackAnimation.trim().length > 0
        ? source.attackAnimation.trim()
        : typeof candidate.attackAnimation === 'string' && candidate.attackAnimation.trim().length > 0
          ? candidate.attackAnimation.trim()
          : undefined;
    const quantitySource = Number.isFinite((source as SaunojaItem).quantity)
      ? (source as SaunojaItem).quantity
      : candidate.quantity;
    const quantity = Number.isFinite(quantitySource)
      ? Math.max(1, Math.round(quantitySource as number))
      : 1;

    sanitizedItems.push({
      id,
      name: nameSource,
      description: typeof description === 'string' ? description : undefined,
      icon: typeof icon === 'string' ? icon : undefined,
      attackAnimation,
      rarity: typeof rarity === 'string' ? rarity : undefined,
      quantity
    });
    seenIds.add(id);
    if (sanitizedItems.length >= 3) {
      break;
    }
  }

  const keepQuantities = new Map<string, number>();
  for (const item of sanitizedItems) {
    keepQuantities.set(item.id, item.quantity);
  }

  selected.items = sanitizedItems.map((item) => ({ ...item }));

  if (selected.equipment) {
    for (const slot of EQUIPMENT_SLOT_IDS) {
      const equipped = selected.equipment[slot];
      if (!equipped || typeof equipped !== 'object') {
        selected.equipment[slot] = null;
        continue;
      }
      const quantity = keepQuantities.get(equipped.id);
      if (!quantity) {
        selected.equipment[slot] = null;
        continue;
      }
      selected.equipment[slot] = {
        ...equipped,
        quantity
      };
    }
  }

  saveUnits([
    {
      ...selected,
      selected: true,
      items: sanitizedItems
    }
  ]);
}
