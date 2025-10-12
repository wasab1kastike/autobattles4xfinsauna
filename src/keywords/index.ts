import type { CombatKeywordRegistry } from '../combat/resolve.ts';

export type KeywordId = 'Bleed' | 'Burn' | 'Lifesteal' | 'Shield';

export type KeywordOwner = 'attacker' | 'defender';

export interface KeywordState {
  keyword: KeywordId;
  stacks: number;
  potency?: number;
}

export interface KeywordCombatantState {
  health: number;
  maxHealth: number;
  shield: number;
}

export interface KeywordEffectDetails {
  tickHpDamage: number;
  tickShieldDamage: number;
  shieldGranted: number;
  shieldConsumed: number;
  lifesteal: number;
  keywordShieldRemaining: number;
}

export interface KeywordEffectSummary {
  attacker: KeywordEffectDetails;
  defender: KeywordEffectDetails;
}

export interface KeywordTickResult {
  hpDamage?: number;
  shieldDamage?: number;
}

interface KeywordShieldConsumeContext extends KeywordBaseContext {
  amount: number;
}

interface KeywordHitContext extends KeywordBaseContext {
  hpDamage: number;
}

interface KeywordBaseContext {
  owner: KeywordOwner;
  state: KeywordState;
  self: KeywordCombatantState;
  opponent: KeywordCombatantState;
}

interface KeywordDefinition {
  onTick?(context: KeywordBaseContext): KeywordTickResult | void;
  onGrantShield?(context: KeywordBaseContext): number | void;
  onConsumeShield?(context: KeywordShieldConsumeContext): number | void;
  onHit?(context: KeywordHitContext): number | void;
}

interface KeywordRuntime {
  state: KeywordState;
  definition: KeywordDefinition;
}

export class KeywordEngine {
  constructor(
    private readonly owner: KeywordOwner,
    private readonly entries: KeywordRuntime[],
    private readonly log: KeywordEffectDetails
  ) {}

  runTick(self: KeywordCombatantState, opponent: KeywordCombatantState): void {
    for (const { definition, state } of this.entries) {
      if (!definition.onTick) {
        continue;
      }
      const result = definition.onTick({ owner: this.owner, state, self, opponent });
      const shieldDamage = clampAmount(result?.shieldDamage ?? 0);
      if (shieldDamage > 0) {
        const appliedShield = Math.min(self.shield, shieldDamage);
        if (appliedShield > 0) {
          self.shield -= appliedShield;
          this.log.tickShieldDamage += appliedShield;
        }
      }
      const hpDamage = clampAmount(result?.hpDamage ?? 0);
      if (hpDamage > 0) {
        const appliedHp = Math.min(self.health, hpDamage);
        if (appliedHp > 0) {
          self.health -= appliedHp;
          this.log.tickHpDamage += appliedHp;
        }
      }
    }
  }

  grantShield(self: KeywordCombatantState, opponent: KeywordCombatantState): number {
    let added = 0;
    for (const { definition, state } of this.entries) {
      if (!definition.onGrantShield) {
        continue;
      }
      const amount = clampAmount(
        definition.onGrantShield({ owner: this.owner, state, self, opponent }) ?? 0
      );
      if (amount > 0) {
        added += amount;
      }
    }
    if (added > 0) {
      self.shield += added;
      this.log.shieldGranted += added;
    }
    return added;
  }

  consumeShield(
    amount: number,
    self: KeywordCombatantState,
    opponent: KeywordCombatantState
  ): number {
    let remaining = clampAmount(amount);
    if (remaining <= 0) {
      return 0;
    }

    let consumedTotal = 0;
    for (const { definition, state } of this.entries) {
      if (!definition.onConsumeShield || remaining <= 0) {
        continue;
      }
      const consumed = clampAmount(
        definition.onConsumeShield({ owner: this.owner, state, self, opponent, amount: remaining }) ?? 0
      );
      if (consumed <= 0) {
        continue;
      }
      const applied = Math.min(remaining, consumed);
      consumedTotal += applied;
      remaining -= applied;
    }

    if (consumedTotal > 0) {
      this.log.shieldConsumed += consumedTotal;
    }

    return consumedTotal;
  }

