import { Resource } from '../../core/GameState.ts';
import type { ObjectiveResolution } from '../../progression/objectives.ts';

export interface EndScreenOptions {
  container: HTMLElement | null;
  resolution: ObjectiveResolution;
  currentNgPlusLevel: number;
  onNewRun: () => void;
  onDismiss?: () => void;
  resourceLabels?: Record<Resource, string>;
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
      return 'The sacred sauna collapses under the final assault, its steam forever stilled.';
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
  const { container, resolution, onNewRun, onDismiss, currentNgPlusLevel } = options;
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

  const badgeRow = document.createElement('div');
  badgeRow.className = 'end-screen__badges';

  const badge = document.createElement('span');
  badge.className = 'end-screen__badge';
  badge.textContent = `NG+ ${Math.max(0, currentNgPlusLevel)}`;
  badgeRow.append(badge);

  const rewardHeading = document.createElement('h3');
  rewardHeading.className = 'end-screen__section-title';
  rewardHeading.textContent = 'Rewards';

  const rewards = buildRewardList(resolution, labels);

  const actions = document.createElement('div');
  actions.className = 'end-screen__actions';

  const newRunButton = document.createElement('button');
  newRunButton.type = 'button';
  newRunButton.className = 'end-screen__button end-screen__button--primary';
  newRunButton.textContent = 'New run (NG+)';
  newRunButton.addEventListener('click', () => {
    onNewRun();
  });

  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.className = 'end-screen__button';
  dismissButton.textContent = 'Review battlefield';
  dismissButton.addEventListener('click', () => {
    onDismiss?.();
  });

  actions.append(newRunButton, dismissButton);

  panel.append(title, subtitle, badgeRow, metrics, rewardHeading, rewards, actions);
  overlay.append(panel);
  container.append(overlay);

  const releaseTrap = createFocusTrap(overlay, panel, onDismiss);

  const destroy = (): void => {
    releaseTrap();
    overlay.remove();
  };

  const focusPrimary = (): void => {
    requestAnimationFrame(() => {
      newRunButton.focus({ preventScroll: true });
    });
  };

  focusPrimary();

  return { destroy, focusPrimary };
}

