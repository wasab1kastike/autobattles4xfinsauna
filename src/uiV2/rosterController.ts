import type { RosterHudSummary, RosterCardViewModel } from '../ui/rosterHUD.ts';
import type { RosterEntry } from '../ui/rightPanel.tsx';

export type UiV2RosterState = {
  summary: RosterHudSummary;
  entries: RosterEntry[];
};

export interface UiV2RosterController {
  getSnapshot(): UiV2RosterState;
  subscribe(listener: (state: UiV2RosterState) => void): () => void;
  dispose(): void;
}

export interface UiV2RosterControllerOptions {
  getSummary(): RosterHudSummary;
  subscribeSummary(listener: (summary: RosterHudSummary) => void): () => void;
  getEntries(): RosterEntry[];
  subscribeEntries(listener: (entries: RosterEntry[]) => void): () => void;
}

function cloneRosterCard(card: RosterCardViewModel | null): RosterCardViewModel | null {
  if (!card) {
    return null;
  }
  const { progression } = card;
  return {
    ...card,
    traits: [...card.traits],
    progression: {
      ...progression,
      statBonuses: { ...progression.statBonuses }
    }
  } satisfies RosterCardViewModel;
}

function cloneRosterHudSummary(summary: RosterHudSummary): RosterHudSummary {
  return {
    ...summary,
    card: cloneRosterCard(summary.card)
  } satisfies RosterHudSummary;
}

export function createUiV2RosterController(
  options: UiV2RosterControllerOptions
): UiV2RosterController {
  let currentSummary = cloneRosterHudSummary(options.getSummary());
  let currentEntries = [...options.getEntries()];
  const listeners = new Set<(state: UiV2RosterState) => void>();

  const emit = () => {
    const snapshot: UiV2RosterState = {
      summary: currentSummary,
      entries: [...currentEntries]
    };
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.warn('Failed to notify UI v2 roster listener', error);
      }
    }
  };

  const unsubscribeSummary = options.subscribeSummary((summary) => {
    currentSummary = cloneRosterHudSummary(summary);
    emit();
  });
  const unsubscribeEntries = options.subscribeEntries((entries) => {
    currentEntries = [...entries];
    emit();
  });

  return {
    getSnapshot(): UiV2RosterState {
      return {
        summary: currentSummary,
        entries: [...currentEntries]
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      try {
        listener(this.getSnapshot());
      } catch (error) {
        console.warn('Failed to deliver initial UI v2 roster snapshot', error);
      }
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      unsubscribeSummary();
      unsubscribeEntries();
      listeners.clear();
    }
  } satisfies UiV2RosterController;
}
