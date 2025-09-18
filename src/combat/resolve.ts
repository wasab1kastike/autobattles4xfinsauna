import { triggerModifierHook } from '../mods/runtime.ts';

export type CombatHookEvent = 'onHit' | 'onKill';

export type CombatHook = (payload: CombatHookPayload) => void;

export type CombatHookMap = Partial<Record<CombatHookEvent, CombatHook | CombatHook[]>>;

export type CombatKeywordRegistry =
  | Iterable<CombatHookMap | null | undefined>
  | Record<string, CombatHookMap | null | undefined>;

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
  if (typeof (registry as Iterable<CombatHookMap | null | undefined>)[Symbol.iterator] === 'function') {
    const hooks: CombatHookMap[] = [];
    for (const entry of registry as Iterable<CombatHookMap | null | undefined>) {
      if (entry) {
        hooks.push(entry);
      }
    }
    return hooks;
  }
  const record = registry as Record<string, CombatHookMap | null | undefined>;
  return Object.values(record).filter((entry): entry is CombatHookMap => Boolean(entry));
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

export function resolveCombat(args: ResolveCombatArgs): CombatResolution {
  const attacker = args.attacker ?? null;
  const defender = args.defender;

  const requestedDamage = args.baseDamage;
  const minDamage = clampNonNegative(args.minimumDamage ?? 1);

  const attackValue = Number.isFinite(requestedDamage)
    ? clampNonNegative(requestedDamage as number)
    : clampNonNegative(attacker?.attack ?? 0);
  const defenseValue = clampNonNegative(defender.defense ?? 0);

  const rawDamage = Math.max(minDamage, attackValue - defenseValue);
  const shieldBefore = clampNonNegative(defender.shield ?? 0);
  const shieldDamage = Math.min(shieldBefore, rawDamage);
  const hpDamage = Math.max(0, rawDamage - shieldDamage);
  const healthBefore = clampNonNegative(defender.health);
  const remainingHealth = Math.max(0, healthBefore - hpDamage);
  const remainingShield = Math.max(0, shieldBefore - shieldDamage);
  const lethal = hpDamage > 0 && remainingHealth <= 0;

  const attackerSnapshot = toSnapshot(attacker);
  const defenderSnapshot = toSnapshot(defender, {
    health: remainingHealth,
    shield: remainingShield
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
    remainingShield
  };
}
