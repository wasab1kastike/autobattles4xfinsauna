import { eventBus } from '../events';
import { GameState, Resource } from '../core/GameState.ts';
import { ensureHudLayout, getHudOverlayElement } from './layout.ts';
import {
  loadArtocoinBalance,
  onArtocoinChange,
  type ArtocoinChangeEvent
} from '../progression/artocoin.ts';

type Badge = {
  container: HTMLDivElement;
  value: HTMLSpanElement;
  delta: HTMLSpanElement;
  label: string;
};

type BadgeOptions = {
  iconSrc?: string;
  description?: string;
  srLabel?: string;
};

type TopbarIcons = {
  saunakunnia?: string;
  sisu?: string;
  saunaBeer?: string;
  artocoin?: string;
};

export interface EnemyRampSummary {
  readonly stage: string;
  readonly stageIndex: number;
  readonly bundleTier: number;
  readonly multiplier: number;
  readonly cadenceSeconds: number;
  readonly effectiveDifficulty: number;
  readonly aggressionMultiplier: number;
  readonly cadenceMultiplier: number;
  readonly strengthMultiplier: number;
  readonly calmSecondsRemaining: number;
  readonly spawnCycles: number;
}

function createBadge(label: string, options: BadgeOptions = {}): Badge {
  const { iconSrc, description, srLabel } = options;
  const container = document.createElement('div');
  container.classList.add('topbar-badge');
  container.setAttribute('role', 'status');
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-atomic', 'true');

  if (iconSrc) {
    const icon = document.createElement('img');
    icon.src = iconSrc;
    icon.alt = label;
    icon.decoding = 'async';
    icon.classList.add('topbar-badge-icon');
    container.appendChild(icon);
  }

  const textWrapper = document.createElement('div');
  textWrapper.classList.add('badge-text');

  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;
  labelSpan.classList.add('badge-label');
  textWrapper.appendChild(labelSpan);

  const valueSpan = document.createElement('span');
  valueSpan.textContent = '0';
  valueSpan.classList.add('badge-value');
  valueSpan.setAttribute('aria-hidden', 'true');
  textWrapper.appendChild(valueSpan);

  const deltaSpan = document.createElement('span');
  deltaSpan.classList.add('badge-delta');
  deltaSpan.style.opacity = '0';
  deltaSpan.style.transform = 'translateY(-6px)';
  deltaSpan.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  deltaSpan.setAttribute('aria-hidden', 'true');

  container.append(textWrapper, deltaSpan);

  if (description) {
    container.title = description;
  }

  const accessibleLabel = srLabel ?? label;
  container.dataset.label = accessibleLabel;
  container.setAttribute('aria-label', `${accessibleLabel}: 0`);

  return { container, value: valueSpan, delta: deltaSpan, label: accessibleLabel };
}

export type TopbarControls = {
  update(deltaMs: number): void;
  setEnemyRampSummary(summary: EnemyRampSummary): void;
  dispose(): void;
};

