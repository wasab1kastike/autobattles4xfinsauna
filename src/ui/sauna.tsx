import type { Sauna } from '../sim/sauna.ts';

export function setupSaunaUI(sauna: Sauna): (dt: number) => void {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) return () => {};

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Sauna \u2668\ufe0f';
  btn.classList.add('topbar-button', 'sauna-button');
  btn.setAttribute('aria-expanded', 'false');

  const attachToTopbar = (): boolean => {
    const topbar = document.getElementById('topbar');
    if (!topbar) return false;
    topbar.appendChild(btn);
    return true;
  };

  if (!attachToTopbar()) {
    const observer = new MutationObserver(() => {
      if (attachToTopbar()) {
        observer.disconnect();
      }
    });
    observer.observe(overlay, { childList: true });
  }

  const card = document.createElement('div');
  const cardId = 'sauna-control-card';
  card.id = cardId;
  card.style.position = 'absolute';
  card.style.left = '0';
  card.style.top = '0';
  card.style.background = 'rgba(0,0,0,0.7)';
  card.style.color = '#fff';
  card.style.padding = '8px';
  card.style.display = 'none';
  card.style.minWidth = '120px';
  card.style.pointerEvents = 'auto';
  card.style.zIndex = '5';

  const barContainer = document.createElement('div');
  barContainer.style.height = '8px';
  barContainer.style.background = '#555';
  const barFill = document.createElement('div');
  barFill.style.height = '100%';
  barFill.style.background = '#0f0';
  barFill.style.width = '0%';
  barContainer.appendChild(barFill);
  card.appendChild(barContainer);

  const label = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = sauna.rallyToFront;
  checkbox.addEventListener('change', () => {
    sauna.rallyToFront = checkbox.checked;
  });
  label.appendChild(checkbox);
  label.appendChild(document.createTextNode(' Rally to Front'));
  card.appendChild(label);

  overlay.appendChild(card);

  btn.addEventListener('click', () => {
    const isHidden = card.style.display === 'none';
    card.style.display = isHidden ? 'block' : 'none';
    btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
  });

  btn.setAttribute('aria-controls', cardId);

  return () => {
    const progress = 1 - sauna.timer / sauna.spawnCooldown;
    barFill.style.width = `${Math.max(0, Math.min(progress, 1)) * 100}%`;
    checkbox.checked = sauna.rallyToFront;
  };
}

