import type { GameState } from '../core/GameState.ts';
import { Resource } from '../core/resources.ts';
import saunaBeerIcon from '../../assets/ui/sauna-beer.svg';
import resourceIcon from '../../assets/ui/resource.svg';
import saunaRosterIcon from '../../assets/ui/saunoja-roster.svg';

export const POLICY_EVENTS = {
  APPLIED: 'policy:applied',
  REJECTED: 'policy:rejected',
  REVOKED: 'policy:revoked'
} as const;

export type PolicyEventName = (typeof POLICY_EVENTS)[keyof typeof POLICY_EVENTS];

export type PolicyLifecycleEventName =
  | typeof POLICY_EVENTS.APPLIED
  | typeof POLICY_EVENTS.REVOKED;

export type PolicyId = 'eco' | 'temperance' | 'steam-diplomats';

export interface PolicyAppliedEvent {
  readonly policy: PolicyDefinition;
  readonly state: GameState;
}

export interface PolicyRevokedEvent {
  readonly policy: PolicyDefinition;
  readonly state: GameState;
}

export type PolicyRejectionReason =
  | 'unknown-policy'
  | 'already-applied'
  | 'prerequisites-not-met'
  | 'insufficient-resources'
  | 'not-toggleable'
  | 'not-applied';

export interface PolicyRejectedEvent {
  readonly policyId: string;
  readonly policy?: PolicyDefinition;
  readonly state: GameState;
  readonly reason: PolicyRejectionReason;
  readonly missingPrerequisites?: PolicyPrerequisite[];
}

export interface PolicyPrerequisite {
  readonly description: string;
  readonly isSatisfied: (state: GameState) => boolean;
}

export interface PolicyVisuals {
  readonly icon: string;
  readonly gradient: string;
  readonly accentColor: string;
  readonly badges?: readonly string[];
  readonly flair?: string;
}

export type PolicyEffectPayload = PolicyAppliedEvent | PolicyRevokedEvent;

export interface PolicyEffectHook {
  readonly event: PolicyLifecycleEventName;
  readonly once?: boolean;
  readonly invoke: (payload: PolicyEffectPayload) => void;
}

export interface PolicyDefinition {
  readonly id: PolicyId;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
  readonly resource: Resource;
  readonly prerequisites: readonly PolicyPrerequisite[];
  readonly visuals: PolicyVisuals;
  readonly effects: readonly PolicyEffectHook[];
  readonly spotlight?: string;
  readonly toggleable?: boolean;
}

const POLICY_DEFINITIONS: PolicyDefinition[] = [
  {
    id: 'eco',
    name: 'Evergreen Eco Mandate',
    description: 'Increase passive sauna beer brewing by one bottle each production tick.',
    cost: 15,
    resource: Resource.SAUNAKUNNIA,
    prerequisites: [],
    visuals: {
      icon: resourceIcon,
      gradient: 'linear-gradient(135deg, rgba(66, 240, 155, 0.9), rgba(13, 114, 234, 0.85))',
      accentColor: '#34d399',
      badges: ['Economy', 'Sustainability'],
      flair: 'Green-lit by the council of whisked sauna masters.'
    },
    effects: [
      {
        event: POLICY_EVENTS.APPLIED,
        once: false,
        invoke: ({ state }) => {
          state.modifyPassiveGeneration(Resource.SAUNA_BEER, 1);
        }
      },
      {
        event: POLICY_EVENTS.REVOKED,
        once: false,
        invoke: ({ state }) => {
          state.modifyPassiveGeneration(Resource.SAUNA_BEER, -1);
        }
      }
    ],
    spotlight: 'Sustainably expand your brewing line with solar-heated mash tuns.',
    toggleable: true
  },
  {
    id: 'temperance',
    name: 'Aurora Temperance Treaty',
    description: 'Boost night shift work speed by 5% once the eco initiative is live.',
    cost: 25,
    resource: Resource.SAUNAKUNNIA,
    prerequisites: [
      {
        description: 'Enact the Evergreen Eco Mandate.',
        isSatisfied: (state) => state.hasPolicy('eco')
      },
      {
        description: 'Stockpile at least 30 Sauna Beer bottles to brief the midnight crews.',
        isSatisfied: (state) => state.getResource(Resource.SAUNA_BEER) >= 30
      }
    ],
    visuals: {
      icon: saunaRosterIcon,
      gradient: 'linear-gradient(140deg, rgba(46, 51, 227, 0.9), rgba(118, 75, 162, 0.85))',
      accentColor: '#6366f1',
      badges: ['Discipline', 'Night Ops'],
      flair: 'Whispers of aurora spirits keep the crew laser-focused after dusk.'
    },
    effects: [
      {
        event: POLICY_EVENTS.APPLIED,
        once: true,
        invoke: ({ state }) => {
          state.nightWorkSpeedMultiplier = Number((state.nightWorkSpeedMultiplier * 1.05).toFixed(4));
        }
      }
    ],
    spotlight: 'Glow-lit helmets and synchronized chants keep the late shift on tempo.'
  },
  {
    id: 'steam-diplomats',
    name: 'Steam Diplomats Accord',
    description: 'Import two additional sauna beer bottles per tick via gilded trade routes.',
    cost: 35,
    resource: Resource.SAUNAKUNNIA,
    prerequisites: [
      {
        description: 'Secure the Aurora Temperance Treaty for your envoys.',
        isSatisfied: (state) => state.hasPolicy('temperance')
      },
      {
        description: 'Hold a reserve of 50 Sauna Beer bottles to fund the embassy festivities.',
        isSatisfied: (state) => state.getResource(Resource.SAUNA_BEER) >= 50
      }
    ],
    visuals: {
      icon: saunaBeerIcon,
      gradient: 'linear-gradient(150deg, rgba(255, 173, 94, 0.92), rgba(255, 99, 71, 0.85))',
      accentColor: '#fb923c',
      badges: ['Diplomacy', 'Logistics'],
      flair: 'Silver samovars arrive with diplomatic steam-born delights.'
    },
    effects: [
      {
        event: POLICY_EVENTS.APPLIED,
        once: true,
        invoke: ({ state }) => {
          state.modifyPassiveGeneration(Resource.SAUNA_BEER, 2);
        }
      }
    ],
    spotlight: 'Trade envoys pipe artisanal steam through every new supply line.'
  }
];

const POLICY_REGISTRY = new Map<PolicyId, PolicyDefinition>();
for (const definition of POLICY_DEFINITIONS) {
  POLICY_REGISTRY.set(definition.id, definition);
}

export function listPolicies(): readonly PolicyDefinition[] {
  return POLICY_DEFINITIONS;
}

export function getPolicyDefinition(id: string): PolicyDefinition | undefined {
  return POLICY_REGISTRY.get(id as PolicyId);
}
