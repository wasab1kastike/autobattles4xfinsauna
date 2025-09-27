import { triggerModifierHook } from '../mods/runtime.ts';
import {
  createKeywordEffectsLog,
  createKeywordEngine,
  type KeywordCombatantState,
  type KeywordEffectSummary,
  type KeywordState
} from '../keywords/index.ts';

export type CombatHookEvent = 'onHit' | 'onKill';

export type CombatHook = (payload: CombatHookPayload) => void;

export type CombatHookMap = Partial<Record<CombatHookEvent, CombatHook | CombatHook[]>>;

export type CombatKeywordEntry = CombatHookMap | KeywordState;

export type CombatKeywordRegistry =
  | Iterable<CombatKeywordEntry | null | undefined>
  | Record<string, CombatKeywordEntry | null | undefined>;

export interface CombatParticipant {
  readonly id: string;
  readonly faction?: string;
  readonly attack?: number;
  readonly defense?: number;
  readonly health: number;
  readonly maxHealth?: number;
  readonly shield?: number;
  readonly hooks?: CombatHookMap | null;
  readonly keywords?: CombatKeywordRegistry | null;
}

export interface CombatSnapshot {
  readonly id: string;
  readonly faction?: string;
  readonly health: number;
  readonly maxHealth?: number;
  readonly shield: number;
}

export interface CombatHookPayload {
  readonly source: 'attacker' | 'defender';
  readonly attacker: CombatSnapshot;
  readonly defender: CombatSnapshot;
  readonly damage: number;
  readonly shieldDamage: number;
  readonly hpDamage: number;
  readonly lethal: boolean;
}

export interface CombatResolution {
  readonly damage: number;
  readonly shieldDamage: number;
  readonly hpDamage: number;
  readonly lethal: boolean;
  readonly remainingHealth: number;
  readonly remainingShield: number;
  readonly attackerHealing: number;
  readonly attackerRemainingHealth?: number;
  readonly attackerRemainingShield?: number;
  readonly keywordEffects: KeywordEffectSummary;
}

export interface ResolveCombatArgs {
  readonly attacker?: CombatParticipant | null;
  readonly defender: CombatParticipant;
  readonly baseDamage?: number;
  readonly minimumDamage?: number;
}

function clampNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function toSnapshot(
  participant: CombatParticipant | null | undefined,
  overrides?: Partial<Pick<CombatSnapshot, 'health' | 'shield'>>
): CombatSnapshot {
  const health = clampNonNegative(
    overrides?.health ?? participant?.health ?? 0
  );
  const shield = clampNonNegative(
    overrides?.shield ?? participant?.shield ?? 0
  );
  return {
    id: participant?.id ?? 'unknown',
    faction: participant?.faction,
    health,
    maxHealth: participant?.maxHealth,
    shield
  };
}

function isHookMap(entry: CombatKeywordEntry | null | undefined): entry is CombatHookMap {
  if (!entry) {
    return false;
  }
  const hookEntry = entry as CombatHookMap;
  return (
    typeof hookEntry.onHit === 'function' ||
    typeof hookEntry.onKill === 'function' ||
    Array.isArray(hookEntry.onHit) ||
    Array.isArray(hookEntry.onKill)
  );
}

function normalizeHooks(entry: CombatHook | CombatHook[] | null | undefined): CombatHook[] {
  if (!entry) {
    return [];
  }
  if (Array.isArray(entry)) {
    return entry.filter((hook): hook is CombatHook => typeof hook === 'function');
  }
  if (typeof entry === 'function') {
    return [entry];
  }
  return [];
}

function collectKeywordHooks(registry: CombatKeywordRegistry | null | undefined): CombatHookMap[] {
  if (!registry) {
    return [];
  }
  if (typeof (registry as Iterable<CombatKeywordEntry | null | undefined>)[Symbol.iterator] === 'function') {
    const hooks: CombatHookMap[] = [];
    for (const entry of registry as Iterable<CombatKeywordEntry | null | undefined>) {
      if (isHookMap(entry)) {
        hooks.push(entry);
      }
    }
    return hooks;
  }
  const record = registry as Record<string, CombatKeywordEntry | null | undefined>;
  return Object.values(record).filter((entry): entry is CombatHookMap => isHookMap(entry));
}

function fireParticipantHooks(
  participant: CombatParticipant | null | undefined,
  event: CombatHookEvent,
  payload: CombatHookPayload
): void {
  if (!participant) {
    return;
  }

  const direct = normalizeHooks(participant.hooks?.[event]);
  for (const hook of direct) {
    hook(payload);
  }

  const keywordHooks = collectKeywordHooks(participant.keywords);
  for (const keyword of keywordHooks) {
    for (const hook of normalizeHooks(keyword[event])) {
      hook(payload);
    }
  }
}

function toCombatantState(participant: CombatParticipant | null | undefined): KeywordCombatantState {
  const health = clampNonNegative(participant?.health ?? 0);
  const maxHealthSource = clampNonNegative(participant?.maxHealth ?? health);
  return {
    health,
    maxHealth: Math.max(maxHealthSource, health),
    shield: clampNonNegative(participant?.shield ?? 0)
  };
}

