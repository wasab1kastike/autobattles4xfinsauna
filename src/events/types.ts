export interface UnitDamagedPayload {
  attackerId?: string;
  targetId: string;
  amount: number;
  remainingHealth: number;
}

export interface UnitHealedPayload {
  unitId: string;
  amount: number;
  remainingHealth: number;
}

export interface UnitDiedPayload {
  unitId: string;
  attackerId?: string;
  unitFaction: string;
  attackerFaction?: string;
}

export interface UnitExperienceChangedPayload {
  unitId: string;
  xp: number;
}

export interface SaunaDamagedPayload {
  attackerId?: string;
  attackerFaction?: string;
  amount: number;
  remainingHealth: number;
}

export interface SaunaDestroyedPayload {
  attackerId?: string;
  attackerFaction?: string;
}
