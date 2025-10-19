import type { AxialCoord } from '../hex/HexUtils.ts';
import type { KeywordEffectSummary } from '../keywords/index.ts';

export interface UnitAttackPayload {
  attackerId: string;
  targetId: string;
  attackerCoord: AxialCoord;
  targetCoord: AxialCoord;
  timestamp: number;
  impactAt: number;
  recoverAt: number;
  attackProfile?: string;
}

export interface UnitTeleportedPayload {
  unitId: string;
  from: AxialCoord;
  to: AxialCoord;
}

export interface UnitDamagedPayload {
  attackerId?: string;
  targetId: string;
  targetCoord?: AxialCoord;
  amount: number;
  remainingHealth: number;
  timestamp?: number;
  keywordEffects: KeywordEffectSummary;
  attackerHealing?: number;
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

export interface UnitTauntChangedPayload {
  unitId: string;
  active: boolean;
  radius: number;
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
