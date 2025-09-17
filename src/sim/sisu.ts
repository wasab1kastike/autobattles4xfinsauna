import type { AxialCoord } from '../hex/HexUtils.ts';
import type { GameState } from '../core/GameState.ts';
import { Resource } from '../core/GameState.ts';
import type { HexMap } from '../hexmap.ts';
import type { Unit } from '../units/Unit.ts';
import { pickFreeTileAround } from './sauna.ts';
import { eventBus } from '../events';

const SISU_BURST_DURATION_SECONDS = 10;
const SISU_BURST_ATTACK_MULTIPLIER = 1.25;
const SISU_BURST_MOVEMENT_MULTIPLIER = 1.5;
const TORILLE_HEAL_RATIO = 0.6;

export const SISU_BURST_COST = 5;
export const TORILLE_COST = 3;

type BurstState = {
  endTime: number;
  affected: Array<{ unit: Unit; attack: number; movement: number }>;
  tickTimer: ReturnType<typeof setInterval> | null;
  timeout: ReturnType<typeof setTimeout> | null;
};

let burstState: BurstState | null = null;

function clearBurstState(): void {
  if (!burstState) {
    return;
  }
  if (burstState.tickTimer) {
    clearInterval(burstState.tickTimer);
  }
  if (burstState.timeout) {
    clearTimeout(burstState.timeout);
  }
  burstState = null;
}

export function isSisuBurstActive(): boolean {
  return burstState !== null;
}

export function getSisuBurstRemaining(): number {
  if (!burstState) {
    return 0;
  }
  const remainingMs = Math.max(0, burstState.endTime - performance.now());
  return remainingMs / 1000;
}

export function useSisuBurst(state: GameState, units: Unit[]): boolean {
  if (isSisuBurstActive()) {
    return false;
  }
  if (!state.spendResource(SISU_BURST_COST, Resource.SISU)) {
    return false;
  }

  const affected: BurstState['affected'] = [];
  for (const unit of units) {
    if (unit.faction !== 'player' || unit.isDead()) {
      continue;
    }
    affected.push({
      unit,
      attack: unit.stats.attackDamage,
      movement: unit.stats.movementRange
    });
    unit.stats.attackDamage = Math.round(unit.stats.attackDamage * SISU_BURST_ATTACK_MULTIPLIER);
    unit.stats.movementRange = Math.max(
      1,
      Math.round(unit.stats.movementRange * SISU_BURST_MOVEMENT_MULTIPLIER)
    );
    (unit as Record<string, unknown>).fearless = true;
  }

  const endTime = performance.now() + SISU_BURST_DURATION_SECONDS * 1000;
  burstState = {
    endTime,
    affected,
    tickTimer: null,
    timeout: null
  };

  eventBus.emit('sisuBurstStart', { remaining: SISU_BURST_DURATION_SECONDS });

  burstState.tickTimer = setInterval(() => {
    if (!burstState) {
      return;
    }
    const remaining = Math.max(0, Math.ceil(getSisuBurstRemaining()));
    if (remaining > 0) {
      eventBus.emit('sisuBurstTick', { remaining });
    }
  }, 1000);

  burstState.timeout = setTimeout(() => {
    endSisuBurst();
  }, SISU_BURST_DURATION_SECONDS * 1000);

  return true;
}

export function endSisuBurst(): void {
  if (!burstState) {
    return;
  }

  for (const entry of burstState.affected) {
    entry.unit.stats.attackDamage = entry.attack;
    entry.unit.stats.movementRange = entry.movement;
    delete (entry.unit as Record<string, unknown>).fearless;
  }

  clearBurstState();
  eventBus.emit('sisuBurstEnd', {});
}

export function torille(
  state: GameState,
  units: Unit[],
  saunaPos: AxialCoord,
  map: HexMap
): boolean {
  const living = units.filter((unit) => unit.faction === 'player' && !unit.isDead());
  if (living.length === 0) {
    return false;
  }
  if (!state.spendResource(TORILLE_COST, Resource.SISU)) {
    return false;
  }

  for (const unit of living) {
    const target = pickFreeTileAround(saunaPos, 3, units) ?? { ...saunaPos };
    unit.coord = target;
    const healAmount = Math.round(unit.getMaxHealth() * TORILLE_HEAL_RATIO);
    unit.stats.health = Math.min(unit.getMaxHealth(), Math.max(unit.stats.health, healAmount));
  }

  map.revealAround(saunaPos, 3);
  eventBus.emit('torilleRecalled', { count: living.length });
  return true;
}
