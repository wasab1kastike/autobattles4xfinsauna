import type { Resource, GameState } from '../core/GameState.ts';
import type { Building } from '../buildings/Building.ts';
import type { AxialCoord } from '../hex/HexUtils.ts';

export interface ResourceChangedEvent {
  resource: Resource;
  amount: number;
  total: number;
}

export interface PolicyAppliedEvent {
  policy: string;
  state: GameState;
}

export interface BuildingPlacedEvent {
  building: Building;
  coord: AxialCoord;
  state: GameState;
}

export interface BuildingRemovedEvent {
  building: Building;
  coord: AxialCoord;
  state: GameState;
}

export interface UnitDamagedEvent {
  attackerId?: string;
  targetId: string;
  amount: number;
  remainingHealth: number;
}

export interface UnitDiedEvent {
  unitId: string;
  attackerId?: string;
}

export interface SisuPulseEvent {}

export interface SisuPulseStartEvent {
  remaining: number;
}

export interface SisuPulseTickEvent {
  remaining: number;
}

export interface SisuPulseEndEvent {}

export interface SisuCooldownEndEvent {}
