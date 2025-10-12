export type Faction = 'sauna' | 'frost';

export interface UnitTemplate {
  id: string;
  name: string;
  faction: Faction;
  maxHealth: number;
  attack: [number, number];
  critChance: number;
  recovery: number;
}

export interface UnitState extends UnitTemplate {
  health: number;
  ultimateCharge: number;
}

export interface CombatEvent {
  tick: number;
  source: string;
  target: string;
  amount: number;
  wasCrit: boolean;
}

export interface BattleSnapshot {
  tick: number;
  units: UnitState[];
  events: CombatEvent[];
  winner: Faction | null;
}

export interface BattleState {
  seed: number;
  status: 'idle' | 'running' | 'finished';
  snapshot: BattleSnapshot;
}

export type Rng = () => number;

function mulberry32(seed: number): Rng {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UNIT_TEMPLATES: UnitTemplate[] = [
  {
    id: 'sauna-champion',
    name: 'Sauna Champion',
    faction: 'sauna',
    maxHealth: 220,
    attack: [22, 36],
    critChance: 0.2,
    recovery: 6
  },
  {
    id: 'sauna-mystic',
    name: 'Vapor Mystic',
    faction: 'sauna',
    maxHealth: 170,
    attack: [18, 30],
    critChance: 0.25,
    recovery: 8
  },
  {
    id: 'sauna-ranger',
    name: 'Steam Ranger',
    faction: 'sauna',
    maxHealth: 180,
    attack: [16, 32],
    critChance: 0.15,
    recovery: 7
  },
  {
    id: 'frost-brute',
    name: 'Frost Brute',
    faction: 'frost',
    maxHealth: 240,
    attack: [20, 34],
    critChance: 0.18,
    recovery: 5
  },
  {
    id: 'frost-seer',
    name: 'Glacier Seer',
    faction: 'frost',
    maxHealth: 190,
    attack: [17, 28],
    critChance: 0.22,
    recovery: 9
  },
  {
    id: 'frost-raider',
    name: 'Shard Raider',
    faction: 'frost',
    maxHealth: 200,
    attack: [18, 33],
    critChance: 0.16,
    recovery: 6
  }
];

function cloneUnit(template: UnitTemplate): UnitState {
  return {
    ...template,
    health: template.maxHealth,
    ultimateCharge: 0
  };
}

export function createInitialState(seed = Date.now()): BattleState {
  const units = UNIT_TEMPLATES.map(cloneUnit);
  return {
    seed,
    status: 'idle',
    snapshot: {
      tick: 0,
      units,
      events: [],
      winner: null
    }
  };
}

function pickTarget(units: UnitState[], source: UnitState, rng: Rng): UnitState | null {
  const opponents = units.filter((unit) => unit.faction !== source.faction && unit.health > 0);
  if (opponents.length === 0) {
    return null;
  }
  const index = Math.floor(rng() * opponents.length);
  return opponents[index];
}

function applyRecovery(units: UnitState[], source: UnitState, rng: Rng, tick: number): CombatEvent | null {
  const chance = Math.min(0.5, source.recovery / 20);
  if (rng() > chance) {
    return null;
  }
  const amount = Math.round(source.maxHealth * 0.08);
  source.health = Math.min(source.maxHealth, source.health + amount);
  return {
    tick,
    source: source.id,
    target: source.id,
    amount,
    wasCrit: false
  };
}

function computeWinner(units: UnitState[]): Faction | null {
  const saunaAlive = units.some((unit) => unit.faction === 'sauna' && unit.health > 0);
  const frostAlive = units.some((unit) => unit.faction === 'frost' && unit.health > 0);
  if (saunaAlive && frostAlive) {
    return null;
  }
  if (saunaAlive) {
    return 'sauna';
  }
  if (frostAlive) {
    return 'frost';
  }
  return null;
}

export function stepBattle(state: BattleState): BattleState {
  if (state.status === 'finished') {
    return state;
  }

  const next = structuredClone(state) as BattleState;
  const rng = mulberry32(next.seed + next.snapshot.tick + 1);
  const events: CombatEvent[] = [];
  next.snapshot.tick += 1;
  next.status = 'running';

  for (const unit of next.snapshot.units) {
    if (unit.health <= 0) continue;
    const target = pickTarget(next.snapshot.units, unit, rng);
    if (!target) {
      break;
    }

    const baseDamage = unit.attack[0] + rng() * (unit.attack[1] - unit.attack[0]);
    const wasCrit = rng() < unit.critChance;
    const damage = Math.round(baseDamage * (wasCrit ? 1.65 : 1));
    target.health = Math.max(0, target.health - damage);
    events.push({
      tick: next.snapshot.tick,
      source: unit.id,
      target: target.id,
      amount: damage,
      wasCrit
    });

    const recoveryEvent = applyRecovery(next.snapshot.units, unit, rng, next.snapshot.tick);
    if (recoveryEvent) {
      events.push(recoveryEvent);
    }
  }

  next.snapshot.events = events;
  next.snapshot.winner = computeWinner(next.snapshot.units);
  if (next.snapshot.winner) {
    next.status = 'finished';
  }
  return next;
}

export function simulateBattle(seed: number, maxTicks = 120): BattleSnapshot {
  let state = createInitialState(seed);
  for (let i = 0; i < maxTicks; i += 1) {
    state = stepBattle(state);
    if (state.status === 'finished') {
      break;
    }
  }
  return state.snapshot;
}

export function normaliseHealth(unit: UnitState): number {
  return unit.maxHealth === 0 ? 0 : unit.health / unit.maxHealth;
}

export function getUnitsByFaction(units: UnitState[], faction: Faction): UnitState[] {
  return units.filter((unit) => unit.faction === faction);
}
