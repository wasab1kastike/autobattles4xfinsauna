import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Resource } from '../core/GameState.ts';
import {
  getGameStateInstance,
  getRosterEntriesSnapshot,
  getRosterSummarySnapshot,
  getRosterCapLimit,
  getRosterCapValue,
  setRosterCapValue,
  getHudElapsedMs,
  getEnemyRampSummarySnapshot,
  getUiV2TopbarController,
  getUiV2RosterController,
  getUiV2LogController,
  getUiV2SaunaController,
} from '../game.ts';
import { LOG_EVENT_META, getLogHistory, type LogEntry } from '../ui/logging.ts';
import { setupRosterHUD, type RosterHudController } from '../ui/rosterHUD.ts';
import { uiIcons } from '../game/assets.ts';
import { createRosterPanel } from '../ui/panels/RosterPanel.tsx';
import type { RosterEntry } from '../ui/rightPanel.tsx';
import type { RosterHudSummary } from '../ui/rosterHUD.ts';
import type { EnemyRampSummary } from '../ui/topbar.ts';
import type { UiV2TopbarSnapshot } from './topbarController.ts';
import { loadArtocoinBalance } from '../progression/artocoin.ts';

const numberFormatter = new Intl.NumberFormat('en-US');
const deltaFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'exceptZero' });
const timeFormatter = new Intl.NumberFormat('en-US', {
  minimumIntegerDigits: 2,
  maximumFractionDigits: 0
});

const resourceLabels: Record<Resource, string> = {
  [Resource.SAUNA_BEER]: 'Sauna Beer',
  [Resource.SAUNAKUNNIA]: 'Saunakunnia',
  [Resource.SISU]: 'Sisu'
};

const resourceSuffix: Record<Resource, string> = {
  [Resource.SAUNA_BEER]: '🍺',
  [Resource.SAUNAKUNNIA]: '⚜️',
  [Resource.SISU]: '🔥'
};

type ResourceSnapshot = UiV2TopbarSnapshot;

type ResourceState = ResourceSnapshot['resources'];

type ArtocoinState = ResourceSnapshot['artocoin'];

