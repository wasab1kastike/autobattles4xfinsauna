import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Resource, type GameState } from '../../core/GameState.ts';
import { eventBus } from '../../events';
import {
  getSisuBurstRemaining,
  isSisuBurstActive,
  SISU_BURST_COST,
  TORILLE_COST,
} from '../../sisu/burst.ts';
import { isMuted, onMuteChange, setMuted } from '../../audio/sfx.ts';
import { toggleGamePaused, isGamePaused, type GamePauseEvent } from '../../game/pause.ts';

export type ActionBarAbilityHandlers = {
  useSisuBurst?: () => boolean;
  torille?: () => boolean;
  onOpenBuildPlanner?: () => boolean | void;
};

export interface ActionBarProps {
  state: GameState;
  abilities: ActionBarAbilityHandlers;
}

type ActionKind = 'burst' | 'torille' | 'build' | 'sound' | 'pause';

type HotkeyConfig = {
  code: string;
  label: string;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  ctrl?: boolean;
};

type ActionDefinition = {
  id: ActionKind;
  icon: string;
  label: string;
  description: string;
  hotkey: HotkeyConfig;
  accent?: 'primary' | 'danger' | 'neutral';
  detail?: string;
  cost?: string;
  toggled?: boolean;
  blocked?: boolean;
  blockedReason?: string;
  interactive: boolean;
  onActivate?: () => boolean | void;
};

type FeedbackTimers = Partial<Record<ActionKind, number>>;

type BurstSnapshot = {
  active: boolean;
  remaining: number;
  status?: string;
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function matchesHotkey(event: KeyboardEvent, config: HotkeyConfig): boolean {
  if (event.code !== config.code) {
    return false;
  }
  if ((config.shift ?? false) !== event.shiftKey) {
    return false;
  }
  if ((config.alt ?? false) !== event.altKey) {
    return false;
  }
  if ((config.meta ?? false) !== event.metaKey) {
    return false;
  }
  if ((config.ctrl ?? false) !== event.ctrlKey) {
    return false;
  }
  return true;
}

function formatSeconds(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0s';
  }
  return `${Math.max(0, Math.ceil(value))}s`;
}

function useBurstState(): BurstSnapshot {
  const [snapshot, setSnapshot] = useState<BurstSnapshot>(() => {
    const active = isSisuBurstActive();
    return {
      active,
      remaining: active ? Math.ceil(getSisuBurstRemaining()) : 0,
      status: active ? 'Burst active' : undefined,
    } satisfies BurstSnapshot;
  });

  useEffect(() => {
    const handleStart = ({ remaining, status }: { remaining: number; status?: string }) => {
      setSnapshot({ active: true, remaining: Math.ceil(remaining), status });
    };
    const handleTick = ({ remaining, status }: { remaining: number; status?: string }) => {
      setSnapshot((prev) => ({
        active: true,
        remaining: Math.ceil(remaining),
        status: status ?? prev.status,
      }));
    };
    const handleEnd = () => {
      setSnapshot({ active: false, remaining: 0, status: undefined });
    };

    eventBus.on('sisuBurstStart', handleStart);
    eventBus.on('sisuBurstTick', handleTick);
    eventBus.on('sisuBurstEnd', handleEnd);

    return () => {
      eventBus.off('sisuBurstStart', handleStart);
      eventBus.off('sisuBurstTick', handleTick);
      eventBus.off('sisuBurstEnd', handleEnd);
    };
  }, []);

  return snapshot;
}

function usePauseState(): boolean {
  const [paused, setPaused] = useState<boolean>(() => isGamePaused());

  useEffect(() => {
    const handler = ({ paused: next }: GamePauseEvent) => {
      setPaused(next);
    };
    eventBus.on('game:pause-changed', handler);
    return () => {
      eventBus.off('game:pause-changed', handler);
    };
  }, []);

  return paused;
}

function preventWhenTyping(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return false;
  }
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  return false;
}

