import { getGameRuntime } from '../runtime/index.ts';
import { EQUIPMENT_SLOT_IDS, type EquipmentModifier } from '../../items/types.ts';
import { getSlotDefinition } from '../../items/equip.ts';
import type { RosterEntry, RosterStats } from '../../ui/panels/RosterPanel.tsx';
import type { RosterHudSummary, RosterCardViewModel } from '../../ui/rosterHUD.ts';
import type { Saunoja, SaunojaClass } from '../../units/saunoja.ts';
import type { Unit } from '../../unit/index.ts';
import type { UnitBehavior } from '../../unit/types.ts';
import { getLevelProgress, getTotalStatAwards } from '../../progression/experiencePlan.ts';
import type { RosterPersonaBaseline } from '../runtime/rosterService.ts';
import type { GameRuntime } from '../runtime/GameRuntime.ts';

type RosterSummaryListener = (summary: RosterHudSummary) => void;
type RosterEntriesListener = (entries: RosterEntry[]) => void;

type RosterOrchestratorDependencies = {
  getUnitById(unitId: string): Unit | undefined;
  getAttachedUnitFor(attendant: Saunoja): Unit | null;
  getActiveRosterCount(): number;
  syncSelectionOverlay(): void;
  promote(attendant: Saunoja, klass: SaunojaClass): boolean;
};

let orchestratorDeps: RosterOrchestratorDependencies | null = null;

function requireDeps(): RosterOrchestratorDependencies {
  if (!orchestratorDeps) {
    throw new Error('Roster orchestrator has not been configured.');
  }
  return orchestratorDeps;
}

export function configureRosterOrchestrator(deps: RosterOrchestratorDependencies): void {
  orchestratorDeps = deps;
}

export function promoteSaunoja(unitId: string, klass: SaunojaClass): boolean {
  const attendant =
    saunojas.find((unit) => unit.id === unitId) ?? unitToSaunoja.get(unitId) ?? null;
  if (!attendant) {
    return false;
  }
  return requireDeps().promote(attendant, klass);
}

export const saunojas: Saunoja[] = [];
export const unitToSaunoja = new Map<string, Saunoja>();
export const saunojaToUnit = new Map<string, string>();
export type SaunojaPolicyBaseline = RosterPersonaBaseline;
export const saunojaPolicyBaselines = new WeakMap<Saunoja, SaunojaPolicyBaseline>();

const rosterSummaryListeners = new Set<RosterSummaryListener>();
const rosterEntriesListeners = new Set<RosterEntriesListener>();
let localLastRosterSummary: RosterHudSummary | null = null;
let localLastRosterEntries: RosterEntry[] = [];

function tryGetRuntime(): GameRuntime | null {
  try {
    return getGameRuntime();
  } catch (error) {
    if (error instanceof Error && error.message.includes('not been configured')) {
      return null;
    }
    throw error;
  }
}

function notifyRosterSummary(summary: RosterHudSummary): void {
  localLastRosterSummary = summary;
  const runtime = tryGetRuntime();
  runtime?.setLastRosterSummary(summary);
  for (const listener of rosterSummaryListeners) {
    try {
      listener(summary);
    } catch (error) {
      console.warn('Failed to notify roster summary listener', error);
    }
  }
}

function notifyRosterEntries(entries: RosterEntry[]): void {
  localLastRosterEntries = entries;
  const runtime = tryGetRuntime();
  runtime?.setLastRosterEntries(entries);
  for (const listener of rosterEntriesListeners) {
    try {
      listener(entries);
    } catch (error) {
      console.warn('Failed to notify roster entries listener', error);
    }
  }
}

function scaleModifiers(modifiers: EquipmentModifier, quantity: number): EquipmentModifier {
  const stacks = Math.max(1, Math.round(quantity));
  const scaled: EquipmentModifier = {};
  if (typeof modifiers.health === 'number') {
    scaled.health = modifiers.health * stacks;
  }
  if (typeof modifiers.attackDamage === 'number') {
    scaled.attackDamage = modifiers.attackDamage * stacks;
  }
  if (typeof modifiers.attackRange === 'number') {
    scaled.attackRange = modifiers.attackRange * stacks;
  }
  if (typeof modifiers.movementRange === 'number') {
    scaled.movementRange = modifiers.movementRange * stacks;
  }
  if (typeof modifiers.defense === 'number') {
    scaled.defense = modifiers.defense * stacks;
  }
  if (typeof modifiers.shield === 'number') {
    scaled.shield = modifiers.shield * stacks;
  }
  return scaled;
}