function formatClock(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '00:00';
  }
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${timeFormatter.format(minutes)}:${timeFormatter.format(seconds)}`;
  }
  return `${timeFormatter.format(minutes)}:${timeFormatter.format(seconds)}`;
}

function useTopbarSnapshot(): ResourceSnapshot {
  const fallback = (): ResourceSnapshot => {
    const state = getGameStateInstance();
    return {
      resources: {
        [Resource.SAUNA_BEER]: { total: state.getResource(Resource.SAUNA_BEER), delta: 0 },
        [Resource.SAUNAKUNNIA]: { total: state.getResource(Resource.SAUNAKUNNIA), delta: 0 },
        [Resource.SISU]: { total: state.getResource(Resource.SISU), delta: 0 }
      },
      artocoin: { total: loadArtocoinBalance(), delta: 0 },
      elapsedMs: getHudElapsedMs(),
      ramp: getEnemyRampSummarySnapshot()
    } satisfies ResourceSnapshot;
  };

  const [snapshot, setSnapshot] = useState<ResourceSnapshot>(() => {
    const controller = getUiV2TopbarController();
    return controller ? controller.getSnapshot() : fallback();
  });

  useEffect(() => {
    const controller = getUiV2TopbarController();
    if (!controller) {
      return;
    }
    return controller.subscribe((state) => {
      setSnapshot(state);
    });
  }, []);

  return snapshot;
}

type RosterState = {
  summary: RosterHudSummary;
  entries: RosterEntry[];
};

function useRosterState(): RosterState {
  const [state, setState] = useState<RosterState>(() => {
    const controller = getUiV2RosterController();
    if (controller) {
      const snapshot = controller.getSnapshot();
      return { summary: snapshot.summary, entries: snapshot.entries } satisfies RosterState;
    }
    return {
      summary: getRosterSummarySnapshot(),
      entries: getRosterEntriesSnapshot()
    } satisfies RosterState;
  });

  useEffect(() => {
    const controller = getUiV2RosterController();
    if (!controller) {
      return;
    }
    return controller.subscribe((snapshot) => {
      setState({ summary: snapshot.summary, entries: snapshot.entries });
    });
  }, []);

  return state;
}

type LogState = {
  entries: LogEntry[];
};

function useLogs(): LogState {
  const [entries, setEntries] = useState<LogEntry[]>(() => {
    const controller = getUiV2LogController();
    return controller ? controller.getSnapshot() : getLogHistory();
  });

  useEffect(() => {
    const controller = getUiV2LogController();
    if (!controller) {
      return;
    }
    return controller.subscribe((next) => {
      setEntries([...next]);
    });
  }, []);

  return { entries };
}

type ResourceBadgesProps = ResourceSnapshot;

const ResourceBadges = memo(function ResourceBadges({ resources, artocoin, elapsedMs, ramp }: ResourceBadgesProps) {
  const entries = useMemo(
    () => [
      {
        id: 'sauna-beer',
        label: resourceLabels[Resource.SAUNA_BEER],
        value: resources[Resource.SAUNA_BEER].total,
        delta: resources[Resource.SAUNA_BEER].delta,
        suffix: resourceSuffix[Resource.SAUNA_BEER]
      },
      {
        id: 'sisu',
        label: resourceLabels[Resource.SISU],
        value: resources[Resource.SISU].total,
        delta: resources[Resource.SISU].delta,
        suffix: resourceSuffix[Resource.SISU]
      },
      {
        id: 'saunakunnia',
        label: resourceLabels[Resource.SAUNAKUNNIA],
        value: resources[Resource.SAUNAKUNNIA].total,
        delta: resources[Resource.SAUNAKUNNIA].delta,
        suffix: resourceSuffix[Resource.SAUNAKUNNIA]
      },
      {
        id: 'artocoin',
        label: 'Artocoins',
        value: artocoin.total,
        delta: artocoin.delta,
        suffix: 'Ⓐ'
      }
    ],
    [resources, artocoin]
  );

  return (
    <div className="flex flex-wrap gap-3">
      {entries.map((entry) => {
        const formatted = numberFormatter.format(Math.floor(entry.value));
        const delta = entry.delta !== 0 ? `${deltaFormatter.format(entry.delta)}\u202f${entry.suffix}` : '';
        const announce = delta ? `${formatted} (${delta})` : formatted;
        return (
          <article
            key={entry.id}
            className="min-w-[160px] rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm shadow-[0_10px_35px_rgba(9,14,30,0.45)] backdrop-blur"
            role="status"
            aria-live="polite"
            aria-label={`${entry.label} ${announce}`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200/80">
              {entry.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-50">
              {formatted}
              {entry.suffix && <span className="ml-1 text-lg opacity-80">{entry.suffix}</span>}
            </p>
            <p className="min-h-[1.25rem] text-xs font-medium text-sky-200/80">
              {delta}
            </p>
          </article>
        );
      })}
      <article
        className="min-w-[160px] rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm shadow-[0_10px_35px_rgba(9,14,30,0.45)] backdrop-blur"
        role="status"
        aria-live="polite"
        aria-label={`Run time ${formatClock(elapsedMs)}`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200/80">Run Time</p>
        <p className="mt-1 text-2xl font-semibold text-slate-50">{formatClock(elapsedMs)}</p>
        <p className="min-h-[1.25rem] text-xs font-medium text-slate-200/70">Active campaign</p>
      </article>
      <article
        className="min-w-[200px] rounded-2xl border border-sky-400/40 bg-sky-400/10 px-4 py-3 text-sm shadow-[0_10px_35px_rgba(16,24,48,0.55)] backdrop-blur"
        role="status"
        aria-live="polite"
        aria-label={
          ramp
            ? `Enemy ramp ${ramp.stage ?? `Stage ${ramp.stageIndex + 1}`} at multiplier ${ramp.multiplier.toFixed(2)}`
            : 'Enemy ramp idle'
        }
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200/80">Enemy Ramp</p>
        <p className="mt-1 text-lg font-semibold text-sky-100">
          {ramp ? ramp.stage ?? `Stage ${ramp.stageIndex + 1}` : 'Stage 1'}
        </p>
        <p className="text-sm font-medium text-sky-200">
          {ramp ? `×${ramp.multiplier.toFixed(2)} · ${ramp.cadenceSeconds.toFixed(1)}s cadence` : 'Calm seas'}
        </p>
        <p className="mt-1 text-xs font-medium text-sky-100/80">
          {ramp && ramp.calmSecondsRemaining > 0
            ? `Calm ${Math.ceil(ramp.calmSecondsRemaining)}s remaining`
            : 'No calm detected'}
        </p>
      </article>
    </div>
  );
});

type RosterSummaryDockProps = {
  resourceBar: HTMLElement;
  summary: RosterHudSummary;
  entries: RosterEntry[];
};

const RosterSummaryDock = memo(function RosterSummaryDock({ resourceBar, summary, entries }: RosterSummaryDockProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<RosterHudController | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    resourceBar.classList.add('ui-v2-resource-bar');
    container.appendChild(resourceBar);
    const controller = setupRosterHUD(resourceBar, {
      rosterIcon: uiIcons.saunojaRoster,
      summaryLabel: 'Saunoja Roster'
    });
    controllerRef.current = controller;
    controller.updateSummary(summary);
    controller.renderRoster(entries);
    return () => {
      const controller = controllerRef.current;
      if (controller) {
        controller.destroy();
      }
      controllerRef.current = null;
      resourceBar.replaceChildren();
      resourceBar.classList.remove('ui-v2-resource-bar');
    };
  }, [resourceBar]);

  useEffect(() => {
    controllerRef.current?.updateSummary(summary);
  }, [summary]);

  useEffect(() => {
    controllerRef.current?.renderRoster(entries);
  }, [entries]);

  return <div ref={containerRef} className="w-full" />;
});

type RosterPanelMountProps = {
  entries: RosterEntry[];
};

const RosterPanelMount = memo(function RosterPanelMount({ entries }: RosterPanelMountProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ReturnType<typeof createRosterPanel> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const panel = createRosterPanel(container, {
      getRosterCap: () => getRosterCapValue(),
      getRosterCapLimit: () => getRosterCapLimit(),
      updateMaxRosterSize: (value, options) => setRosterCapValue(value, { persist: options?.persist })
    });
    rendererRef.current = panel;
    panel.render(entries);
    return () => {
      rendererRef.current = null;
      container.innerHTML = '';
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.render(entries);
  }, [entries]);

  return <div ref={containerRef} className="min-h-[320px]" />;
});

type LogsPanelProps = {
  entries: LogEntry[];
};

const LogsPanel = memo(function LogsPanel({ entries }: LogsPanelProps) {
  const grouped = useMemo(() => entries.slice(-80), [entries]);
  return (
    <section className="flex h-full flex-col">
      <header className="mb-4 flex items-baseline justify-between">
        <h3 className="text-lg font-semibold tracking-wide text-slate-100">Combat Log</h3>
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300/70">
          {numberFormatter.format(entries.length)} entries
        </span>
      </header>
      <div
        className="flex-1 overflow-y-auto rounded-2xl border border-white/5 bg-white/5 p-4 shadow-inner shadow-black/30"
        role="log"
        aria-live="polite"
      >
        <ul className="space-y-3 text-sm">
          {grouped.length === 0 ? (
            <li className="text-slate-300/70">No dispatches yet — the steam is still warming.</li>
          ) : (
            grouped.map((entry) => {
              const meta = LOG_EVENT_META[entry.type];
              return (
                <li
                  key={entry.id}
                  className="rounded-xl border border-white/5 bg-slate-900/40 p-3 shadow-sm shadow-black/20"
                >
                  <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                    <span>{meta?.label ?? 'Dispatch'}</span>
                    <span className="text-[10px] font-semibold text-slate-400/80">
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="font-medium text-slate-100">{entry.message}</p>
                  {entry.occurrences > 1 && (
                    <p className="mt-1 text-xs font-semibold text-slate-300/70">
                      ×{entry.occurrences}
                    </p>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>
    </section>
  );
});

const SaunaControls = memo(function SaunaControls() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const controller = getUiV2SaunaController();
    if (!controller) {
      return;
    }
    controller.mount(container);
    return () => {
      controller.unmount(container);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="min-w-[240px] rounded-2xl border border-white/10 bg-white/8 p-2 shadow-[0_18px_40px_rgba(10,16,28,0.55)]"
    />
  );
});

export interface UiV2AppProps {
  resourceBar: HTMLElement;
  onReturnToClassic: () => void;
}

export function UiV2App({ resourceBar, onReturnToClassic }: UiV2AppProps) {
  const resources = useTopbarSnapshot();
  const roster = useRosterState();
  const logs = useLogs();

  return (
    <div className="pointer-events-none absolute inset-0 z-overlay flex justify-center bg-[radial-gradient(circle_at_top,rgba(14,20,34,0.96),rgba(4,6,14,0.92))]">
      <div className="pointer-events-auto flex h-full w-full max-w-7xl flex-col gap-8 px-10 py-12 text-slate-100">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-[0.12em] text-slate-100">
              Sauna Command Uplink
            </h1>
            <p className="mt-1 text-sm text-slate-300/80">
              Monitor resources, roster, and combat intelligence while the experimental HUD is active.
            </p>
          </div>
          <div className="flex flex-col items-end gap-4">
            <button
              type="button"
              data-testid="return-to-classic-hud"
              onClick={onReturnToClassic}
              className="inline-flex items-center gap-2 rounded-full border border-sky-400/60 bg-sky-500/20 px-5 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-50 shadow-[0_18px_38px_rgba(6,12,28,0.65)] transition hover:border-sky-300 hover:bg-sky-400/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            >
              Return to Classic HUD
            </button>
            <SaunaControls />
          </div>
        </header>
        <section aria-label="Resources" className="rounded-3xl border border-white/10 bg-white/8 p-6 shadow-[0_40px_90px_rgba(12,16,30,0.55)]">
          <ResourceBadges {...resources} />
        </section>
        <main className="flex min-h-0 flex-1 flex-wrap gap-6">
          <section className="flex min-h-[320px] flex-1 flex-col gap-4 rounded-3xl border border-white/10 bg-white/6 p-6 shadow-[0_30px_70px_rgba(10,12,26,0.5)]">
            <header>
              <h2 className="text-xl font-semibold tracking-wide text-slate-100">Roster Spotlight</h2>
              <p className="text-sm text-slate-300/80">
                Featured attendants and upkeep overview synced from the command relay.
              </p>
            </header>
            <RosterSummaryDock
              resourceBar={resourceBar}
              summary={roster.summary}
              entries={roster.entries}
            />
          </section>
          <aside className="flex w-full max-w-md flex-1 flex-col gap-6 lg:max-w-sm xl:max-w-md">
            <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-[0_30px_70px_rgba(10,12,26,0.5)]">
              <RosterPanelMount entries={roster.entries} />
            </div>
            <div className="flex-1 rounded-3xl border border-white/10 bg-white/6 p-6 shadow-[0_30px_70px_rgba(10,12,26,0.5)]">
              <LogsPanel entries={logs.entries} />
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
