import { eventBus } from '../events';
import { setMuted, isMuted } from '../sfx.ts';
import { GameState, Resource } from '../core/GameState.ts';
import { ensureHudLayout } from './layout.ts';

type Badge = {
  container: HTMLDivElement;
  value: HTMLSpanElement;
  delta: HTMLSpanElement;
};

type TopbarIcons = {
  saunakunnia?: string;
  sisu?: string;
  gold?: string;
  sound?: string;
};

function createBadge(label: string, iconSrc?: string): Badge {
  const container = document.createElement('div');
  container.classList.add('topbar-badge');

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
  textWrapper.appendChild(valueSpan);

  const deltaSpan = document.createElement('span');
  deltaSpan.classList.add('badge-delta');
  deltaSpan.style.opacity = '0';
  deltaSpan.style.transform = 'translateY(-6px)';
  deltaSpan.style.transition = 'opacity 0.5s ease, transform 0.5s ease';

  container.append(textWrapper, deltaSpan);

  return { container, value: valueSpan, delta: deltaSpan };
}

export function setupTopbar(state: GameState, icons: TopbarIcons = {}): (deltaMs: number) => void {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) return () => {};

  const { actions } = ensureHudLayout(overlay);

  const bar = document.createElement('div');
  bar.id = 'topbar';
  actions.prepend(bar);

  const saunakunnia = createBadge('Saunakunnia', icons.saunakunnia);
  saunakunnia.container.classList.add('badge-sauna');
  const sisu = createBadge('SISU🔥', icons.sisu);
  sisu.container.classList.add('badge-sisu');
  sisu.container.style.display = 'none';
  const gold = createBadge('Gold', icons.gold);
  gold.container.classList.add('badge-gold');
  const time = createBadge('Time');
  time.container.classList.add('badge-time');
  time.delta.style.display = 'none';

  bar.appendChild(saunakunnia.container);
  bar.appendChild(sisu.container);
  bar.appendChild(gold.container);
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

  gold.value.textContent = String(state.getResource(Resource.GOLD));

  const badges: Record<string, Badge> = {
    saunakunnia,
    sisu,
    gold
  };

  eventBus.on('resourceChanged', ({ resource, amount, total }) => {
    const badge = badges[resource];
    if (!badge) return;
    badge.value.textContent = String(total);
    const sign = amount > 0 ? '+' : '';
    badge.delta.textContent = `${sign}${amount}`;
    badge.delta.style.opacity = '1';
    badge.delta.style.transform = 'translateY(0)';
    setTimeout(() => {
      badge.delta.style.opacity = '0';
      badge.delta.style.transform = 'translateY(-6px)';
    }, 1000);
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
