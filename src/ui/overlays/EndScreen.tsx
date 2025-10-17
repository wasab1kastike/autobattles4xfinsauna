import { Resource } from '../../core/GameState.ts';
import type { ObjectiveResolution } from '../../progression/objectives.ts';

export interface EndScreenRosterEntry {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly xp: number;
  readonly upkeep: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly traits?: readonly string[];
  readonly portraitUrl?: string;
}

export interface EndScreenOptions {
  container: HTMLElement | null;
  resolution: ObjectiveResolution;
  onNewRun: (selectedUnitId: string | null) => void;
  onDismiss?: () => void;
  resourceLabels?: Record<Resource, string>;
  artocoinSummary?: EndScreenArtocoinSummary;
  roster?: readonly EndScreenRosterEntry[];
}

export interface EndScreenArtocoinSummary {
  readonly balance: number;
  readonly earned: number;
  readonly spent: number;
}

export interface EndScreenController {
  destroy(): void;
  focusPrimary(): void;
}

const DEFAULT_RESOURCE_LABELS: Record<Resource, string> = {
  [Resource.SAUNA_BEER]: 'Sauna Beer',
  [Resource.SAUNAKUNNIA]: 'Saunakunnia',
  [Resource.SISU]: 'Sisu'
};

const artocoinFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const FOCUSABLE_SELECTORS =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '0:00';
  }
  const totalSeconds = Math.round(ms / 1000);
  const seconds = Math.max(0, totalSeconds % 60).toString().padStart(2, '0');
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  const hours = Math.floor(totalMinutes / 60);
  if (hours > 0) {
    return `${hours}:${minutes}:${seconds}`;
  }
  return `${totalMinutes}:${seconds}`;
}

function describeCause(resolution: ObjectiveResolution): string {
  switch (resolution.cause) {
    case 'strongholds':
      return 'All rival strongholds have fallen.';
    case 'rosterWipe':
      return 'Every attendant is down—no one remains to hold the line.';
    case 'bankruptcy':
      return 'Upkeep debts have exhausted the steam reserves.';
    case 'saunaDestroyed':
      return 'The sauna collapsed under relentless assault—the sacred steamline has fallen silent.';
    default:
      return '';
  }
}

function formatSigned(value: number): string {
  if (!Number.isFinite(value) || value === 0) {
    return '±0';
  }
  const rounded = Math.round(value * 100) / 100;
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

function buildRewardList(
  resolution: ObjectiveResolution,
  labels: Record<Resource, string>
): HTMLUListElement {
  const rewards = document.createElement('ul');
  rewards.className = 'end-screen__rewards-list';
  for (const resource of Object.values(Resource) as Resource[]) {
    const reward = resolution.rewards.resources[resource];
    if (!reward) {
      continue;
    }
    const item = document.createElement('li');
    item.className = 'end-screen__reward-item';

    const label = document.createElement('span');
    label.className = 'end-screen__reward-label';
    label.textContent = labels[resource] ?? resource;

    const value = document.createElement('span');
    value.className = 'end-screen__reward-value';
    value.textContent = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0
    }).format(Math.round(reward.final));

    const delta = document.createElement('span');
    delta.className = 'end-screen__reward-delta';
    delta.textContent = formatSigned(reward.delta);
    delta.dataset.polarity = reward.delta >= 0 ? 'positive' : 'negative';

    item.append(label, value, delta);
    rewards.append(item);
  }
  return rewards;
}