export function setupTopbar(
  state: GameState,
  icons: TopbarIcons = {}
): TopbarControls {
  const overlay = getHudOverlayElement();
  if (!overlay) {
    return {
      update: () => {},
      dispose: () => {}
    };
  }

  const { anchors } = ensureHudLayout(overlay);
  const topLeftCluster = anchors.topLeftCluster;

  const bar = document.createElement('div');
  bar.id = 'topbar';
  topLeftCluster.appendChild(bar);

  const badgeRow = document.createElement('div');
  badgeRow.className = 'topbar-badge-row';
  bar.appendChild(badgeRow);

  const resourceDescriptions: Record<Resource, string> = {
    [Resource.SAUNA_BEER]:
      'Sauna beer bottles chilled for construction crews and eager recruits.',
    [Resource.SAUNAKUNNIA]:
      'Saunakunnia—prestige earned from sauna rituals and triumphant battles.',
    [Resource.SISU]:
      'Sisu—the relentless grit forged when your warriors triumph on the snow.'
  };

  const saunaBeer = createBadge('Sauna Beer', {
    iconSrc: icons.saunaBeer,
    description: resourceDescriptions[Resource.SAUNA_BEER],
    srLabel: 'Sauna beer reserves'
  });
  saunaBeer.container.classList.add('badge-sauna-beer');
  const sisuResource = createBadge('Sisu', {
    iconSrc: icons.sisu,
    description: resourceDescriptions[Resource.SISU],
    srLabel: 'Sisu reserves'
  });
  sisuResource.container.classList.add('badge-sisu');
  sisuResource.container.dataset.tutorialTarget = 'sisu';
  const saunakunnia = createBadge('Saunakunnia', {
    iconSrc: icons.saunakunnia,
    description: resourceDescriptions[Resource.SAUNAKUNNIA],
    srLabel: 'Saunakunnia'
  });
  saunakunnia.container.classList.add('badge-sauna');
  saunakunnia.container.dataset.tutorialTarget = 'victory';
  const artocoinBadge = createBadge('Artocoins', {
    iconSrc: icons.artocoin,
    description: 'Artocoin treasury minted from triumphant campaigns.',
    srLabel: 'Artocoin balance'
  });
  artocoinBadge.container.classList.add('badge-artocoin');
  const time = createBadge('Time');
  time.container.classList.add('badge-time');
  time.delta.style.display = 'none';
  const enemyRamp = createBadge('Enemy Ramp', {
    srLabel: 'Enemy ramp intensity'
  });
  enemyRamp.container.classList.add('badge-ramp');
  enemyRamp.delta.style.display = 'none';
  enemyRamp.container.dataset.tutorialTarget = 'enemy-ramp';
  enemyRamp.container.title = 'Enemy ramp intensity and cadence.';

  badgeRow.appendChild(saunaBeer.container);
  badgeRow.appendChild(sisuResource.container);
  badgeRow.appendChild(saunakunnia.container);
  badgeRow.appendChild(artocoinBadge.container);
  badgeRow.appendChild(enemyRamp.container);
  badgeRow.appendChild(time.container);

  const locale = (() => {
    if (typeof navigator === 'undefined') {
      return 'en-US';
    }
    const { language } = navigator;
    return typeof language === 'string' && language.trim().length > 0 ? language : 'en-US';
  })();
  const numberFormatter = new Intl.NumberFormat(locale);
  const deltaFormatter = new Intl.NumberFormat(locale, { signDisplay: 'exceptZero' });
  const resourceNames: Record<Resource, string> = {
    [Resource.SAUNA_BEER]: 'Sauna Beer',
    [Resource.SAUNAKUNNIA]: 'Saunakunnia',
    [Resource.SISU]: 'Sisu'
  };
  const resourceUnits: Record<Resource, { singular: string; plural: string }> = {
    [Resource.SAUNA_BEER]: { singular: 'bottle', plural: 'bottles' },
    [Resource.SAUNAKUNNIA]: { singular: 'Saunakunnia', plural: 'Saunakunnia' },
    [Resource.SISU]: { singular: 'Sisu', plural: 'Sisu' }
  };
  const deltaSuffix: Record<Resource, string> = {
    [Resource.SAUNA_BEER]: '🍺',
    [Resource.SAUNAKUNNIA]: '⚜️',
    [Resource.SISU]: '🔥'
  };

  const resourceBadges: Record<Resource, Badge> = {
    [Resource.SAUNA_BEER]: saunaBeer,
    [Resource.SAUNAKUNNIA]: saunakunnia,
    [Resource.SISU]: sisuResource
  };

  const deltaTimers: Partial<Record<Resource, ReturnType<typeof setTimeout>>> = {};
  let artocoinBalanceValue = loadArtocoinBalance();
  let artocoinDeltaTimer: ReturnType<typeof setTimeout> | null = null;

  let currentRampSummary: EnemyRampSummary | null = null;

  function renderEnemyRamp(summary: EnemyRampSummary | null): void {
    currentRampSummary = summary;
    if (!summary) {
      enemyRamp.value.textContent = 'Stage 1 · ×1.00';
      enemyRamp.delta.textContent = '';
      enemyRamp.delta.style.display = 'none';
      enemyRamp.container.dataset.state = 'idle';
      enemyRamp.container.title = 'Enemy ramp idle';
      enemyRamp.container.setAttribute('aria-label', 'Enemy ramp idle.');
      return;
    }

    const stageLabel = summary.stage || `Stage ${summary.stageIndex + 1}`;
    const multiplierLabel = `×${summary.multiplier.toFixed(2)}`;
    const cadenceLabel = `${summary.cadenceSeconds.toFixed(2)}s cadence`;
    const difficultyLabel = `×${summary.effectiveDifficulty.toFixed(2)}`;
    const calmActive = summary.calmSecondsRemaining > 0.05;
    const calmLabel = calmActive
      ? `Calm remaining: ${Math.ceil(summary.calmSecondsRemaining)}s`
      : 'Calm inactive';
    enemyRamp.value.textContent = `${stageLabel} · ${multiplierLabel}`;
    enemyRamp.delta.style.display = calmActive ? '' : 'none';
    enemyRamp.delta.textContent = calmActive
      ? `Calm ${Math.ceil(summary.calmSecondsRemaining)}s`
      : '';
    enemyRamp.container.dataset.state = calmActive ? 'calm' : 'active';
    enemyRamp.container.title = [
      `Stage: ${stageLabel} (Tier ${summary.bundleTier})`,
      `Cadence: ${cadenceLabel}`,
      `Multiplier: ${multiplierLabel}`,
      `Difficulty: ${difficultyLabel}`,
      `Aggression ×${summary.aggressionMultiplier.toFixed(2)} · Cadence ×${summary.cadenceMultiplier.toFixed(2)} · Strength ×${summary.strengthMultiplier.toFixed(2)}`,
      calmLabel,
      `Spawn cycles: ${summary.spawnCycles}`
    ].join('\n');
    enemyRamp.container.setAttribute(
      'aria-label',
      [
        `Enemy ramp ${stageLabel}`,
        `Multiplier ${multiplierLabel}`,
        `Cadence ${summary.cadenceSeconds.toFixed(2)} seconds`,
        `Difficulty ${difficultyLabel}`,
        calmActive
          ? `Calm remaining ${Math.ceil(summary.calmSecondsRemaining)} seconds`
          : 'Calm inactive'
      ].join(' — ')
    );
  }

  function normalizeResourceTotal(resource: Resource, total: number): number {
    const safeTotal = Number.isFinite(total) ? total : 0;
    if (resource === Resource.SAUNA_BEER) {
      return Math.trunc(safeTotal);
    }
    return Math.max(0, Math.round(safeTotal));
  }

  function formatValue(resource: Resource, total: number): string {
    return numberFormatter.format(normalizeResourceTotal(resource, total));
  }

  function formatDelta(resource: Resource, amount: number): string {
    if (amount === 0) {
      return '';
    }
    return `${deltaFormatter.format(amount)}\u202f${deltaSuffix[resource]}`;
  }

  function describeDelta(resource: Resource, amount: number): string {
    if (amount === 0) {
      return '';
    }
    const verb = amount > 0 ? 'gained' : 'spent';
    const magnitude = numberFormatter.format(Math.abs(amount));
    const units = resourceUnits[resource];
    if (units) {
      const unitLabel = Math.abs(amount) === 1 ? units.singular : units.plural;
      const resourceLabel = resourceNames[resource];
      const detailParts = [resourceLabel];
      if (unitLabel && unitLabel !== resourceLabel) {
        detailParts.push(unitLabel);
      }
      const detailText = detailParts.filter(Boolean).join(' ');
      return `${verb} ${magnitude}${detailText ? ` ${detailText}` : ''}`;
    }
    const resourceLabel = resourceNames[resource];
    return `${verb} ${magnitude}${resourceLabel ? ` ${resourceLabel}` : ''}`;
  }

  function updateResourceBadge(resource: Resource, total: number, amount = 0): void {
    const badge = resourceBadges[resource];
    if (!badge) {
      return;
    }

    const normalizedTotal = normalizeResourceTotal(resource, total);
    const formattedValue = formatValue(resource, total);
    badge.value.textContent = formattedValue;

    const isNegativeBalance = resource === Resource.SAUNA_BEER && normalizedTotal < 0;
    badge.container.classList.toggle('topbar-badge--debt', isNegativeBalance);

    if (amount !== 0) {
      badge.delta.textContent = formatDelta(resource, amount);
      badge.delta.style.opacity = '1';
      badge.delta.style.transform = 'translateY(0)';
      const existing = deltaTimers[resource];
      if (existing) {
        clearTimeout(existing);
      }
      deltaTimers[resource] = setTimeout(() => {
        badge.delta.style.opacity = '0';
        badge.delta.style.transform = 'translateY(-6px)';
        delete deltaTimers[resource];
      }, 1000);
    } else {
      badge.delta.textContent = '';
      badge.delta.style.opacity = '0';
      badge.delta.style.transform = 'translateY(-6px)';
    }

    const announcement = describeDelta(resource, amount);
    const labelParts = [`${badge.label} ${formattedValue}`];

    if (isNegativeBalance) {
      const magnitude = numberFormatter.format(Math.abs(normalizedTotal));
      const units = resourceUnits[resource];
      if (units) {
        const unitLabel = Math.abs(normalizedTotal) === 1 ? units.singular : units.plural;
        const needsUnit = unitLabel && unitLabel !== resourceNames[resource];
        labelParts.push(
          needsUnit ? `Debt of ${magnitude} ${unitLabel}` : `Debt of ${magnitude}`
        );
      } else {
        labelParts.push(`Debt of ${magnitude}`);
      }
    }

    if (announcement) {
      labelParts.push(announcement);
    }
    badge.container.setAttribute('aria-label', labelParts.join(' — '));
  }

  function updateArtocoinBadge(total: number, amount = 0): void {
    artocoinBalanceValue = Math.max(0, Math.floor(Number.isFinite(total) ? total : 0));
    const formattedValue = numberFormatter.format(artocoinBalanceValue);
    artocoinBadge.value.textContent = formattedValue;

    if (amount !== 0) {
      artocoinBadge.delta.textContent = `${deltaFormatter.format(amount)}\u202fⒶ`;
      artocoinBadge.delta.style.opacity = '1';
      artocoinBadge.delta.style.transform = 'translateY(0)';
      if (artocoinDeltaTimer) {
        clearTimeout(artocoinDeltaTimer);
      }
      artocoinDeltaTimer = setTimeout(() => {
        artocoinBadge.delta.style.opacity = '0';
        artocoinBadge.delta.style.transform = 'translateY(-6px)';
        artocoinDeltaTimer = null;
      }, 1000);
    } else {
      artocoinBadge.delta.textContent = '';
      artocoinBadge.delta.style.opacity = '0';
      artocoinBadge.delta.style.transform = 'translateY(-6px)';
    }

    const announcement = amount === 0
      ? ''
      : amount > 0
        ? `Gained ${numberFormatter.format(amount)} artocoins`
        : `Spent ${numberFormatter.format(Math.abs(amount))} artocoins`;
    const labelParts = [`${artocoinBadge.label} ${formattedValue}`];
    if (announcement) {
      labelParts.push(announcement);
    }
    artocoinBadge.container.setAttribute('aria-label', labelParts.join(' — '));
  }

  updateResourceBadge(Resource.SAUNA_BEER, state.getResource(Resource.SAUNA_BEER));
  updateResourceBadge(
    Resource.SAUNAKUNNIA,
    state.getResource(Resource.SAUNAKUNNIA)
  );
  updateResourceBadge(Resource.SISU, state.getResource(Resource.SISU));
  updateArtocoinBadge(artocoinBalanceValue);
  renderEnemyRamp(currentRampSummary);

  const resourceChanged = ({
    resource,
    amount,
    total
  }: {
    resource: Resource;
    amount: number;
    total: number;
  }) => {
    if (!resourceBadges[resource]) {
      return;
    }
    updateResourceBadge(resource, total, amount);
  };
  eventBus.on('resourceChanged', resourceChanged);
  const artocoinChanged = (event: ArtocoinChangeEvent) => {
    updateArtocoinBadge(event.balance, event.delta);
  };
  const unsubscribeArtocoin = onArtocoinChange(artocoinChanged);

  let elapsed = 0;
  return {
    update(deltaMs: number) {
      elapsed += deltaMs;
      const totalSeconds = Math.floor(elapsed / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      time.value.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    },
    setEnemyRampSummary(summary: EnemyRampSummary) {
      renderEnemyRamp(summary);
    },
    dispose() {
      eventBus.off('resourceChanged', resourceChanged);
      Object.values(deltaTimers).forEach((timer) => {
        if (timer) {
          clearTimeout(timer);
        }
      });
      if (artocoinDeltaTimer) {
        clearTimeout(artocoinDeltaTimer);
      }
      unsubscribeArtocoin();
      bar.remove();
    }
  };
}