export function buildProgression(attendant: Saunoja): RosterEntry['progression'] {
  const progress = getLevelProgress(attendant.xp);
  return {
    level: progress.level,
    xp: Math.max(0, Math.floor(attendant.xp)),
    xpIntoLevel: progress.xpIntoLevel,
    xpForNext: progress.xpForNext,
    progress: progress.progressToNext,
    statBonuses: getTotalStatAwards(progress.level),
    klass: attendant.klass ?? null
  } satisfies RosterEntry['progression'];
}

export function buildRosterEntries(): RosterEntry[] {
  const deps = requireDeps();
  const statusRank: Record<RosterEntry['status'], number> = {
    engaged: 0,
    reserve: 1,
    downed: 2
  };

  const entries = saunojas.map((attendant) => {
    const attachedUnitId = saunojaToUnit.get(attendant.id);
    const fallbackUnit = deps.getAttachedUnitFor(attendant);
    const unit = attachedUnitId
      ? deps.getUnitById(attachedUnitId) ?? fallbackUnit ?? undefined
      : fallbackUnit ?? undefined;
    const unitAlive = unit ? !unit.isDead() && unit.stats.health > 0 : false;

    const effectiveStats = attendant.effectiveStats;
    const baseStats = attendant.baseStats;
    const currentHealth = unit
      ? Math.round(Math.max(0, unit.stats.health))
      : Math.round(Math.max(0, attendant.hp));
    const maxHealth = unit
      ? Math.round(Math.max(1, unit.getMaxHealth()))
      : Math.round(Math.max(1, effectiveStats.health));
    const attackDamage = unit
      ? Math.round(Math.max(0, unit.stats.attackDamage))
      : Math.round(Math.max(0, effectiveStats.attackDamage));
    const attackRange = unit
      ? Math.round(Math.max(0, unit.stats.attackRange))
      : Math.round(Math.max(0, effectiveStats.attackRange));
    const movementRange = unit
      ? Math.round(Math.max(0, unit.stats.movementRange))
      : Math.round(Math.max(0, effectiveStats.movementRange));
    const defenseSource = unit?.stats.defense ?? effectiveStats.defense ?? 0;
    const defense = Math.round(Math.max(0, defenseSource));
    const shieldSource = unit ? unit.getShield() : effectiveStats.shield ?? attendant.shield;
    const shield = Math.round(Math.max(0, shieldSource));
    const upkeep = Math.max(0, Math.round(attendant.upkeep));
    const status: RosterEntry['status'] =
      currentHealth <= 0 ? 'downed' : unitAlive ? 'engaged' : 'reserve';

    const progression = buildProgression(attendant);

    const items = attendant.items.map((item) => ({ ...item }));
    const modifiers = attendant.modifiers.map((modifier) => ({ ...modifier }));

    const equipmentSlots = EQUIPMENT_SLOT_IDS.map((slotId) => {
      const slotDefinition = getSlotDefinition(slotId);
      const equipped = attendant.equipment[slotId];
      const rosterItem = equipped
        ? {
            id: equipped.id,
            name: equipped.name,
            description: equipped.description,
            icon: equipped.icon,
            rarity: equipped.rarity,
            quantity: equipped.quantity,
            slot: slotId
          }
        : null;
      const aggregated = equipped ? scaleModifiers(equipped.modifiers, equipped.quantity) : null;
      return {
        id: slotId,
        label: slotDefinition.label,
        description: slotDefinition.description,
        maxStacks: slotDefinition.maxStacks,
        item: rosterItem,
        modifiers: aggregated
      };
    });

    const rosterBase: RosterStats = {
      health: Math.round(Math.max(0, baseStats.health)),
      maxHealth: Math.round(Math.max(1, baseStats.health)),
      attackDamage: Math.round(Math.max(0, baseStats.attackDamage)),
      attackRange: Math.round(Math.max(0, baseStats.attackRange)),
      movementRange: Math.round(Math.max(0, baseStats.movementRange)),
      defense:
        typeof baseStats.defense === 'number' && baseStats.defense > 0
          ? Math.round(baseStats.defense)
          : undefined,
      shield:
        typeof baseStats.shield === 'number' && baseStats.shield > 0
          ? Math.round(baseStats.shield)
          : undefined
    } satisfies RosterStats;

    const behavior: UnitBehavior = attendant.behavior ?? 'defend';
    const damageTakenMultiplier =
      typeof attendant.damageTakenMultiplier === 'number'
        ? Math.max(0, attendant.damageTakenMultiplier)
        : undefined;
    const tauntActive = Boolean(attendant.tauntActive && attendant.klass === 'tank');

    return {
      id: attendant.id,
      name: attendant.name,
      upkeep,
      status,
      selected: Boolean(attendant.selected),
      behavior,
      traits: [...attendant.traits],
      stats: {
        health: currentHealth,
        maxHealth,
        attackDamage,
        attackRange,
        movementRange,
        defense: defense > 0 ? defense : undefined,
        shield: shield > 0 ? shield : undefined
      },
      baseStats: rosterBase,
      progression,
      equipment: equipmentSlots,
      items,
      modifiers,
      klass: attendant.klass ?? null,
      ...(damageTakenMultiplier !== undefined
        ? { damageTakenMultiplier }
        : {}),
      ...(tauntActive ? { tauntActive } : { tauntActive: false })
    } satisfies RosterEntry;
  });

  entries.sort((a, b) => {
    const statusDelta = statusRank[a.status] - statusRank[b.status];
    if (statusDelta !== 0) {
      return statusDelta;
    }
    return a.name.localeCompare(b.name, 'en');
  });

  return entries;
}