function createFocusTrap(
  overlay: HTMLElement,
  panel: HTMLElement,
  onDismiss?: () => void
): () => void {
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onDismiss?.();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
    if (focusable.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey) {
      if (active === first || !panel.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !panel.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  };

  overlay.addEventListener('keydown', handleKeyDown);
  return () => overlay.removeEventListener('keydown', handleKeyDown);
}

export function showEndScreen(options: EndScreenOptions): EndScreenController {
  const { container, resolution, onNewRun, onDismiss } = options;
  if (!container) {
    return {
      destroy() {
        /* noop */
      },
      focusPrimary() {
        /* noop */
      }
    };
  }

  const labels = { ...DEFAULT_RESOURCE_LABELS, ...(options.resourceLabels ?? {}) };
  const rosterEntries = options.roster ?? [];
  const requiresRosterSelection = rosterEntries.length > 0;
  const rosterGroupName = `end-screen-roster-${Date.now()}`;
  const rosterCardRefs = new Map<string, HTMLElement>();
  const rosterInputRefs: HTMLInputElement[] = [];
  let selectedUnitId: string | null = null;

  const overlay = document.createElement('div');
  overlay.className = 'end-screen';
  overlay.setAttribute('role', 'presentation');

  const panel = document.createElement('section');
  panel.className = 'end-screen__panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  const headingId = `end-screen-title-${Date.now()}`;
  panel.setAttribute('aria-labelledby', headingId);
  panel.tabIndex = -1;
  panel.dataset.outcome = resolution.outcome;

  const title = document.createElement('h2');
  title.className = 'end-screen__title';
  title.id = headingId;
  title.textContent = resolution.outcome === 'win' ? 'Steamforged Victory' : 'Sauna Lost';

  const subtitle = document.createElement('p');
  subtitle.className = 'end-screen__subtitle';
  subtitle.textContent = describeCause(resolution);

  const metrics = document.createElement('dl');
  metrics.className = 'end-screen__metrics';

  const metric = (label: string, value: string) => {
    const term = document.createElement('dt');
    term.textContent = label;
    term.className = 'end-screen__metric-label';
    const desc = document.createElement('dd');
    desc.textContent = value;
    desc.className = 'end-screen__metric-value';
    metrics.append(term, desc);
  };

  metric('Run time', formatDuration(resolution.durationMs));
  metric(
    'Strongholds',
    `${resolution.summary.strongholds.destroyed}/${resolution.summary.strongholds.total}`
  );
  metric('Roster losses', `${resolution.summary.roster.totalDeaths}`);
  metric('Deepest beer reserve', `${Math.round(resolution.summary.economy.worstBeer)}`);

  const artSummary = options.artocoinSummary ?? { balance: 0, earned: 0, spent: 0 };
  const artocoinSection = document.createElement('section');
  artocoinSection.className = 'end-screen__artocoin';
  const artocoinHeading = document.createElement('h3');
  artocoinHeading.className = 'end-screen__section-title';
  artocoinHeading.textContent = 'Artocoin ledger';
  const ledger = document.createElement('dl');
  ledger.className = 'end-screen__artocoin-ledger';

  const ledgerEntry = (label: string, value: number, polarity: 'positive' | 'negative' | 'neutral') => {
    const term = document.createElement('dt');
    term.className = 'end-screen__artocoin-label';
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.className = 'end-screen__artocoin-value';
    detail.dataset.polarity = polarity;
    detail.textContent = artocoinFormatter.format(Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)));
    ledger.append(term, detail);
  };

  ledgerEntry('Earned', artSummary.earned, artSummary.earned > 0 ? 'positive' : 'neutral');
  ledgerEntry('Spent', artSummary.spent, artSummary.spent > 0 ? 'negative' : 'neutral');
  ledgerEntry('Balance', artSummary.balance, 'neutral');

  artocoinSection.append(artocoinHeading, ledger);

  const rewardHeading = document.createElement('h3');
  rewardHeading.className = 'end-screen__section-title';
  rewardHeading.textContent = 'Rewards';

  const rewards = buildRewardList(resolution, labels);

  const actions = document.createElement('div');
  actions.className = 'end-screen__actions';

  const newRunButton = document.createElement('button');
  newRunButton.type = 'button';
  newRunButton.className = 'end-screen__button end-screen__button--primary';
  newRunButton.textContent = 'New run';

  const syncSelectionState = (): void => {
    const disabled = requiresRosterSelection && !selectedUnitId;
    newRunButton.disabled = disabled;
    if (disabled) {
      newRunButton.setAttribute('aria-disabled', 'true');
    } else {
      newRunButton.removeAttribute('aria-disabled');
    }
  };

  const applySelectionVisuals = (): void => {
    rosterCardRefs.forEach((card, id) => {
      card.classList.toggle('is-selected', id === selectedUnitId);
    });
  };

  const setSelectedUnit = (unitId: string | null): void => {
    selectedUnitId = unitId;
    syncSelectionState();
    applySelectionVisuals();
  };

  syncSelectionState();

  newRunButton.addEventListener('click', () => {
    if (requiresRosterSelection && !selectedUnitId) {
      return;
    }
    onNewRun(selectedUnitId);
  });

  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.className = 'end-screen__button';
  dismissButton.textContent = 'Review battlefield';
  dismissButton.addEventListener('click', () => {
    onDismiss?.();
  });

  actions.append(newRunButton, dismissButton);

  let rosterSection: HTMLElement | null = null;

  if (requiresRosterSelection) {
    rosterSection = document.createElement('section');
    rosterSection.className = 'end-screen__roster';

    const rosterHeading = document.createElement('h3');
    rosterHeading.className = 'end-screen__section-title';
    rosterHeading.textContent = 'Choose a returning attendant';

    const rosterHint = document.createElement('p');
    rosterHint.className = 'end-screen__roster-hint';
    rosterHint.textContent = 'Only one attendant can carry their experience forward. Select who endures.';

    const rosterGrid = document.createElement('div');
    rosterGrid.className = 'end-screen__roster-grid';

    for (const entry of rosterEntries) {
      const card = document.createElement('label');
      card.className = 'end-screen__roster-card';
      card.dataset.status = entry.hp > 0 ? 'ready' : 'downed';
      card.dataset.unitId = entry.id;

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = rosterGroupName;
      input.value = entry.id;
      input.className = 'end-screen__roster-radio';
      input.addEventListener('change', () => {
        if (input.checked) {
          setSelectedUnit(entry.id);
        }
      });
      input.addEventListener('focus', () => {
        card.classList.add('is-focused');
      });
      input.addEventListener('blur', () => {
        card.classList.remove('is-focused');
      });

      rosterInputRefs.push(input);
      rosterCardRefs.set(entry.id, card);

      const portrait = document.createElement('div');
      portrait.className = 'end-screen__roster-portrait';

      if (entry.portraitUrl) {
        const image = document.createElement('img');
        image.className = 'end-screen__roster-image';
        image.src = entry.portraitUrl;
        image.alt = entry.name;
        portrait.append(image);
      } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'end-screen__roster-placeholder';
        const initial = entry.name?.trim()?.charAt(0) ?? '?';
        placeholder.textContent = initial.toUpperCase();
        portrait.append(placeholder);
      }

      const status = document.createElement('span');
      status.className = 'end-screen__roster-status';
      status.dataset.state = entry.hp > 0 ? 'ready' : 'downed';
      status.textContent = entry.hp > 0 ? 'Ready' : 'Downed';
      portrait.append(status);

      const body = document.createElement('div');
      body.className = 'end-screen__roster-body';

      const name = document.createElement('div');
      name.className = 'end-screen__roster-name';
      name.textContent = entry.name;

      const meta = document.createElement('div');
      meta.className = 'end-screen__roster-meta';
      meta.textContent = `Level ${Math.max(1, Math.floor(entry.level))} • ${Math.max(0, Math.floor(entry.xp))} XP`;

      const vitals = document.createElement('div');
      vitals.className = 'end-screen__roster-vitals';
      const hp = Math.max(0, Math.round(entry.hp));
      const maxHp = Math.max(0, Math.round(entry.maxHp));
      vitals.textContent = `HP ${hp}/${maxHp} • Upkeep ${Math.max(0, Math.round(entry.upkeep))}`;

      body.append(name, meta, vitals);

      if (entry.traits && entry.traits.length > 0) {
        const traitList = document.createElement('ul');
        traitList.className = 'end-screen__roster-traits';
        for (const trait of entry.traits.slice(0, 4)) {
          const item = document.createElement('li');
          item.className = 'end-screen__roster-trait';
          item.textContent = trait;
          traitList.append(item);
        }
        body.append(traitList);
      }

      card.append(input, portrait, body);
      rosterGrid.append(card);
    }

    rosterSection.append(rosterHeading, rosterHint, rosterGrid);
    syncSelectionState();
  }

  const sections: HTMLElement[] = [
    title,
    subtitle,
    metrics,
    artocoinSection,
    rewardHeading,
    rewards
  ];

  if (rosterSection) {
    sections.push(rosterSection);
  }

  sections.push(actions);

  panel.append(...sections);
  overlay.append(panel);
  container.append(overlay);

  const releaseTrap = createFocusTrap(overlay, panel, onDismiss);

  const destroy = (): void => {
    releaseTrap();
    overlay.remove();
  };

  const focusPrimary = (): void => {
    requestAnimationFrame(() => {
      if (requiresRosterSelection && rosterInputRefs[0]) {
        rosterInputRefs[0].focus({ preventScroll: true });
        return;
      }
      newRunButton.focus({ preventScroll: true });
    });
  };

  focusPrimary();

  return { destroy, focusPrimary };
}