  applyHit(
    hpDamage: number,
    self: KeywordCombatantState,
    opponent: KeywordCombatantState
  ): number {
    if (hpDamage <= 0) {
      return 0;
    }

    let requestedHeal = 0;
    for (const { definition, state } of this.entries) {
      if (!definition.onHit) {
        continue;
      }
      const heal = clampAmount(
        definition.onHit({ owner: this.owner, state, self, opponent, hpDamage }) ?? 0
      );
      if (heal > 0) {
        requestedHeal += heal;
      }
    }

    if (requestedHeal <= 0) {
      return 0;
    }

    const missingHealth = Math.max(0, self.maxHealth - self.health);
    if (missingHealth <= 0) {
      return 0;
    }

    const applied = Math.min(missingHealth, requestedHeal);
    if (applied > 0) {
      self.health += applied;
      this.log.lifesteal += applied;
    }
    return applied;
  }

  getShieldValue(): number {
    let total = 0;
    for (const { definition, state } of this.entries) {
      if (!definition.onGrantShield) {
        continue;
      }
      if (state.keyword !== 'Shield') {
        continue;
      }
      const stackValue = getShieldStackValue(state);
      if (stackValue <= 0) {
        continue;
      }
      const stacks = Math.max(0, Number.isFinite(state.stacks) ? state.stacks : 0);
      if (stacks <= 0) {
        continue;
      }
      total += stacks * stackValue;
    }
    return total;
  }
}

export function createKeywordEffectsLog(): KeywordEffectSummary {
  return {
    attacker: createEmptyEffectDetails(),
    defender: createEmptyEffectDetails()
  };
}

export function createKeywordEngine(
  registry: CombatKeywordRegistry | null | undefined,
  owner: KeywordOwner,
  log: KeywordEffectDetails
): KeywordEngine | null {
  const states = collectKeywordStates(registry);
  if (states.length === 0) {
    return null;
  }

  const entries: KeywordRuntime[] = [];
  for (const state of states) {
    const definition = keywordDefinitions.get(state.keyword);
    if (!definition) {
      continue;
    }
    entries.push({ state, definition });
  }

  if (entries.length === 0) {
    return null;
  }

  return new KeywordEngine(owner, entries, log);
}

export function makeKeyword(
  keyword: KeywordId,
  stacks = 1,
  potency?: number
): KeywordState {
  return {
    keyword,
    stacks: sanitizeStackCount(stacks),
    potency: potency !== undefined ? sanitizePotency(potency) : undefined
  };
}

const keywordDefinitions = new Map<KeywordId, KeywordDefinition>();

export function registerKeyword(id: KeywordId, definition: KeywordDefinition): void {
  keywordDefinitions.set(id, definition);
}

function createEmptyEffectDetails(): KeywordEffectDetails {
  return {
    tickHpDamage: 0,
    tickShieldDamage: 0,
    shieldGranted: 0,
    shieldConsumed: 0,
    lifesteal: 0,
    keywordShieldRemaining: 0
  };
}

function clampAmount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return value > 0 ? value : 0;
}

function sanitizeStackCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return value > 0 ? value : 0;
}

function sanitizePotency(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return value > 0 ? value : 0;
}

function collectKeywordStates(
  registry: CombatKeywordRegistry | null | undefined
): KeywordState[] {
  if (!registry) {
    return [];
  }

  const states: KeywordState[] = [];
  const iterable = registry as Iterable<unknown>;
  if (typeof iterable[Symbol.iterator] === 'function') {
    for (const entry of iterable) {
      const state = normalizeKeywordState(entry);
      if (state) {
        states.push(state);
      }
    }
    return states;
  }

  if (typeof registry === 'object') {
    for (const value of Object.values(registry as Record<string, unknown>)) {
      const state = normalizeKeywordState(value);
      if (state) {
        states.push(state);
      }
    }
  }

  return states;
}

