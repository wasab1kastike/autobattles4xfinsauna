import type { GameState } from '../core/GameState.ts';
import { Resource } from '../core/resources.ts';
import saunaBeerIcon from '../../assets/ui/sauna-beer.svg';
import resourceIcon from '../../assets/ui/resource.svg';
import saunaRosterIcon from '../../assets/ui/saunoja-roster.svg';
import type { PolicyUnitModifiers } from '../policies/types.ts';

export const POLICY_EVENTS = {
  APPLIED: 'policy:applied',
  REJECTED: 'policy:rejected',
  REVOKED: 'policy:revoked'
} as const;

export type PolicyEventName = (typeof POLICY_EVENTS)[keyof typeof POLICY_EVENTS];

export type PolicyLifecycleEventName =
  | typeof POLICY_EVENTS.APPLIED
  | typeof POLICY_EVENTS.REVOKED;

export type PolicyId =
  | 'eco'
  | 'temperance'
  | 'steam-diplomats'
  | 'steam-debt-protocol'
  | 'hypersteam-levy'
  | 'battle-rhythm'
  | 'saunojas-rage'
  | 'glacial-gambit'
  | 'shieldwall-doctrine'
  | 'sauna-skin';

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
  readonly unitModifiers?: PolicyUnitModifiers;
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
    description: 'Boost night shift work speed by 5% with aurora-guided discipline across every crew.',
    cost: 25,
    resource: Resource.SAUNAKUNNIA,
    prerequisites: [
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
  },
  {
    id: 'steam-debt-protocol',
    name: 'Steam Debt Protocol',
    description:
      'Float luxury bonds that bankroll lavish sauna beer runs while daring enemy commanders to press the tempo.',
    cost: 55,
    resource: Resource.SAUNAKUNNIA,
    prerequisites: [
      {
        description: 'Maintain a collateral reserve of at least 90 Sauna Beer bottles.',
        isSatisfied: (state) => state.getResource(Resource.SAUNA_BEER) >= 90
      }
    ],
    visuals: {
      icon: resourceIcon,
      gradient:
        'linear-gradient(158deg, rgba(255, 255, 255, 0.94), rgba(250, 204, 21, 0.9), rgba(244, 114, 182, 0.88))',
      accentColor: '#facc15',
      badges: ['Economy', 'High Society'],
      flair: 'Opalescent ledgers hover above the treasury while auric steam sigils coil around the council dais.'
    },
    effects: [
      {
        event: POLICY_EVENTS.APPLIED,
        once: false,
        invoke: ({ state }) => {
          const passiveBonus = 3;
          const aggressionFactor = 1.25;
          const cadenceFactor = 1.15;
          state.modifyPassiveGeneration(Resource.SAUNA_BEER, passiveBonus);
          state.applyEnemyScalingModifiers({
            aggression: aggressionFactor,
            cadence: cadenceFactor
          });
        }
      },
      {
        event: POLICY_EVENTS.REVOKED,
        once: false,
        invoke: ({ state }) => {
          const passiveBonus = 3;
          const aggressionFactor = 1 / 1.25;
          const cadenceFactor = 1 / 1.15;
          state.modifyPassiveGeneration(Resource.SAUNA_BEER, -passiveBonus);
          state.applyEnemyScalingModifiers({
            aggression: aggressionFactor,
            cadence: cadenceFactor
          });
        }
      }
    ],
    unitModifiers: {
      upkeepMultiplier: 1.12
    },
    spotlight:
      'Treasury clerks unfurl velvet-banded scrolls as bond-backed tankards arrive in synchronized, perfumed waves.',
    toggleable: true
  },
  {
    id: 'hypersteam-levy',
    name: 'Hypersteam Levy Ultimatum',
    description:
      'Stack prestige-backed levies that flood the breweries while baiting enemy warbands into a relentless counter-surge.',
    cost: 90,
    resource: Resource.SAUNAKUNNIA,
    prerequisites: [
      {
        description: 'Project at least 200 Saunakunnia to impress the imperial auditors.',
        isSatisfied: (state) => state.getResource(Resource.SAUNAKUNNIA) >= 200
      },
      {
        description: 'Stockpile 180 Sauna Beer bottles for the levy launch gala.',
        isSatisfied: (state) => state.getResource(Resource.SAUNA_BEER) >= 180
      }
    ],
    visuals: {
      icon: saunaBeerIcon,
      gradient:
        'linear-gradient(176deg, rgba(17, 24, 39, 0.96) 0%, rgba(180, 83, 9, 0.92) 48%, rgba(252, 211, 77, 0.9) 100%)',
      accentColor: '#fbbf24',
      badges: ['Prestige', 'Economy', 'High Risk'],
      flair:
        'Gilded steam sigils spiral through obsidian bond vaults as levy inspectors bathe the brewhouse in molten amber light.'
    },
    effects: [
      {
        event: POLICY_EVENTS.APPLIED,
        once: false,
        invoke: ({ state }) => {
          const levyBrewBonus = 5;
          const aggressionMultiplier = 1.4;
          const cadenceMultiplier = 1.2;
          const strengthMultiplier = 1.1;
          state.modifyPassiveGeneration(Resource.SAUNA_BEER, levyBrewBonus);
          state.applyEnemyScalingModifiers({
            aggression: aggressionMultiplier,
            cadence: cadenceMultiplier,
            strength: strengthMultiplier
          });
        }
      },
      {
        event: POLICY_EVENTS.REVOKED,
        once: false,
        invoke: ({ state }) => {
          const levyBrewBonus = 5;
          const aggressionMultiplier = 1.4;
          const cadenceMultiplier = 1.2;
          const strengthMultiplier = 1.1;
          state.modifyPassiveGeneration(Resource.SAUNA_BEER, -levyBrewBonus);
          state.applyEnemyScalingModifiers({
            aggression: 1 / aggressionMultiplier,
            cadence: 1 / cadenceMultiplier,
            strength: 1 / strengthMultiplier
          });
        }
      }
    ],
    spotlight:
      'Warning: the levy’s gilded pipelines gush Sauna Beer while enemy scouts rally with terrifying cadence—only prestige-drunk commanders should pull this double-edged lever.',
    toggleable: true
  },
  {
    id: 'battle-rhythm',
    name: 'Battle Rhythm Doctrine',
    description:
      'Concerted training regimens raise attack tempo and accuracy, but the drills strain supply lines.',
    cost: 40,
    resource: Resource.SAUNAKUNNIA,
    prerequisites: [],
    visuals: {
      icon: saunaRosterIcon,
      gradient: 'linear-gradient(160deg, rgba(252, 211, 77, 0.95), rgba(248, 113, 113, 0.88))',
      accentColor: '#f97316',
      badges: ['Combat', 'Discipline'],
      flair: 'Metronomes echo through the barracks as sparring pairs whirl in unison.'
    },
    effects: [],
    unitModifiers: {
      statMultipliers: {
        attackDamage: 1.15,
        movementRange: 1.05
      },
      hitChanceBonus: 0.05,
      upkeepMultiplier: 1.1
    },
    spotlight: 'Drumbeats roll across the training grounds, pushing every strike to land true.',
    toggleable: true
  },
  {
    id: 'saunojas-rage',
    name: "Saunojas' Rage Protocol",
    description:
      'Ignite berserker war chants that double striking power at the expense of precision and lavish ration surcharges.',
    cost: 60,
    resource: Resource.SAUNAKUNNIA,
    prerequisites: [],
    visuals: {
      icon: saunaBeerIcon,
      gradient: 'linear-gradient(162deg, rgba(254, 226, 226, 0.96), rgba(248, 113, 113, 0.92), rgba(79, 70, 229, 0.88))',
      accentColor: '#ef4444',
      badges: ['Combat', 'Berserk'],
      flair: 'Sparks leap from rune drums as scarlet steam halos every roaring Saunojas charge.'
    },
    effects: [],
    unitModifiers: {
      damageDealtMultiplier: 2,
      hitChanceBonus: -0.5,
      upkeepMultiplier: 1.4
    },
    spotlight: 'Commanders brandish ember-lit gongs to unleash unstoppable but reckless sauna berserkers.',
    toggleable: true
  },
  {
    id: 'glacial-gambit',
    name: 'Glacial Gambit Targeting Program',
    description:
      'Deploy aurora-traced targeting crystals that extend volley range and sharpen accuracy while leaving exposed marksmen brittle to counter-fire.',
    cost: 70,
    resource: Resource.SAUNAKUNNIA,
    prerequisites: [],
    visuals: {
      icon: saunaRosterIcon,
      gradient: 'linear-gradient(164deg, rgba(59, 130, 246, 0.95), rgba(191, 219, 254, 0.92), rgba(30, 64, 175, 0.88))',
      accentColor: '#38bdf8',
      badges: ['Precision', 'Ranged'],
      flair: 'Frost bloom projectors bathe the firing line in refracted aurora light as icicle-laced arrows arc overhead.'
    },
    effects: [],
    unitModifiers: {
      statMultipliers: {
        attackRange: 1.35,
        defense: 0.8
      },
      hitChanceBonus: 0.3,
      damageTakenMultiplier: 1.5,
      upkeepMultiplier: 1.15
    },
    spotlight: 'Elite glacial marksmen trade armor for crystalline focus, threading volleys across the snowfield with chilling precision.',
    toggleable: true
  },
  {
    id: 'shieldwall-doctrine',
    name: 'Shieldwall Doctrine',
    description:
      'Layered steam shields harden the vanguard, absorbing blows at the cost of heartier rations.',
    cost: 55,
    resource: Resource.SAUNAKUNNIA,
    prerequisites: [],
    visuals: {
      icon: resourceIcon,
      gradient: 'linear-gradient(170deg, rgba(96, 165, 250, 0.92), rgba(59, 130, 246, 0.88))',
      accentColor: '#3b82f6',
      badges: ['Defense', 'Logistics'],
      flair: 'Glowing ward sigils shimmer across interlocked shields as steam condenses into armor.'
    },
    effects: [],
    unitModifiers: {
      statMultipliers: {
        defense: 1.3
      },
      damageTakenMultiplier: 0.85,
      upkeepDelta: 1.5
    },
    spotlight: 'The sauna guard braces as one, steam-wreathed shields catching the brunt of the assault.',
    toggleable: true
  },
  {
    id: 'sauna-skin',
    name: 'Sauna Skin Plating',
    description:
      'Wrap elite defenders in shimmering sauna bark plating that halves incoming damage while tripling upkeep.',
    cost: 85,
    resource: Resource.SAUNAKUNNIA,
    prerequisites: [],
    visuals: {
      icon: saunaBeerIcon,
      gradient: 'linear-gradient(178deg, rgba(253, 186, 116, 0.96), rgba(14, 165, 233, 0.9))',
      accentColor: '#f97316',
      badges: ['Defense', 'Risk'],
      flair: 'Gilded bark plates gleam like molten copper, refracting steamlight across the shield wall.'
    },
    effects: [],
    unitModifiers: {
      damageTakenMultiplier: 0.5,
      upkeepMultiplier: 3
    },
    spotlight: 'Only the bravest sauna wardens don the scalding plates that turn aside even siege-lanced barrages.',
    toggleable: true
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
