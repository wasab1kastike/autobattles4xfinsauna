import type { GameState } from '../core/GameState.ts';
import type { Unit } from '../units/Unit.ts';
import { eventBus } from '../events';

let active = false;
let onCooldown = false;

export function isSisuActive(): boolean {
  return active;
}

export function activateSisuPulse(state: GameState, units: Unit[]): void {
  void state;
  if (active || onCooldown) return;
  active = true;
  onCooldown = true;
  let remaining = 10;
  eventBus.emit('sisuPulseStart', { remaining });

  const affected: { unit: Unit; move: number; attack: number }[] = [];
  for (const u of units) {
    if (u.faction !== 'player' || u.isDead()) continue;
    affected.push({ unit: u, move: u.stats.movementRange, attack: u.stats.attackDamage });
    u.stats.movementRange *= 1.2;
    u.stats.attackDamage *= 1.2;
    (u as any).fearless = true;
  }

  const interval = setInterval(() => {
    remaining -= 1;
    if (remaining > 0) {
      eventBus.emit('sisuPulseTick', { remaining });
      return;
    }
    clearInterval(interval);
    active = false;
    for (const a of affected) {
      a.unit.stats.movementRange = a.move;
      a.unit.stats.attackDamage = a.attack;
      delete (a.unit as any).fearless;
    }
    eventBus.emit('sisuPulseEnd', {});
    setTimeout(() => {
      onCooldown = false;
      eventBus.emit('sisuCooldownEnd', {});
    }, 120_000);
  }, 1_000);
}

