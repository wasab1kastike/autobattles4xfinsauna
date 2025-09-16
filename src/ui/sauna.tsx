import type { Sauna } from '../sim/sauna.ts';
import { ensureHudLayout } from './layout.ts';

export function setupSaunaUI(sauna: Sauna): (dt: number) => void {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) return () => {};

  const container = document.createElement('div');
  container.classList.add('sauna-control');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Sauna \u2668\ufe0f';
  btn.classList.add('topbar-button', 'sauna-toggle');
  btn.setAttribute('aria-expanded', 'false');
  container.appendChild(btn);

  const card = document.createElement('div');
  card.classList.add('sauna-card', 'hud-card');
  card.hidden = true;

  const barContainer = document.createElement('div');
  barContainer.classList.add('sauna-progress');
  const barFill = document.createElement('div');
  barFill.classList.add('sauna-progress__fill');
  barContainer.appendChild(barFill);
  card.appendChild(barContainer);

  const label = document.createElement('label');
  label.classList.add('sauna-option');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.classList.add('sauna-option__input');
  checkbox.checked = sauna.rallyToFront;
  checkbox.addEventListener('change', () => {
    sauna.rallyToFront = checkbox.checked;
  });
  label.appendChild(checkbox);
  const labelText = document.createElement('span');
  labelText.textContent = 'Rally to Front';
  labelText.classList.add('sauna-option__label');
  label.appendChild(labelText);
  card.appendChild(label);

  container.appendChild(card);
  const { actions } = ensureHudLayout(overlay);

  const placeControl = (): boolean => {
    if (container.parentElement !== actions) {
      actions.appendChild(container);
    }
    const topbar = actions.querySelector<HTMLDivElement>('#topbar');
    if (topbar && topbar.parentElement === actions) {
      if (topbar.nextSibling !== container) {
        actions.insertBefore(container, topbar.nextSibling);
      }
      return true;
    }
    return false;
  };

  if (!placeControl()) {
    const observer = new MutationObserver(() => {
      if (placeControl()) {
        observer.disconnect();
      }
    });
    observer.observe(actions, { childList: true });
  }

  btn.addEventListener('click', () => {
    const nextHidden = !card.hidden;
    card.hidden = nextHidden;
    btn.setAttribute('aria-expanded', String(!nextHidden));
  });

  return () => {
    const progress = 1 - sauna.timer / sauna.spawnCooldown;
    barFill.style.width = `${Math.max(0, Math.min(progress, 1)) * 100}%`;
    checkbox.checked = sauna.rallyToFront;
  };
}