export function ActionBar({ state, abilities }: ActionBarProps): JSX.Element {
  const [sisu, setSisu] = useState<number>(() => state.getResource(Resource.SISU));
  const [muted, setMutedState] = useState<boolean>(() => isMuted());
  const [hotkey, setHotkey] = useState<ActionKind | null>(null);
  const feedbackTimers = useRef<FeedbackTimers>({});
  const [activeFeedback, setActiveFeedback] = useState<Set<ActionKind>>(() => new Set());
  const burst = useBurstState();
  const paused = usePauseState();

  const triggerFeedback = useCallback((kind: ActionKind) => {
    setActiveFeedback((prev) => {
      const next = new Set(prev);
      next.add(kind);
      return next;
    });
    const existing = feedbackTimers.current[kind];
    if (existing) {
      window.clearTimeout(existing);
    }
    feedbackTimers.current[kind] = window.setTimeout(() => {
      setActiveFeedback((prev) => {
        const next = new Set(prev);
        next.delete(kind);
        return next;
      });
      delete feedbackTimers.current[kind];
    }, 650);
  }, []);

  useEffect(() => {
    const handleResourceChange = ({
      resource,
      total,
    }: {
      resource: Resource;
      total: number;
    }) => {
      if (resource === Resource.SISU) {
        setSisu(total);
      }
    };
    eventBus.on('resourceChanged', handleResourceChange);
    return () => {
      eventBus.off('resourceChanged', handleResourceChange);
      Object.values(feedbackTimers.current).forEach((timer) => {
        if (timer) {
          window.clearTimeout(timer);
        }
      });
      feedbackTimers.current = {};
    };
  }, []);

  useEffect(() => onMuteChange(setMutedState), []);

  const useBurst = abilities.useSisuBurst;
  const callTorille = abilities.torille;
  const openBuildPlanner = abilities.onOpenBuildPlanner;

  const burstBlocked = !useBurst || burst.active || sisu < SISU_BURST_COST;
  const burstReason = !useBurst
    ? 'Burst controls offline in this build.'
    : burst.active
    ? 'Burst already surging.'
    : sisu < SISU_BURST_COST
    ? `Requires ${SISU_BURST_COST} SISU.`
    : undefined;

  const torilleBlocked = !callTorille || sisu < TORILLE_COST;
  const torilleReason = !callTorille
    ? 'Torille rally is unavailable right now.'
    : sisu < TORILLE_COST
    ? `Requires ${TORILLE_COST} SISU.`
    : undefined;

  const actionDefinitions = useMemo<ActionDefinition[]>(() => {
    const entries: ActionDefinition[] = [
      {
        id: 'burst',
        icon: '⚡️',
        label: 'Sisu Burst',
        description: 'Ignite a surge of fury and resilience across your warriors.',
        hotkey: { code: 'KeyQ', label: 'Q' },
        accent: 'primary',
        cost: `-${SISU_BURST_COST} SISU`,
        detail: burst.active
          ? `${burst.status ?? 'Burst active'} · ${formatSeconds(burst.remaining)}`
          : undefined,
        blocked: burstBlocked,
        blockedReason: burstReason,
        interactive: Boolean(useBurst),
        onActivate: () => {
          if (!useBurst) {
            return false;
          }
          return useBurst();
        },
      },
      {
        id: 'torille',
        icon: '📣',
        label: 'Torille!',
        description: 'Call every survivor home to the sauna to regroup and heal.',
        hotkey: { code: 'KeyW', label: 'W' },
        accent: 'primary',
        cost: `-${TORILLE_COST} SISU`,
        blocked: torilleBlocked,
        blockedReason: torilleReason,
        interactive: Boolean(callTorille),
        onActivate: () => {
          if (!callTorille) {
            return false;
          }
          return callTorille();
        },
      },
      {
        id: 'build',
        icon: '🛠️',
        label: 'Build',
        description: 'Draft new structures to reinforce your frontier.',
        hotkey: { code: 'KeyE', label: 'E' },
        accent: 'neutral',
        blocked: !openBuildPlanner,
        blockedReason: openBuildPlanner
          ? undefined
          : 'Construction planner will unlock in a forthcoming update.',
        interactive: Boolean(openBuildPlanner),
        onActivate: () => {
          if (!openBuildPlanner) {
            return false;
          }
          const result = openBuildPlanner();
          return result ?? true;
        },
      },
      {
        id: 'sound',
        icon: muted ? '🔇' : '🔊',
        label: muted ? 'Muted' : 'Sound',
        description: 'Toggle combat sound effects and ambience cues.',
        hotkey: { code: 'KeyR', label: 'R' },
        accent: 'neutral',
        toggled: muted,
        detail: muted ? 'Silence engaged' : 'Soundscape active',
        interactive: true,
        blocked: false,
        onActivate: () => {
          setMuted(!muted);
          setMutedState(!muted);
          return true;
        },
      },
      {
        id: 'pause',
        icon: paused ? '⏸️' : '▶️',
        label: paused ? 'Paused' : 'Pause',
        description: paused
          ? 'Time is frozen — resume when your strategy is ready.'
          : 'Freeze the battlefield to reassess and issue commands.',
        hotkey: { code: 'Space', label: 'Space' },
        accent: 'neutral',
        toggled: paused,
        detail: paused ? 'Combat frozen' : 'Time flowing',
        interactive: true,
        blocked: false,
        onActivate: () => {
          toggleGamePaused();
          return true;
        },
      },
    ];
    return entries;
  }, [
    burst.active,
    burst.remaining,
    burstBlocked,
    burstReason,
    callTorille,
    muted,
    openBuildPlanner,
    paused,
    torilleBlocked,
    torilleReason,
    useBurst,
  ]);

  const handleAction = useCallback(
    (action: ActionDefinition) => {
      if (!action.interactive) {
        triggerFeedback(action.id);
        return;
      }
      if (action.blocked) {
        triggerFeedback(action.id);
        return;
      }
      const result = action.onActivate?.();
      if (result === false) {
        triggerFeedback(action.id);
      }
    },
    [triggerFeedback],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || preventWhenTyping(event)) {
        return;
      }
      const action = actionDefinitions.find((entry) => matchesHotkey(event, entry.hotkey));
      if (!action) {
        return;
      }
      event.preventDefault();
      setHotkey(action.id);
      handleAction(action);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (preventWhenTyping(event)) {
        return;
      }
      const action = actionDefinitions.find((entry) => matchesHotkey(event, entry.hotkey));
      if (!action) {
        return;
      }
      event.preventDefault();
      setHotkey((current) => (current === action.id ? null : current));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [actionDefinitions, handleAction]);

  return (
    <div className="pointer-events-none w-full">
      <div
        className="pointer-events-auto mx-auto flex w-full max-w-4xl flex-col gap-4 rounded-[26px] border border-white/10 bg-[linear-gradient(145deg,rgba(11,17,30,0.86),rgba(6,10,18,0.92))] p-6 shadow-[0_26px_65px_rgba(6,12,24,0.6),_inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
        aria-label="Combat and systems action bar"
      >
        <div className="flex flex-wrap items-stretch justify-center gap-4">
          {actionDefinitions.map((action) => {
            const isHotkey = hotkey === action.id;
            const hasFeedback = activeFeedback.has(action.id);
            const blocked = action.blocked ?? false;
            const disabledVisual = blocked || !action.interactive;
            const showDetail = action.detail ?? action.blockedReason;

            const buttonClasses = cx(
              'group relative flex min-w-[150px] flex-1 flex-col gap-2 rounded-[20px] border border-white/10 px-5 py-4 text-left transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-0',
              'bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.22),rgba(14,25,45,0.6))] shadow-[0_18px_42px_rgba(8,25,53,0.55)]',
              action.accent === 'primary' && 'border-sky-300/40 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.32),rgba(11,22,45,0.7))]',
              action.accent === 'danger' && 'border-rose-400/45 bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.32),rgba(45,9,25,0.75))]',
              isHotkey && 'ring-2 ring-sky-300/80 ring-offset-0 translate-y-[-2px] shadow-[0_24px_48px_rgba(56,189,248,0.45)]',
              hasFeedback &&
                'animate-hud-shake after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-rose-300/45 after:bg-[radial-gradient(circle_at_center,rgba(248,113,113,0.18),rgba(248,113,113,0))] after:content-[""] after:animate-hud-pulse',
              !disabledVisual && !isHotkey && 'hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(56,189,248,0.4)]',
              disabledVisual && 'cursor-not-allowed opacity-70',
              action.toggled && 'border-sky-400/60 shadow-[0_0_36px_rgba(56,189,248,0.45)]',
            );

            return (
              <button
                key={action.id}
                type="button"
                className={buttonClasses}
                aria-pressed={action.toggled ? 'true' : undefined}
                aria-disabled={disabledVisual ? 'true' : undefined}
                data-hotkey={action.hotkey.label}
                onClick={(event) => {
                  if (disabledVisual) {
                    event.preventDefault();
                    triggerFeedback(action.id);
                    return;
                  }
                  handleAction(action);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleAction(action);
                  }
                }}
                title={cx(action.description, action.blockedReason)}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-3 text-base font-semibold uppercase tracking-[0.18em] text-slate-100">
                    <span aria-hidden="true" className="text-2xl">
                      {action.icon}
                    </span>
                    {action.label}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300/80">
                    {action.hotkey.label}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-200/80">{action.description}</p>
                <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.28em] text-slate-300/70">
                  <span>{showDetail ?? '\u200b'}</span>
                  {action.cost ? <span className="text-slate-200/90">{action.cost}</span> : <span className="opacity-0">cost</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