function emptyCombatantState(): KeywordCombatantState {
  return { health: 0, maxHealth: 0, shield: 0 };
}

export function resolveCombat(args: ResolveCombatArgs): CombatResolution {
  const attacker = args.attacker ?? null;
  const defender = args.defender;

  const requestedDamage = args.baseDamage;
  const minDamage = clampNonNegative(args.minimumDamage ?? 1);

  const attackValue = Number.isFinite(requestedDamage)
    ? clampNonNegative(requestedDamage as number)
    : clampNonNegative(attacker?.attack ?? 0);
  const defenseValue = clampNonNegative(defender.defense ?? 0);

  const keywordEffects = createKeywordEffectsLog();

  const defenderState = toCombatantState(defender);
  const attackerState = attacker ? toCombatantState(attacker) : null;

  const defenderEngine = createKeywordEngine(defender.keywords ?? null, 'defender', keywordEffects.defender);
  const attackerEngine = attacker
    ? createKeywordEngine(attacker.keywords ?? null, 'attacker', keywordEffects.attacker)
    : null;

  const defenderOpponent = attackerState ?? emptyCombatantState();
  if (defenderEngine) {
    defenderEngine.runTick(defenderState, defenderOpponent);
  }

  if (attackerEngine && attackerState) {
    attackerEngine.runTick(attackerState, defenderState);
  }

  const defenderAliveBefore = defenderState.health > 0;
  const baseShieldBeforeGrant = clampNonNegative(defenderState.shield);
  if (defenderEngine) {
    defenderEngine.grantShield(defenderState, defenderOpponent);
  }
  const totalShieldBefore = clampNonNegative(defenderState.shield);

  const rawDamage = defenderAliveBefore ? Math.max(minDamage, attackValue - defenseValue) : 0;
  const shieldDamage = defenderAliveBefore ? Math.min(totalShieldBefore, rawDamage) : 0;
  const hpDamage = defenderAliveBefore ? Math.max(0, rawDamage - shieldDamage) : 0;

  defenderState.shield = Math.max(0, totalShieldBefore - shieldDamage);

  const baseShieldDamage = Math.min(baseShieldBeforeGrant, shieldDamage);
  const keywordShieldDamage = Math.max(0, shieldDamage - baseShieldDamage);

  if (defenderEngine && keywordShieldDamage > 0) {
    defenderEngine.consumeShield(keywordShieldDamage, defenderState, defenderOpponent);
  }

  const keywordShieldRemaining = defenderEngine ? defenderEngine.getShieldValue() : 0;
  keywordEffects.defender.keywordShieldRemaining = keywordShieldRemaining;

  const remainingBaseShield = Math.max(0, baseShieldBeforeGrant - baseShieldDamage);
  defenderState.shield = remainingBaseShield + keywordShieldRemaining;

  const healthBeforeDamage = defenderState.health;
  defenderState.health = Math.max(0, healthBeforeDamage - hpDamage);
  const remainingHealth = defenderState.health;
  const lethal = remainingHealth <= 0;

  let attackerHealing = 0;
  if (attackerEngine && attackerState) {
    attackerHealing = attackerEngine.applyHit(hpDamage, attackerState, defenderState);
    keywordEffects.attacker.keywordShieldRemaining = attackerEngine.getShieldValue();
  } else {
    keywordEffects.attacker.keywordShieldRemaining = 0;
  }

  const attackerSnapshot = toSnapshot(attacker, attackerState ?? undefined);
  const defenderSnapshot = toSnapshot(defender, {
    health: remainingHealth,
    shield: remainingBaseShield + keywordShieldRemaining
  });

  const payloadBase = {
    attacker: attackerSnapshot,
    defender: defenderSnapshot,
    damage: rawDamage,
    shieldDamage,
    hpDamage,
    lethal
  } as const;

  const defenderPayload: CombatHookPayload = {
    ...payloadBase,
    source: 'defender'
  };
  fireParticipantHooks(defender, 'onHit', defenderPayload);
  triggerModifierHook('combat:onHit', defenderPayload);

  if (attacker) {
    const attackerPayload: CombatHookPayload = {
      ...payloadBase,
      source: 'attacker'
    };
    fireParticipantHooks(attacker, 'onHit', attackerPayload);
    triggerModifierHook('combat:onHit', attackerPayload);

    if (lethal) {
      fireParticipantHooks(attacker, 'onKill', attackerPayload);
      triggerModifierHook('combat:onKill', attackerPayload);
    }
  }

  if (lethal) {
    fireParticipantHooks(defender, 'onKill', defenderPayload);
    triggerModifierHook('combat:onKill', defenderPayload);
  }

  return {
    damage: rawDamage,
    shieldDamage,
    hpDamage,
    lethal,
    remainingHealth,
    remainingShield: remainingBaseShield + keywordShieldRemaining,
    attackerHealing,
    attackerRemainingHealth: attackerState?.health,
    attackerRemainingShield: attackerState?.shield,
    keywordEffects
  };
}
