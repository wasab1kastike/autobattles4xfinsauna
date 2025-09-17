import { eventBus } from '../events';
import { setMuted, isMuted } from '../sfx.ts';
import { GameState, Resource } from '../core/GameState.ts';
import { ensureHudLayout } from './layout.ts';

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

export function setupTopbar(state: GameState, icons: TopbarIcons = {}): (deltaMs: number) => void {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) return () => {};

  const { actions } = ensureHudLayout(overlay);

  const bar = document.createElement('div');
  bar.id = 'topbar';
  actions.prepend(bar);

  const resourceDescriptions: Record<Resource, string> = {
    [Resource.SAUNA_BEER]:
      'Sauna beer stocked for construction trades and eager recruits.',
    [Resource.SAUNAKUNNIA]:
      'Saunakunnia—prestige earned from sauna rituals and triumphant battles.'
  };

  const saunakunnia = createBadge('Saunakunnia', {
    iconSrc: icons.saunakunnia,
    description: resourceDescriptions[Resource.SAUNAKUNNIA],
    srLabel: 'Saunakunnia honor'
  });
  saunakunnia.container.classList.add('badge-sauna');
  const sisu = createBadge('SISU🔥', {
    iconSrc: icons.sisu,
    srLabel: 'Sisu pulse timer'
  });
  sisu.container.classList.add('badge-sisu');
  sisu.container.style.display = 'none';
  const saunaBeer = createBadge('Sauna Beer', {
    iconSrc: icons.saunaBeer,
    description: resourceDescriptions[Resource.SAUNA_BEER],
    srLabel: 'Sauna beer reserves'
  });
  saunaBeer.container.classList.add('badge-sauna-beer');
  const time = createBadge('Time');
  time.container.classList.add('badge-time');
  time.delta.style.display = 'none';

  bar.appendChild(saunakunnia.container);
  bar.appendChild(sisu.container);
  bar.appendChild(saunaBeer.container);
  bar.appendChild(time.container);

  const sisuBtn = document.createElement('button');
  sisuBtn.type = 'button';
  sisuBtn.textContent = 'SISU';
  sisuBtn.classList.add('topbar-button', 'sisu-button');
  sisuBtn.addEventListener('click', () => {
    eventBus.emit('sisuPulse', {});
  });
  bar.appendChild(sisuBtn);

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
  bar.appendChild(muteBtn);

  eventBus.on('sisuPulseStart', ({ remaining }) => {
    sisuBtn.disabled = true;
    sisu.container.style.display = 'block';
    sisu.value.textContent = String(remaining);
  });
  eventBus.on('sisuPulseTick', ({ remaining }) => {
    sisu.value.textContent = String(remaining);
  });
  eventBus.on('sisuPulseEnd', () => {
    sisu.container.style.display = 'none';
  });
  eventBus.on('sisuCooldownEnd', () => {
    sisuBtn.disabled = false;
  });

  const numberFormatter = new Intl.NumberFormat('en-US');
  const deltaFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'exceptZero' });
  const resourceNames: Record<Resource, string> = {
    [Resource.SAUNA_BEER]: 'Sauna Beer',
    [Resource.SAUNAKUNNIA]: 'Saunakunnia'
  };
  const deltaSuffix: Record<Resource, string> = {
    [Resource.SAUNA_BEER]: '🍺',
    [Resource.SAUNAKUNNIA]: '⚜️'
  };

  const resourceBadges: Record<Resource, Badge> = {
    [Resource.SAUNA_BEER]: saunaBeer,
    [Resource.SAUNAKUNNIA]: saunakunnia
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
    return `${verb} ${magnitude} ${resourceNames[resource]}`;
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

  eventBus.on('resourceChanged', ({ resource, amount, total }) => {
    const typedResource = resource as Resource;
    if (!resourceBadges[typedResource]) {
      return;
    }
    updateResourceBadge(typedResource, total, amount);
  });

  let elapsed = 0;
  return (deltaMs: number) => {
    elapsed += deltaMs;
    const totalSeconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    time.value.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
}
