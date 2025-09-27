import type { Unit } from '../unit/index.ts';
import type { UnitFxManager } from '../render/unit_fx.ts';
import type { SelectionItemSlot, SelectionStatusChip, UnitSelectionPayload } from '../ui/fx/types.ts';
import type { Saunoja } from '../units/saunoja.ts';

export interface SelectionContext {
  getAttachedUnitFor(attendant: Saunoja): Unit | null;
  getSelectedSaunoja(): Saunoja | null;
  findSaunojaByAttachedUnitId(unitId: string): Saunoja | null;
  getUnitById(unitId: string): Unit | null;
  describeUnit(unit: Unit, attachedSaunoja?: Saunoja | null): string;
}

export interface SyncSelectionOverlayOptions extends SelectionContext {
  unitFx: UnitFxManager | null;
  selectedUnitId: string | null;
}

export function buildSelectionPayload(
  attendant: Saunoja,
  context: SelectionContext
): UnitSelectionPayload {
  const attachedUnit = context.getAttachedUnitFor(attendant);
  const itemsSource = Array.isArray(attendant.items) ? attendant.items : [];
  const modifiersSource = Array.isArray(attendant.modifiers) ? attendant.modifiers : [];
  const items: SelectionItemSlot[] = itemsSource.map((item, index) => ({
    id: typeof item.id === 'string' && item.id.length > 0 ? item.id : `${attendant.id}-item-${index}`,
    name: item.name?.trim() || 'Artifact',
    icon: item.icon || undefined,
    rarity: item.rarity || undefined,
    quantity:
      Number.isFinite(item.quantity) && item.quantity > 1
        ? Math.max(1, Math.round(item.quantity))
        : undefined
  }));
  const statuses: SelectionStatusChip[] = modifiersSource.map((modifier, index) => ({
    id:
      typeof modifier.id === 'string' && modifier.id.length > 0
        ? modifier.id
        : `modifier-${index}`,
    label: modifier.name?.trim() || modifier.id || 'Status',
    remaining: Number.isFinite(modifier.remaining) ? Math.max(0, modifier.remaining) : Infinity,
    duration: Number.isFinite(modifier.duration) ? Math.max(0, modifier.duration) : Infinity,
    stacks:
      Number.isFinite(modifier.stacks) && (modifier.stacks as number) > 1
        ? Math.max(1, Math.round(modifier.stacks as number))
        : undefined
  }));

  const hpValue = Number.isFinite(attendant.hp) ? Math.max(0, attendant.hp) : 0;
  const maxHpValue = Number.isFinite(attendant.maxHp) ? Math.max(1, attendant.maxHp) : 1;
  const shieldValue = Number.isFinite(attendant.shield) ? Math.max(0, attendant.shield) : 0;
  const coordSource = attachedUnit?.coord ?? attendant.coord;

  return {
    id: attachedUnit?.id ?? attendant.id,
    name: attendant.name?.trim() || 'Saunoja',
    faction: attachedUnit?.faction ?? 'player',
    coord: { q: coordSource.q, r: coordSource.r },
    hp: hpValue,
    maxHp: maxHpValue,
    shield: shieldValue,
    items,
    statuses
  } satisfies UnitSelectionPayload;
}

export function buildSelectionPayloadFromUnit(
  unit: Unit,
  context: SelectionContext
): UnitSelectionPayload {
  const hpValue = Number.isFinite(unit.stats.health) ? Math.max(0, unit.stats.health) : 0;
  const maxHpValue = Number.isFinite(unit.getMaxHealth()) ? Math.max(1, unit.getMaxHealth()) : 1;
  const shieldValue = Number.isFinite(unit.getShield()) ? Math.max(0, unit.getShield()) : 0;
  const attachedSaunoja = context.findSaunojaByAttachedUnitId(unit.id);
  const name = attachedSaunoja?.name?.trim() || context.describeUnit(unit, attachedSaunoja ?? null);
  const faction = typeof unit.faction === 'string' && unit.faction.trim().length > 0
    ? unit.faction
    : 'enemy';
  return {
    id: unit.id,
    name,
    faction,
    coord: { q: unit.coord.q, r: unit.coord.r },
    hp: hpValue,
    maxHp: maxHpValue,
    shield: shieldValue,
    items: [],
    statuses: []
  } satisfies UnitSelectionPayload;
}

export function syncSelectionOverlay(options: SyncSelectionOverlayOptions): string | null {
  const { unitFx } = options;
  if (!unitFx) {
    return options.selectedUnitId ?? null;
  }

  let nextSelectedId: string | null = options.selectedUnitId ?? null;
  let selectionPayload: UnitSelectionPayload | null = null;

  if (nextSelectedId) {
    const attachedSaunoja = options.findSaunojaByAttachedUnitId(nextSelectedId);
    if (attachedSaunoja) {
      selectionPayload = buildSelectionPayload(attachedSaunoja, options);
    } else {
      const unit = options.getUnitById(nextSelectedId);
      if (unit) {
        selectionPayload = buildSelectionPayloadFromUnit(unit, options);
      } else {
        nextSelectedId = null;
      }
    }
  }

  if (!selectionPayload) {
    const selectedSaunoja = options.getSelectedSaunoja();
    if (selectedSaunoja) {
      const attachedUnit = options.getAttachedUnitFor(selectedSaunoja);
      nextSelectedId = attachedUnit?.id ?? selectedSaunoja.id;
      selectionPayload = buildSelectionPayload(selectedSaunoja, options);
    }
  }

  unitFx.setSelection(selectionPayload);
  return nextSelectedId;
}
