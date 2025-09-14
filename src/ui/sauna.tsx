import type { Sauna } from '../sim/sauna.ts';

export function setupSaunaUI(sauna: Sauna): (dt: number) => void {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) return () => {};

  const btn = document.createElement('button');
  btn.textContent = 'Sauna \u2668\ufe0f';
  overlay.appendChild(btn);

  const card = document.createElement('div');
  card.style.position = 'absolute';
  card.style.left = '0';
  card.style.top = '0';
  card.style.background = 'rgba(0,0,0,0.7)';
  card.style.color = '#fff';
  card.style.padding = '8px';
  card.style.display = 'none';
  card.style.minWidth = '120px';

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
    card.style.display = card.style.display === 'none' ? 'block' : 'none';
  });

  return () => {
    const progress = 1 - sauna.timer / sauna.spawnCooldown;
    barFill.style.width = `${Math.max(0, Math.min(progress, 1)) * 100}%`;
    checkbox.checked = sauna.rallyToFront;
  };
}