function pickFeaturedSaunoja(): Saunoja | null {
  if (saunojas.length === 0) {
    return null;
  }
  return (
    saunojas.find((unit) => unit.selected) ??
    saunojas.find((unit) => unit.hp > 0) ??
    saunojas[0]
  );
}

export function buildRosterSummary(): RosterHudSummary {
  const deps = requireDeps();
  const total = deps.getActiveRosterCount();
  const featured = pickFeaturedSaunoja();
  let card: RosterCardViewModel | null = null;
  if (featured) {
    const behavior: UnitBehavior = featured.behavior ?? 'defend';
    card = {
      id: featured.id,
      name: featured.name || 'Saunoja',
      traits: [...featured.traits],
      upkeep: Math.max(0, Math.round(featured.upkeep)),
      progression: buildProgression(featured),
      behavior,
      klass: featured.klass ?? null,
      damageTakenMultiplier:
        typeof featured.damageTakenMultiplier === 'number'
          ? Math.max(0, featured.damageTakenMultiplier)
          : undefined,
      tauntActive: Boolean(featured.tauntActive && featured.klass === 'tank')
    } satisfies RosterCardViewModel;
  }
  return { count: total, card } satisfies RosterHudSummary;
}

export function refreshRosterPanel(entries?: RosterEntry[]): void {
  const view = entries ?? buildRosterEntries();
  const runtime = tryGetRuntime();
  runtime?.setPendingRosterEntries(view);
  notifyRosterEntries(view);
  requireDeps().syncSelectionOverlay();
  const rosterHud = runtime?.getRosterHud();
  if (!rosterHud) {
    return;
  }
  rosterHud.renderRoster(view);
}

export function updateRosterDisplay(): void {
  const summary = buildRosterSummary();
  notifyRosterSummary(summary);
  const runtime = tryGetRuntime();
  const rosterHud = runtime?.getRosterHud();
  if (rosterHud) {
    rosterHud.updateSummary(summary);
    runtime?.setPendingRosterSummary(null);
  } else {
    runtime?.setPendingRosterSummary(summary);
  }
  refreshRosterPanel();
  requireDeps().syncSelectionOverlay();
}

export function getRosterSummarySnapshot(): RosterHudSummary {
  const runtime = tryGetRuntime();
  if (runtime) {
    const lastSummary = runtime.getLastRosterSummary();
    if (lastSummary) {
      return lastSummary;
    }
    const pendingSummary = runtime.getPendingRosterSummary();
    if (pendingSummary) {
      return pendingSummary;
    }
  } else if (localLastRosterSummary) {
    return localLastRosterSummary;
  }
  return buildRosterSummary();
}

export function getRosterEntriesSnapshot(): RosterEntry[] {
  const runtime = tryGetRuntime();
  if (runtime) {
    const cachedEntries = runtime.getLastRosterEntries();
    if (cachedEntries.length > 0) {
      return cachedEntries;
    }
    const pendingEntries = runtime.getPendingRosterEntries();
    if (pendingEntries && pendingEntries.length > 0) {
      return pendingEntries;
    }
  } else if (localLastRosterEntries.length > 0) {
    return localLastRosterEntries;
  }
  return buildRosterEntries();
}

export function subscribeRosterSummary(listener: RosterSummaryListener): () => void {
  rosterSummaryListeners.add(listener);
  try {
    listener(getRosterSummarySnapshot());
  } catch (error) {
    console.warn('Failed to deliver roster summary snapshot', error);
  }
  return () => {
    rosterSummaryListeners.delete(listener);
  };
}

export function subscribeRosterEntries(listener: RosterEntriesListener): () => void {
  rosterEntriesListeners.add(listener);
  try {
    listener(getRosterEntriesSnapshot());
  } catch (error) {
    console.warn('Failed to deliver roster entries snapshot', error);
  }
  return () => {
    rosterEntriesListeners.delete(listener);
  };
}

