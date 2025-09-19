import type { AxialCoord } from '../hex/HexUtils.ts';
import type { GameState } from '../core/GameState.ts';
import { Resource } from '../core/GameState.ts';
import type { HexMap } from '../hexmap.ts';
import type { Unit } from '../units/Unit.ts';
import { pickFreeTileAround } from '../sim/sauna.ts';
import { eventBus } from '../events';
import type { CombatHookPayload } from '../combat/resolve.ts';
import { addModifier, removeModifier } from '../mods/runtime.ts';

const SISU_BURST_DURATION_SECONDS = 10;
const SISU_BURST_ATTACK_MULTIPLIER = 1.5;
const SISU_BURST_MOVEMENT_MULTIPLIER = 1.5;
const SISU_BURST_SHIELD_BONUS = 1;
const TORILLE_HEAL_RATIO = 0.6;
const SISU_BURST_STATUS_MESSAGE = '⚔️ +50% attack · 🛡️ Barrier · ♾️ Immortal';

export const SISU_BURST_COST = 5;
export const TORILLE_COST = 3;

type SisuBurstModifierState = {
  unit: Unit;
  attackDelta: number;
  movementDelta: number;
  shieldBonusApplied: number;
  shieldBonusRemaining: number;
  wasImmortal: boolean;
};

type BurstState = {
  endTime: number;
  status: string;
  affected: Array<{ unit: Unit; modifierId: string; state: SisuBurstModifierState }>;
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
    const modifierId = `sisu-burst-${unit.id}`;
    const state: SisuBurstModifierState = {
      unit,
      attackDelta: 0,
      movementDelta: 0,
      shieldBonusApplied: SISU_BURST_SHIELD_BONUS,
      shieldBonusRemaining: SISU_BURST_SHIELD_BONUS,
      wasImmortal: unit.isImmortal()
    };

    addModifier({
      id: modifierId,
      duration: SISU_BURST_DURATION_SECONDS,
      data: state,
      onApply: () => {
        const attackBefore = unit.stats.attackDamage;
        const attackAfter = Math.round(
          attackBefore * SISU_BURST_ATTACK_MULTIPLIER
        );
        state.attackDelta = Math.max(0, attackAfter - attackBefore);
        if (state.attackDelta !== 0) {
          unit.stats.attackDamage = attackBefore + state.attackDelta;
        }

        const movementBefore = unit.stats.movementRange;
        const movementAfter = Math.max(
          1,
          Math.round(movementBefore * SISU_BURST_MOVEMENT_MULTIPLIER)
        );
        state.movementDelta = Math.max(0, movementAfter - movementBefore);
        if (state.movementDelta !== 0) {
          unit.stats.movementRange = movementBefore + state.movementDelta;
        }

        state.shieldBonusRemaining = state.shieldBonusApplied;
        unit.setShield(unit.getShield() + state.shieldBonusApplied);
        unit.setImmortal(true);
        (unit as Record<string, unknown>).fearless = true;
      },
      onExpire: () => {
        let statsChanged = false;

        if (state.attackDelta !== 0) {
          const currentAttack = unit.stats.attackDamage;
          const nextAttack = Math.max(0, currentAttack - state.attackDelta);
          if (nextAttack !== currentAttack) {
            unit.stats.attackDamage = nextAttack;
            statsChanged = true;
          }
        }

        if (state.movementDelta !== 0) {
          const currentMovement = unit.stats.movementRange;
          const nextMovement = Math.max(0, currentMovement - state.movementDelta);
          if (nextMovement !== currentMovement) {
            unit.stats.movementRange = nextMovement;
            statsChanged = true;
          }
        }

        unit.setImmortal(state.wasImmortal);
        const leftover = Math.max(
          0,
          Math.min(state.shieldBonusApplied, state.shieldBonusRemaining)
        );
        if (leftover > 0) {
          unit.setShield(Math.max(0, unit.getShield() - leftover));
        }
        delete (unit as Record<string, unknown>).fearless;
        if (statsChanged) {
          eventBus.emit('unit:stats:changed', {
            unitId: unit.id,
            stats: { ...unit.stats }
          });
        }
        if (burstState) {
          burstState.affected = burstState.affected.filter((entry) => entry.modifierId !== modifierId);
        }
      },
      hooks: {
        'combat:onHit': (payload: unknown) => {
          const data = payload as CombatHookPayload;
          if (
            data.source !== 'defender' ||
            data.defender.id !== unit.id ||
            data.shieldDamage <= 0 ||
            state.shieldBonusRemaining <= 0
          ) {
            return;
          }
          const consumed = Math.min(state.shieldBonusRemaining, data.shieldDamage);
          state.shieldBonusRemaining = Math.max(0, state.shieldBonusRemaining - consumed);
        }
      }
    });

    affected.push({ unit, modifierId, state });
  }

  const endTime = performance.now() + SISU_BURST_DURATION_SECONDS * 1000;
  burstState = {
    endTime,
    status: SISU_BURST_STATUS_MESSAGE,
    affected,
    tickTimer: null,
    timeout: null
  };

  eventBus.emit('sisuBurstStart', {
    remaining: SISU_BURST_DURATION_SECONDS,
    status: SISU_BURST_STATUS_MESSAGE
  });

  burstState.tickTimer = setInterval(() => {
    if (!burstState) {
      return;
    }
    const remaining = Math.max(0, Math.ceil(getSisuBurstRemaining()));
    if (remaining > 0) {
      eventBus.emit('sisuBurstTick', {
        remaining,
        status: burstState.status
      });
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
    removeModifier(entry.modifierId);
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

  map.revealAround(saunaPos, 3, { autoFrame: false });
  eventBus.emit('torilleRecalled', { count: living.length });
  return true;
}
