import { eventBus } from '../events';
import { setMuted, isMuted } from '../audio/sfx.ts';
import {
  getState as getAmbienceState,
  onStateChange as onAmbienceStateChange,
  play as playAmbience,
  setEnabled as setAmbienceEnabled,
  setVolume as setAmbienceVolume
} from '../audio/ambience.ts';
import { GameState, Resource } from '../core/GameState.ts';
import {
  isSisuBurstActive,
  SISU_BURST_COST,
  TORILLE_COST
} from '../sim/sisu.ts';
import { ensureHudLayout } from './layout.ts';
import { subscribeToIsMobile } from './hooks/useIsMobile.ts';

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
  sound?: string;
};

type TopbarAbilities = {
  useSisuBurst?: () => boolean;
  torille?: () => boolean;
};

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
  dispose(): void;
};

export function setupTopbar(
  state: GameState,
  icons: TopbarIcons = {},
  abilities: TopbarAbilities = {}
): TopbarControls {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) {
    return {
      update: () => {},
      dispose: () => {}
    };
  }

  const { actions, mobileBar } = ensureHudLayout(overlay);

  const bar = document.createElement('div');
  bar.id = 'topbar';
  actions.prepend(bar);

  const badgeRow = document.createElement('div');
  badgeRow.className = 'topbar-badge-row';
  bar.appendChild(badgeRow);

  const actionTray = document.createElement('div');
  actionTray.className = 'topbar-action-tray';
  actionTray.setAttribute('role', 'group');
  actionTray.setAttribute('aria-label', 'Combat and audio controls');

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
  const saunakunnia = createBadge('Saunakunnia', {
    iconSrc: icons.saunakunnia,
    description: resourceDescriptions[Resource.SAUNAKUNNIA],
    srLabel: 'Saunakunnia'
  });
  saunakunnia.container.classList.add('badge-sauna');
  const burstTimer = createBadge('Burst 🔥', {
    srLabel: 'Sisu burst countdown'
  });
  burstTimer.container.classList.add('badge-sisu');
  burstTimer.container.style.display = 'none';
  burstTimer.delta.style.display = 'none';
  const time = createBadge('Time');
  time.container.classList.add('badge-time');
  time.delta.style.display = 'none';

  badgeRow.appendChild(saunaBeer.container);
  badgeRow.appendChild(sisuResource.container);
  badgeRow.appendChild(saunakunnia.container);
  badgeRow.appendChild(burstTimer.container);
  badgeRow.appendChild(time.container);

  let burstBtn: HTMLButtonElement | null = null;
  let rallyBtn: HTMLButtonElement | null = null;

  if (abilities.useSisuBurst) {
    burstBtn = document.createElement('button');
    burstBtn.type = 'button';
    burstBtn.classList.add('topbar-button', 'sisu-button');
    burstBtn.textContent = `Sisu Burst \u2212${SISU_BURST_COST}\ud83d\udd25`;
    burstBtn.title = 'Spend SISU to ignite a short-lived surge in allied attack and movement.';
    burstBtn.addEventListener('click', () => {
      void abilities.useSisuBurst?.();
      refreshAbilityButtons();
    });
    burstBtn.classList.add('topbar-action');
    actionTray.appendChild(burstBtn);
  }

  if (abilities.torille) {
    rallyBtn = document.createElement('button');
    rallyBtn.type = 'button';
    rallyBtn.classList.add('topbar-button', 'torille-button');
    rallyBtn.textContent = `Torille! \u2212${TORILLE_COST}\ud83d\udd25`;
    rallyBtn.title = 'Call every surviving fighter back to the sauna to regroup.';
    rallyBtn.addEventListener('click', () => {
      void abilities.torille?.();
      refreshAbilityButtons();
    });
    rallyBtn.classList.add('topbar-action');
    actionTray.appendChild(rallyBtn);
  }

  function refreshAbilityButtons(): void {
    const sisuStock = state.getResource(Resource.SISU);
    if (burstBtn) {
      const canAffordBurst = sisuStock >= SISU_BURST_COST;
      const active = isSisuBurstActive();
      burstBtn.disabled = !canAffordBurst || active;
      const hints: string[] = ['Spend SISU to ignite a short-lived surge in allied attack and movement.'];
      if (!canAffordBurst) {
        hints.push(`Requires ${SISU_BURST_COST} SISU.`);
      }
      if (active) {
        hints.push('Burst already active.');
      }
      burstBtn.title = hints.join(' ');
    }
    if (rallyBtn) {
      const canAffordRally = sisuStock >= TORILLE_COST;
      rallyBtn.disabled = !canAffordRally;
      rallyBtn.title = canAffordRally
        ? 'Call every surviving fighter back to the sauna to regroup.'
        : `Requires ${TORILLE_COST} SISU to rally everyone home.`;
    }
  }

  refreshAbilityButtons();

  const muteBtn = document.createElement('button');
  muteBtn.type = 'button';
  muteBtn.title = 'Toggle sound';
  muteBtn.classList.add('topbar-button', 'sound-button');
  const muteLabel = document.createElement('span');
  muteLabel.textContent = 'Sound';

  if (icons.sound) {
    const muteIcon = document.createElement('img');
    muteIcon.src = icons.sound;
    muteIcon.alt = '';
    muteIcon.decoding = 'async';
    muteIcon.setAttribute('aria-hidden', 'true');
    muteBtn.appendChild(muteIcon);
  }

  muteBtn.appendChild(muteLabel);

  function renderMute(): void {
    const muted = isMuted();
    muteLabel.textContent = muted ? 'Muted' : 'Sound';
    muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    muteBtn.classList.toggle('is-muted', muted);
  }
  muteBtn.addEventListener('click', () => {
    setMuted(!isMuted());
    renderMute();
  });
  renderMute();
  muteBtn.classList.add('topbar-action', 'topbar-action--sound');
  actionTray.appendChild(muteBtn);

  const ambienceContainer = document.createElement('div');
  ambienceContainer.className = 'topbar-ambience';

  const ambienceHeader = document.createElement('div');
  ambienceHeader.className = 'topbar-ambience__header';

  const ambienceIcon = document.createElement('span');
  ambienceIcon.className = 'topbar-ambience__icon';
  ambienceIcon.textContent = '🌲';
  ambienceIcon.setAttribute('aria-hidden', 'true');

  const ambienceTitle = document.createElement('span');
  ambienceTitle.className = 'topbar-ambience__title';
  ambienceTitle.textContent = 'Sauna ambience';

  const ambienceToggle = document.createElement('button');
  ambienceToggle.type = 'button';
  ambienceToggle.className = 'ambience-toggle';
  ambienceToggle.setAttribute('role', 'switch');
  ambienceToggle.setAttribute('aria-label', 'Toggle sauna ambience soundscape');

  const ambienceToggleTrack = document.createElement('span');
  ambienceToggleTrack.className = 'ambience-toggle__track';
  const ambienceToggleThumb = document.createElement('span');
  ambienceToggleThumb.className = 'ambience-toggle__thumb';
  const ambienceToggleText = document.createElement('span');
  ambienceToggleText.className = 'ambience-toggle__label';
  ambienceToggle.append(ambienceToggleTrack, ambienceToggleThumb, ambienceToggleText);

  ambienceHeader.append(ambienceIcon, ambienceTitle, ambienceToggle);

  const sliderWrapper = document.createElement('div');
  sliderWrapper.className = 'topbar-ambience__slider';

  const sliderLabel = document.createElement('span');
  sliderLabel.className = 'topbar-ambience__caption';
  sliderLabel.textContent = 'Volume';

  const sliderValue = document.createElement('span');
  sliderValue.className = 'topbar-ambience__value';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '1';
  slider.className = 'topbar-ambience__range';
  slider.setAttribute('aria-label', 'Ambient volume');

  sliderWrapper.append(sliderLabel, slider, sliderValue);

  const ambienceStatus = document.createElement('p');
  ambienceStatus.className = 'topbar-ambience__status';
  ambienceStatus.setAttribute('aria-live', 'polite');

  ambienceContainer.append(ambienceHeader, sliderWrapper, ambienceStatus);
  bar.appendChild(ambienceContainer);

  const detachMobilePlacement = subscribeToIsMobile((isMobile) => {
    if (isMobile) {
      mobileBar.appendChild(actionTray);
      actionTray.classList.add('topbar-action-tray--mobile');
    } else {
      bar.appendChild(actionTray);
      actionTray.classList.remove('topbar-action-tray--mobile');
    }
  });

  let ambienceState = getAmbienceState();

  const renderAmbience = (state = ambienceState) => {
    ambienceState = state;
    const percent = Math.round(state.volume * 100);
    slider.value = String(percent);
    slider.title = `Ambient volume ${percent}%`;
    slider.style.setProperty('--value', `${percent}`);
    sliderValue.textContent = `${percent}%`;
    slider.disabled = !state.enabled || state.globallyMuted;

    ambienceToggle.setAttribute('aria-checked', state.enabled ? 'true' : 'false');
    ambienceToggle.classList.toggle('is-on', state.enabled);
    ambienceToggle.classList.toggle('is-muted', state.globallyMuted);
    ambienceToggleText.textContent = state.enabled ? 'On' : 'Off';
    ambienceToggle.title = state.enabled ? 'Disable sauna ambience' : 'Enable sauna ambience';

    ambienceContainer.classList.toggle('is-off', !state.enabled);
    ambienceContainer.classList.toggle('is-globally-muted', state.globallyMuted);

    if (state.globallyMuted) {
      ambienceStatus.textContent = 'Muted by master toggle';
    } else if (!state.enabled) {
      ambienceStatus.textContent = 'Ambience paused';
    } else if (state.playing) {
      ambienceStatus.textContent = 'Forest loop playing';
    } else {
      ambienceStatus.textContent = 'Ambience ready';
    }
  };

  ambienceToggle.addEventListener('click', () => {
    const nextEnabled = !ambienceState.enabled;
    setAmbienceEnabled(nextEnabled);
    ambienceState = getAmbienceState();
    if (nextEnabled && !ambienceState.globallyMuted) {
      void playAmbience();
    }
    renderAmbience(ambienceState);
  });

  slider.addEventListener('input', () => {
    const value = slider.valueAsNumber / 100;
    setAmbienceVolume(value);
    ambienceState = getAmbienceState();
    if (ambienceState.enabled && !ambienceState.globallyMuted) {
      void playAmbience();
    }
    renderAmbience(ambienceState);
  });

  renderAmbience(ambienceState);
  const disposeAmbienceListener = onAmbienceStateChange((state) => {
    renderAmbience(state);
  });

  function renderBurstStatus(remaining: number, status?: string): void {
    const seconds = Math.max(0, Math.ceil(remaining));
    burstTimer.container.style.display = 'block';
    burstTimer.value.textContent = String(seconds);
    if (status) {
      burstTimer.delta.style.display = 'block';
      burstTimer.delta.textContent = status;
      burstTimer.container.title = `Sisu burst active: ${status}`;
    } else {
      burstTimer.delta.style.display = 'none';
      burstTimer.delta.textContent = '';
      burstTimer.container.removeAttribute('title');
    }
    const ariaParts = [`Sisu burst active — ${seconds} seconds remaining`];
    if (status) {
      ariaParts.push(status);
    }
    burstTimer.container.setAttribute('aria-label', ariaParts.join(' — '));
  }

  const sisuBurstStart = ({ remaining, status }: { remaining: number; status?: string }) => {
    renderBurstStatus(remaining, status);
    refreshAbilityButtons();
  };
  const sisuBurstTick = ({ remaining, status }: { remaining: number; status?: string }) => {
    renderBurstStatus(remaining, status);
  };
  const sisuBurstEnd = () => {
    burstTimer.container.style.display = 'none';
    burstTimer.value.textContent = '0';
    burstTimer.delta.textContent = '';
    burstTimer.delta.style.display = 'none';
    burstTimer.container.removeAttribute('title');
    refreshAbilityButtons();
  };
  eventBus.on('sisuBurstStart', sisuBurstStart);
  eventBus.on('sisuBurstTick', sisuBurstTick);
  eventBus.on('sisuBurstEnd', sisuBurstEnd);

  const numberFormatter = new Intl.NumberFormat('en-US');
  const deltaFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'exceptZero' });
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

  function formatValue(resource: Resource, total: number): string {
    const safeTotal = Number.isFinite(total) ? total : 0;
    if (resource === Resource.SAUNA_BEER) {
      return numberFormatter.format(Math.max(0, Math.floor(safeTotal)));
    }
    return numberFormatter.format(Math.max(0, Math.round(safeTotal)));
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

    const formattedValue = formatValue(resource, total);
    badge.value.textContent = formattedValue;

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
    const labelParts = [
      `${badge.label} ${formattedValue}`,
      announcement
    ].filter(Boolean);
    badge.container.setAttribute('aria-label', labelParts.join(' — '));
  }

  updateResourceBadge(Resource.SAUNA_BEER, state.getResource(Resource.SAUNA_BEER));
  updateResourceBadge(
    Resource.SAUNAKUNNIA,
    state.getResource(Resource.SAUNAKUNNIA)
  );
  updateResourceBadge(Resource.SISU, state.getResource(Resource.SISU));

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
    if (resource === Resource.SISU) {
      refreshAbilityButtons();
    }
  };
  eventBus.on('resourceChanged', resourceChanged);

  let elapsed = 0;
  return {
    update(deltaMs: number) {
      elapsed += deltaMs;
      const totalSeconds = Math.floor(elapsed / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      time.value.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    },
    dispose() {
      eventBus.off('sisuBurstStart', sisuBurstStart);
      eventBus.off('sisuBurstTick', sisuBurstTick);
      eventBus.off('sisuBurstEnd', sisuBurstEnd);
      eventBus.off('resourceChanged', resourceChanged);
      Object.values(deltaTimers).forEach((timer) => {
        if (timer) {
          clearTimeout(timer);
        }
      });
      disposeAmbienceListener();
      detachMobilePlacement();
      actionTray.remove();
      bar.remove();
    }
  };
}
