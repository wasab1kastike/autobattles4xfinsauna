import type { Sauna } from '../sim/sauna.ts';
import { ensureHudLayout } from './layout.ts';

export interface SaunaUIOptions {
  getRosterCapLimit?: () => number;
  updateMaxRosterSize?: (value: number, options?: { persist?: boolean }) => number;
}

export type SaunaUIController = {
  update(): void;
  dispose(): void;
};

export function setupSaunaUI(
  sauna: Sauna,
  options: SaunaUIOptions = {}
): SaunaUIController {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) {
    return {
      update: () => {},
      dispose: () => {}
    } satisfies SaunaUIController;
  }

  const container = document.createElement('div');
  container.classList.add('sauna-control');
  container.dataset.tutorialTarget = 'heat';

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

  const rosterContainer = document.createElement('div');
  rosterContainer.classList.add('sauna-roster');

  const rosterHeader = document.createElement('div');
  rosterHeader.classList.add('sauna-roster__header');
  const rosterTitle = document.createElement('span');
  rosterTitle.textContent = 'Roster Cap';
  rosterTitle.classList.add('sauna-roster__title');
  rosterHeader.appendChild(rosterTitle);

  const rosterValue = document.createElement('span');
  rosterValue.classList.add('sauna-roster__value');
  rosterValue.setAttribute('aria-live', 'polite');
  rosterHeader.appendChild(rosterValue);
  rosterContainer.appendChild(rosterHeader);

  const rosterDescription = document.createElement('p');
  rosterDescription.classList.add('sauna-roster__description');
  rosterDescription.textContent = 'Tune how many attendants may be active before new recruits wait in the steam.';
  rosterContainer.appendChild(rosterDescription);

  const sliderId = `sauna-roster-${Math.floor(Math.random() * 100000)}`;
  const sliderLabel = document.createElement('label');
  sliderLabel.classList.add('sauna-roster__label');
  sliderLabel.htmlFor = sliderId;
  sliderLabel.textContent = 'Active attendants';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.id = sliderId;
  slider.min = '0';
  slider.step = '1';
  slider.classList.add('sauna-roster__slider');

  const numericInput = document.createElement('input');
  numericInput.type = 'number';
  numericInput.min = '0';
  numericInput.step = '1';
  numericInput.inputMode = 'numeric';
  numericInput.classList.add('sauna-roster__number');

  const controls = document.createElement('div');
  controls.classList.add('sauna-roster__controls');
  controls.appendChild(sliderLabel);
  controls.appendChild(slider);
  controls.appendChild(numericInput);
  rosterContainer.appendChild(controls);

  card.appendChild(rosterContainer);

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

  const resolveLimit = (): number => {
    const limit = options.getRosterCapLimit?.();
    if (typeof limit === 'number' && Number.isFinite(limit)) {
      return Math.max(0, Math.floor(limit));
    }
    return Math.max(0, Math.floor(sauna.maxRosterSize));
  };

  const updateDisplay = (limit: number, value: number): void => {
    const cappedValue = Math.max(0, Math.min(limit, Math.floor(value)));
    slider.max = String(limit);
    slider.value = String(cappedValue);
    slider.setAttribute('aria-valuemax', slider.max);
    slider.setAttribute('aria-valuenow', slider.value);
    numericInput.max = String(limit);
    numericInput.value = String(cappedValue);
    rosterValue.textContent = cappedValue === 0 ? 'Paused' : `${cappedValue}`;
    rosterValue.dataset.state = cappedValue === 0 ? 'paused' : 'active';
    numericInput.setAttribute('aria-label', `Roster cap set to ${cappedValue}`);
  };

  const applyRosterCap = (raw: number, persist: boolean): number => {
    const numeric = Number(raw);
    const limit = resolveLimit();
    const normalized = Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
    let applied = Math.max(0, Math.min(limit, normalized));
    if (options.updateMaxRosterSize) {
      applied = options.updateMaxRosterSize(applied, { persist });
    } else {
      sauna.maxRosterSize = applied;
    }
    updateDisplay(limit, applied);
    return applied;
  };

  const handleSliderInput = () => {
    applyRosterCap(Number(slider.value), false);
  };
  const handleSliderCommit = () => {
    applyRosterCap(Number(slider.value), true);
  };
  slider.addEventListener('input', handleSliderInput);
  slider.addEventListener('change', handleSliderCommit);

  const commitNumeric = (persist: boolean): void => {
    applyRosterCap(Number(numericInput.value), persist);
  };
  const handleNumericInput = () => {
    commitNumeric(false);
  };
  const handleNumericCommit = () => {
    commitNumeric(true);
  };
  const handleNumericBlur = () => {
    commitNumeric(true);
  };
  numericInput.addEventListener('input', handleNumericInput);
  numericInput.addEventListener('change', handleNumericCommit);
  numericInput.addEventListener('blur', handleNumericBlur);

  applyRosterCap(sauna.maxRosterSize, false);

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

  let placementObserver: MutationObserver | null = null;
  if (!placeControl()) {
    placementObserver = new MutationObserver(() => {
      if (placeControl()) {
        placementObserver?.disconnect();
      }
    });
    placementObserver.observe(actions, { childList: true });
  }

  const handleToggle = () => {
    const nextHidden = !card.hidden;
    card.hidden = nextHidden;
    btn.setAttribute('aria-expanded', String(!nextHidden));
  };
  btn.addEventListener('click', handleToggle);

  const update = () => {
    const cooldown =
      sauna.playerSpawnCooldown > 0 ? sauna.playerSpawnCooldown : 1;
    const progress = 1 - sauna.playerSpawnTimer / cooldown;
    barFill.style.width = `${Math.max(0, Math.min(progress, 1)) * 100}%`;
    checkbox.checked = sauna.rallyToFront;
    const limit = resolveLimit();
    const sanitized = Math.max(0, Math.min(limit, Math.floor(sauna.maxRosterSize)));
    if (sanitized !== sauna.maxRosterSize) {
      if (options.updateMaxRosterSize) {
        const next = options.updateMaxRosterSize(sanitized, { persist: true });
        updateDisplay(limit, next);
      } else {
        sauna.maxRosterSize = sanitized;
        updateDisplay(limit, sanitized);
      }
    } else {
      updateDisplay(limit, sanitized);
    }
  };

  const dispose = () => {
    placementObserver?.disconnect();
    placementObserver = null;
    btn.removeEventListener('click', handleToggle);
    slider.removeEventListener('input', handleSliderInput);
    slider.removeEventListener('change', handleSliderCommit);
    numericInput.removeEventListener('input', handleNumericInput);
    numericInput.removeEventListener('change', handleNumericCommit);
    numericInput.removeEventListener('blur', handleNumericBlur);
    container.remove();
  };

  return {
    update,
    dispose
  } satisfies SaunaUIController;
}

