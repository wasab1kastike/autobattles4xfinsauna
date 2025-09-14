import { eventBus } from '../events';
import { setMuted, isMuted } from '../sfx.ts';
import { GameState, Resource } from '../core/GameState.ts';

type Badge = {
  container: HTMLDivElement;
  value: HTMLSpanElement;
  delta: HTMLSpanElement;
};

function createBadge(label: string): Badge {
  const container = document.createElement('div');
  container.style.position = 'relative';
  container.style.marginRight = '8px';

  const labelSpan = document.createElement('span');
  labelSpan.textContent = label + ': ';
  container.appendChild(labelSpan);

  const valueSpan = document.createElement('span');
  valueSpan.textContent = '0';
  container.appendChild(valueSpan);

  const deltaSpan = document.createElement('span');
  deltaSpan.style.position = 'absolute';
  deltaSpan.style.right = '0';
  deltaSpan.style.top = '-10px';
  deltaSpan.style.opacity = '0';
  deltaSpan.style.transition = 'opacity 0.5s';
  container.appendChild(deltaSpan);

  return { container, value: valueSpan, delta: deltaSpan };
}

export function setupTopbar(state: GameState): (deltaMs: number) => void {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) return () => {};

  const bar = document.createElement('div');
  bar.id = 'topbar';
  bar.style.display = 'flex';
  bar.style.alignItems = 'center';
  overlay.appendChild(bar);

  const saunakunnia = createBadge('Saunakunnia');
  const sisu = createBadge('SISU🔥');
  sisu.container.style.display = 'none';
  const gold = createBadge('Gold');
  const time = createBadge('Time');
  time.delta.style.display = 'none';

  bar.appendChild(saunakunnia.container);
  bar.appendChild(sisu.container);
  bar.appendChild(gold.container);
  bar.appendChild(time.container);

  const sisuBtn = document.createElement('button');
  sisuBtn.textContent = 'SISU';
  sisuBtn.addEventListener('click', () => {
    eventBus.emit('sisuPulse', {});
  });
  bar.appendChild(sisuBtn);

  const muteBtn = document.createElement('button');
  function renderMute(): void {
    muteBtn.textContent = isMuted() ? 'Unmute' : 'Mute';
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
    setTimeout(() => {
      badge.delta.style.opacity = '0';
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