function normalizeKeywordState(entry: unknown): KeywordState | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const candidate = entry as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(candidate, 'stacks')) {
    return null;
  }
  const keywordId = normalizeKeywordId(candidate.keyword);
  if (!keywordId) {
    return null;
  }
  const state = candidate as KeywordState;
  state.keyword = keywordId;
  state.stacks = sanitizeStackCount(state.stacks);
  if (Object.prototype.hasOwnProperty.call(candidate, 'potency') && state.potency !== undefined) {
    state.potency = sanitizePotency(state.potency);
  }
  return state;
}

function normalizeKeywordId(value: unknown): KeywordId | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case 'bleed':
      return 'Bleed';
    case 'burn':
      return 'Burn';
    case 'lifesteal':
    case 'life-steal':
      return 'Lifesteal';
    case 'shield':
      return 'Shield';
    default:
      return null;
  }
}

function getShieldStackValue(state: KeywordState): number {
  const potency = state.potency !== undefined ? sanitizePotency(state.potency) : 1;
  return potency > 0 ? potency : 0;
}

function getLifestealRatio(state: KeywordState): number {
  if (state.potency !== undefined) {
    const potency = sanitizePotency(state.potency);
    return potency > 0 ? potency : 0;
  }
  const stacks = sanitizeStackCount(state.stacks);
  if (stacks <= 0) {
    return 0;
  }
  // Default to 20% per stack when potency is unspecified.
  const ratio = stacks * 0.2;
  return ratio > 0 ? ratio : 0;
}

registerKeyword('Bleed', {
  onTick({ state, self }) {
    const stacks = sanitizeStackCount(state.stacks);
    if (stacks <= 0 || self.health <= 0) {
      state.stacks = stacks;
      return;
    }
    const potency = state.potency !== undefined ? sanitizePotency(state.potency) : 1;
    const totalDamage = stacks * potency;
    if (totalDamage <= 0) {
      return;
    }
    const hpDamage = Math.min(self.health, totalDamage);
    state.stacks = Math.max(0, stacks - 1);
    return { hpDamage };
  }
});

registerKeyword('Burn', {
  onTick({ state, self }) {
    const stacks = sanitizeStackCount(state.stacks);
    if (stacks <= 0) {
      state.stacks = stacks;
      return;
    }
    const potency = state.potency !== undefined ? sanitizePotency(state.potency) : 1;
    const totalDamage = stacks * potency;
    if (totalDamage <= 0) {
      return;
    }
    const shieldDamage = Math.min(self.shield, totalDamage);
    const remaining = totalDamage - shieldDamage;
    const hpDamage = Math.min(self.health, remaining);
    state.stacks = Math.max(0, stacks - 1);
    return { shieldDamage, hpDamage };
  }
});

registerKeyword('Shield', {
  onGrantShield({ state }) {
    const stacks = sanitizeStackCount(state.stacks);
    if (stacks <= 0) {
      state.stacks = stacks;
      return 0;
    }
    const value = stacks * getShieldStackValue(state);
    return value > 0 ? value : 0;
  },
  onConsumeShield({ state, amount }) {
    const stacks = sanitizeStackCount(state.stacks);
    if (stacks <= 0) {
      state.stacks = 0;
      return 0;
    }
    const perStack = getShieldStackValue(state);
    if (perStack <= 0) {
      state.stacks = 0;
      return 0;
    }
    const total = stacks * perStack;
    if (total <= 0) {
      state.stacks = 0;
      return 0;
    }
    const consumed = Math.min(total, clampAmount(amount));
    const stacksConsumed = consumed / perStack;
    state.stacks = Math.max(0, stacks - stacksConsumed);
    return consumed > 0 ? consumed : 0;
  }
});

registerKeyword('Lifesteal', {
  onHit({ state, hpDamage }) {
    if (hpDamage <= 0) {
      return 0;
    }
    const ratio = getLifestealRatio(state);
    if (ratio <= 0) {
      return 0;
    }
    const heal = hpDamage * ratio;
    return heal > 0 ? heal : 0;
  }
});

