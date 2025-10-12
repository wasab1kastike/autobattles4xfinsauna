import type { EnemyScalingSummaryEntry } from '../../state/telemetry/enemyScaling.ts';

export interface EnemyScalingPanelOptions {
  readonly onRequestRefresh?: () => Promise<void> | void;
}

export interface EnemyScalingPanelController {
  render(entries: readonly EnemyScalingSummaryEntry[]): void;
  setLoading(isLoading: boolean): void;
  destroy(): void;
}

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

function formatMultiplier(value: number): string {
  if (!Number.isFinite(value)) {
    return '×0';
  }
  return `×${value.toFixed(value >= 10 ? 1 : 2)}`;
}

function formatSeconds(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '—';
  }
  if (value >= 60) {
    const minutes = Math.floor(value / 60);
    const seconds = Math.round(value % 60);
    if (seconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${seconds}s`;
  }
  const rounded = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded}s`;
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '—';
  }
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds <= 0) {
    return '—';
  }
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (seconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

function formatSince(timestamp: number, since: number | null): string | null {
  if (!since || !Number.isFinite(since)) {
    return null;
  }
  const delta = Math.max(0, Math.trunc(timestamp - since));
  if (delta <= 0) {
    return null;
  }
  return `${formatDuration(delta)} ago`;
}

export function createEnemyScalingPanel(
  container: HTMLElement,
  options: EnemyScalingPanelOptions = {}
): EnemyScalingPanelController {
  const doc = container.ownerDocument ?? document;

  const root = doc.createElement('div');
  root.className = 'panel-scaling';
  container.appendChild(root);

  const header = doc.createElement('header');
  header.className = 'panel-scaling__header';

  const heading = doc.createElement('div');
  heading.className = 'panel-scaling__heading';

  const title = doc.createElement('h3');
  title.className = 'panel-scaling__title';
  title.textContent = 'Enemy ramp diagnostics';
  heading.appendChild(title);

  const subtitle = doc.createElement('p');
  subtitle.className = 'panel-scaling__subtitle';
  subtitle.textContent = 'Telemetry snapshots from recent spawn pressure adjustments.';
  heading.appendChild(subtitle);

  header.appendChild(heading);

  const refreshButton = doc.createElement('button');
  refreshButton.type = 'button';
  refreshButton.className = 'panel-scaling__refresh';
  refreshButton.setAttribute('aria-label', 'Refresh enemy scaling telemetry');
  refreshButton.textContent = 'Refresh';
  header.appendChild(refreshButton);

  const body = doc.createElement('div');
  body.className = 'panel-scaling__body';

  const statusLine = doc.createElement('p');
  statusLine.className = 'panel-scaling__status';
  statusLine.hidden = true;
  body.appendChild(statusLine);

  const list = doc.createElement('ul');
  list.className = 'panel-scaling__list';
  body.appendChild(list);

  root.append(header, body);

  let refreshPending = false;
  const handleRefresh = async () => {
    if (refreshPending) {
      return;
    }
    refreshPending = true;
    refreshButton.disabled = true;
    try {
      const result = options.onRequestRefresh?.();
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        await result;
      }
    } finally {
      refreshPending = false;
      refreshButton.disabled = false;
    }
  };

  refreshButton.addEventListener('click', handleRefresh);

  let reduceMotionQuery: MediaQueryList | null = null;
  let detachReduceMotion: (() => void) | null = null;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = (matches: boolean) => {
      root.dataset.reducedMotion = matches ? 'true' : 'false';
    };
    apply(reduceMotionQuery.matches);
    const listener = (event: MediaQueryListEvent) => apply(event.matches);
    if (typeof reduceMotionQuery.addEventListener === 'function') {
      reduceMotionQuery.addEventListener('change', listener);
      detachReduceMotion = () => reduceMotionQuery?.removeEventListener('change', listener);
    } else if (typeof reduceMotionQuery.addListener === 'function') {
      reduceMotionQuery.addListener(listener);
      detachReduceMotion = () => reduceMotionQuery?.removeListener(listener);
    }
  }

  const render = (entries: readonly EnemyScalingSummaryEntry[]): void => {
    list.innerHTML = '';
    if (!entries || entries.length === 0) {
      statusLine.textContent =
        'No enemy scaling telemetry yet. Survive a few more waves to capture ramp diagnostics.';
      statusLine.dataset.state = 'empty';
      statusLine.hidden = false;
      return;
    }
    statusLine.hidden = true;
    statusLine.textContent = '';
    statusLine.dataset.state = '';

    const fragment = doc.createDocumentFragment();
    for (const entry of entries) {
      const item = doc.createElement('li');
      item.className = 'panel-scaling__item';
      item.dataset.stageIndex = String(Math.max(-1, entry.stageIndex));

      const card = doc.createElement('article');
      card.className = 'panel-scaling__card';

      const cardHeader = doc.createElement('div');
      cardHeader.className = 'panel-scaling__card-header';

      const stageLabel = doc.createElement('h4');
      stageLabel.className = 'panel-scaling__stage';
      stageLabel.textContent = entry.stageLabel;
      cardHeader.appendChild(stageLabel);

      const timestamp = doc.createElement('time');
      timestamp.className = 'panel-scaling__timestamp';
      const entryDate = new Date(entry.timestamp);
      timestamp.dateTime = entryDate.toISOString();
      timestamp.textContent = timeFormatter.format(entryDate);
      cardHeader.appendChild(timestamp);

      card.appendChild(cardHeader);

      const metrics = doc.createElement('dl');
      metrics.className = 'panel-scaling__metrics';

      const multiplierItem = doc.createElement('div');
      multiplierItem.className = 'panel-scaling__metric';
      const multiplierLabel = doc.createElement('dt');
      multiplierLabel.className = 'panel-scaling__metric-label';
      multiplierLabel.textContent = 'Multiplier';
      const multiplierValue = doc.createElement('dd');
      multiplierValue.className = 'panel-scaling__metric-value';
      multiplierValue.textContent = formatMultiplier(entry.multiplier);
      const multiplierDetail = doc.createElement('span');
      multiplierDetail.className = 'panel-scaling__metric-detail';
      multiplierDetail.textContent = `Peak ${formatMultiplier(entry.peakMultiplier)}`;
      multiplierValue.appendChild(multiplierDetail);
      multiplierItem.append(multiplierLabel, multiplierValue);
      metrics.appendChild(multiplierItem);

      const calmItem = doc.createElement('div');
      calmItem.className = 'panel-scaling__metric';
      const calmLabel = doc.createElement('dt');
      calmLabel.className = 'panel-scaling__metric-label';
      calmLabel.textContent = 'Calm window';
      const calmValue = doc.createElement('dd');
      calmValue.className = 'panel-scaling__metric-value';
      calmValue.textContent = formatSeconds(entry.calmSeconds);
      const calmDetail = doc.createElement('span');
      calmDetail.className = 'panel-scaling__metric-detail';
      calmDetail.textContent = `Longest ${formatDuration(entry.longestCalmMs)}`;
      calmValue.appendChild(calmDetail);
      calmItem.append(calmLabel, calmValue);
      metrics.appendChild(calmItem);

      const wipeItem = doc.createElement('div');
      wipeItem.className = 'panel-scaling__metric';
      const wipeLabel = doc.createElement('dt');
      wipeLabel.className = 'panel-scaling__metric-label';
      wipeLabel.textContent = 'Wipe recovery';
      const wipeValue = doc.createElement('dd');
      wipeValue.className = 'panel-scaling__metric-value';
      wipeValue.textContent = formatDuration(entry.longestWipeMs);
      const wipeDetail = doc.createElement('span');
      wipeDetail.className = 'panel-scaling__metric-detail';
      const sinceLabel = formatSince(entry.timestamp, entry.wipeSince);
      wipeDetail.textContent = sinceLabel ?? 'No wipes logged';
      wipeValue.appendChild(wipeDetail);
      wipeItem.append(wipeLabel, wipeValue);
      metrics.appendChild(wipeItem);

      card.appendChild(metrics);
      item.appendChild(card);
      fragment.appendChild(item);
    }

    list.appendChild(fragment);
  };

  const setLoading = (isLoading: boolean): void => {
    if (isLoading) {
      statusLine.textContent = 'Loading telemetry…';
      statusLine.dataset.state = 'loading';
      statusLine.hidden = false;
    } else if (statusLine.dataset.state === 'loading') {
      statusLine.hidden = true;
      statusLine.textContent = '';
      statusLine.dataset.state = '';
    }
  };

  return {
    render,
    setLoading,
    destroy() {
      refreshButton.removeEventListener('click', handleRefresh);
      detachReduceMotion?.();
    }
  } satisfies EnemyScalingPanelController;
}
