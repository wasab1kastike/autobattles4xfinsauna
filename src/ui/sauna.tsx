import type { Sauna } from '../sim/sauna.ts';
import type { SaunaDamagedPayload, SaunaDestroyedPayload } from '../events/types.ts';
import {
  DEFAULT_SAUNA_TIER_ID,
  evaluateSaunaTier,
  getSaunaTier,
  listSaunaTiers,
  type SaunaTier,
  type SaunaTierContext,
  type SaunaTierId
} from '../sauna/tiers.ts';
import { ensureHudLayout, getHudOverlayElement } from './layout.ts';

export interface SaunaUIOptions {
  getActiveTierId?: () => SaunaTierId;
  setActiveTierId?: (value: SaunaTierId, options?: { persist?: boolean }) => boolean;
  upgradeTierId?: (
    value: SaunaTierId,
    options?: { persist?: boolean; activate?: boolean }
  ) => boolean;
  getTierContext?: () => SaunaTierContext;
}

const integerFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export type SaunaUIController = {
  update(): void;
  handleDamage?(payload: SaunaDamagedPayload): void;
  handleDestroyed?(payload: SaunaDestroyedPayload): void;
  dispose(): void;
};

export function setupSaunaUI(
  sauna: Sauna,
  options: SaunaUIOptions = {}
): SaunaUIController {
  const overlay = getHudOverlayElement();
  if (!overlay) {
    return {
      update: () => {},
      dispose: () => {}
    } satisfies SaunaUIController;
  }

  const container = document.createElement('div');
  container.classList.add('sauna-control');
  container.dataset.tutorialTarget = 'heat';

  const resolveActiveTierId = (): SaunaTierId => {
    const maybeId = options.getActiveTierId?.();
    return getSaunaTier(maybeId ?? DEFAULT_SAUNA_TIER_ID).id;
  };

  const resolveTierContext = (): SaunaTierContext | null => {
    const context = options.getTierContext?.();
    return context ?? null;
  };

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Sauna \u2668\ufe0f';
  btn.classList.add('topbar-button', 'sauna-toggle');
  btn.setAttribute('aria-expanded', 'false');
  container.appendChild(btn);

  const card = document.createElement('div');
  card.classList.add('sauna-card', 'hud-card');
  card.hidden = true;

  const integritySection = document.createElement('section');
  integritySection.classList.add('sauna-health');
  integritySection.dataset.tutorialTarget = 'sauna-integrity';
  const healthLabelId = `sauna-health-label-${Math.floor(Math.random() * 100000)}`;
  const healthHeader = document.createElement('div');
  healthHeader.classList.add('sauna-health__header');
  const healthTitle = document.createElement('span');
  healthTitle.id = healthLabelId;
  healthTitle.classList.add('sauna-health__title');
  healthTitle.textContent = 'Sauna Integrity';
  healthHeader.appendChild(healthTitle);
  const healthValue = document.createElement('span');
  healthValue.classList.add('sauna-health__value');
  healthValue.setAttribute('aria-live', 'polite');
  healthHeader.appendChild(healthValue);
  integritySection.appendChild(healthHeader);

  const healthBar = document.createElement('div');
  healthBar.classList.add('sauna-health__bar');
  healthBar.setAttribute('role', 'meter');
  healthBar.setAttribute('aria-valuemin', '0');
  healthBar.setAttribute('aria-labelledby', healthLabelId);
  const healthFill = document.createElement('div');
  healthFill.classList.add('sauna-health__fill');
  healthBar.appendChild(healthFill);
  integritySection.appendChild(healthBar);

  const destructionFx = document.createElement('div');
  destructionFx.classList.add('sauna-health__destruction');
  destructionFx.hidden = true;
  healthBar.appendChild(destructionFx);

  const barContainer = document.createElement('div');
  barContainer.classList.add('sauna-progress');
  const barFill = document.createElement('div');
  barFill.classList.add('sauna-progress__fill');
  barContainer.appendChild(barFill);

  card.appendChild(integritySection);
  card.appendChild(barContainer);

  const tiers = listSaunaTiers();
  type TierEntry = {
    tier: SaunaTier;
    button: HTMLButtonElement;
    fill: HTMLDivElement;
    progressLabel: HTMLSpanElement;
    requirement: HTMLSpanElement;
    handleClick: () => void;
  };
  const tierEntries = new Map<SaunaTierId, TierEntry>();

  const tierSection = document.createElement('section');
  tierSection.classList.add('sauna-tier');
  const tierHeader = document.createElement('div');
  tierHeader.classList.add('sauna-tier__header');
  const tierTitle = document.createElement('span');
  tierTitle.classList.add('sauna-tier__title');
  tierTitle.textContent = 'Premium Tiers';
  tierHeader.appendChild(tierTitle);
  const tierSubtitle = document.createElement('p');
  tierSubtitle.classList.add('sauna-tier__subtitle');
  tierSubtitle.textContent =
    'Align the löyly with your prestige to unlock lavish benches and roster headroom.';
  tierHeader.appendChild(tierSubtitle);
  tierSection.appendChild(tierHeader);

  const tierGrid = document.createElement('div');
  tierGrid.classList.add('sauna-tier__grid');
  tierSection.appendChild(tierGrid);

  for (const tier of tiers) {
    const option = document.createElement('button');
    option.type = 'button';
    option.classList.add('sauna-tier__option');
    option.dataset.tierId = tier.id;
    option.setAttribute('aria-pressed', 'false');

    const badge = document.createElement('div');
    badge.classList.add('sauna-tier__badge');
    badge.style.setProperty('--sauna-tier-badge-image', `url(${tier.art.badge})`);
    if (tier.art.glow) {
      badge.style.setProperty('--sauna-tier-glow', tier.art.glow);
    }
    option.appendChild(badge);

    const copy = document.createElement('div');
    copy.classList.add('sauna-tier__copy');
    option.appendChild(copy);

    const nameEl = document.createElement('span');
    nameEl.classList.add('sauna-tier__name');
    nameEl.textContent = tier.name;
    copy.appendChild(nameEl);

    const capEl = document.createElement('span');
    capEl.classList.add('sauna-tier__cap');
    capEl.textContent = `Cap ${tier.rosterCap}`;
    copy.appendChild(capEl);

    const descriptionEl = document.createElement('p');
    descriptionEl.classList.add('sauna-tier__description');
    descriptionEl.textContent = tier.description;
    copy.appendChild(descriptionEl);

    const progress = document.createElement('div');
    progress.classList.add('sauna-tier__progress');
    const progressFill = document.createElement('div');
    progressFill.classList.add('sauna-tier__progress-fill');
    progress.appendChild(progressFill);
    const progressLabel = document.createElement('span');
    progressLabel.classList.add('sauna-tier__progress-label');
    progress.appendChild(progressLabel);
    copy.appendChild(progress);

    const requirement = document.createElement('span');
    requirement.classList.add('sauna-tier__requirement');
    copy.appendChild(requirement);

    const entry: TierEntry = {
      tier,
      button: option,
      fill: progressFill,
      progressLabel,
      requirement,
      handleClick: () => {
        handleTierSelection(tier, entry);
      }
    } satisfies TierEntry;

    option.addEventListener('click', entry.handleClick);
    tierEntries.set(tier.id, entry);
    tierGrid.appendChild(option);
  }

  card.appendChild(tierSection);
  refreshTierDisplay();

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
  const { anchors } = ensureHudLayout(overlay);
  const topLeftCluster = anchors.topLeftCluster;

  const reduceMotionQuery =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let prefersReducedMotion = Boolean(reduceMotionQuery?.matches);

  const attachMqListener = (
    mq: MediaQueryList,
    listener: (event: MediaQueryListEvent) => void
  ): void => {
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', listener);
    } else if (typeof (mq as unknown as { addListener?: typeof listener }).addListener === 'function') {
      (mq as unknown as { addListener: typeof listener }).addListener(listener);
    }
  };

  const detachMqListener = (
    mq: MediaQueryList,
    listener: (event: MediaQueryListEvent) => void
  ): void => {
    if (typeof mq.removeEventListener === 'function') {
      mq.removeEventListener('change', listener);
    } else if (typeof (mq as unknown as { removeListener?: typeof listener }).removeListener === 'function') {
      (mq as unknown as { removeListener: typeof listener }).removeListener(listener);
    }
  };

  const handleMotionChange = (event: MediaQueryListEvent) => {
    prefersReducedMotion = Boolean(event.matches);
    integritySection.dataset.motion = prefersReducedMotion ? 'reduced' : 'full';
  };

  integritySection.dataset.motion = prefersReducedMotion ? 'reduced' : 'full';
  if (reduceMotionQuery) {
    attachMqListener(reduceMotionQuery, handleMotionChange);
  }

  function refreshTierDisplay(): void {
    const activeId = resolveActiveTierId();
    const context = resolveTierContext();
    for (const entry of tierEntries.values()) {
      const status = evaluateSaunaTier(entry.tier, context);
      let progressPercent: number;
      let progressLabel: string;
      if (!status.unlocked) {
        progressPercent = Math.round(Math.max(0, Math.min(status.unlock.progress, 1)) * 100);
        progressLabel = progressPercent >= 100 ? 'Ready to unlock' : `${progressPercent}% unlock`;
      } else if (!status.owned) {
        progressPercent = Math.round(Math.max(0, Math.min(status.upgrade.progress, 1)) * 100);
        progressLabel = progressPercent >= 100 ? 'Ready to upgrade' : `${progressPercent}% prestige`;
      } else {
        progressPercent = 100;
        progressLabel = 'Upgraded';
      }
      entry.fill.style.width = `${progressPercent}%`;
      entry.progressLabel.textContent = progressLabel;
      entry.requirement.textContent = status.requirementLabel;
      const buttonState = !status.unlocked
        ? 'locked'
        : status.owned
          ? entry.tier.id === activeId
            ? 'active'
            : 'available'
          : 'upgradable';
      entry.button.dataset.state = buttonState;
      entry.button.setAttribute('aria-pressed', entry.tier.id === activeId ? 'true' : 'false');
      entry.button.setAttribute('aria-disabled', buttonState === 'locked' ? 'true' : 'false');
    }
  }

  function handleTierSelection(tier: SaunaTier, entry: TierEntry): void {
    const status = evaluateSaunaTier(tier, resolveTierContext());
    if (!status.unlocked) {
      entry.button.classList.remove('sauna-tier__option--denied');
      void entry.button.offsetWidth;
      entry.button.classList.add('sauna-tier__option--denied');
      return;
    }
    if (!status.owned) {
      const upgraded = options.upgradeTierId?.(tier.id, { persist: true, activate: true }) ?? false;
      if (!upgraded) {
        entry.button.classList.remove('sauna-tier__option--denied');
        void entry.button.offsetWidth;
        entry.button.classList.add('sauna-tier__option--denied');
        return;
      }
      refreshTierDisplay();
      return;
    }
    options.setActiveTierId?.(tier.id, { persist: true });
    refreshTierDisplay();
  }

  const placeControl = (): boolean => {
    if (container.parentElement !== topLeftCluster) {
      topLeftCluster.appendChild(container);
    }
    const topbar = topLeftCluster.querySelector<HTMLDivElement>('#topbar');
    if (topbar && topbar.parentElement === topLeftCluster) {
      if (topbar.nextSibling !== container) {
        topLeftCluster.insertBefore(container, topbar.nextSibling);
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
    placementObserver.observe(topLeftCluster, { childList: true });
  }

  const handleToggle = () => {
    const nextHidden = !card.hidden;
    card.hidden = nextHidden;
    btn.setAttribute('aria-expanded', String(!nextHidden));
  };
  btn.addEventListener('click', handleToggle);

  const updateHealthDisplay = () => {
    const sanitizedMax = Math.max(1, Math.floor(sauna.maxHealth));
    const sanitizedCurrent = Math.max(
      0,
      Math.min(sanitizedMax, Math.floor(Number.isFinite(sauna.health) ? sauna.health : 0))
    );
    const percent = sanitizedMax > 0 ? sanitizedCurrent / sanitizedMax : 0;
    const clampedPercent = Math.max(0, Math.min(percent, 1));
    healthFill.style.width = `${clampedPercent * 100}%`;
    const formattedCurrent = integerFormatter.format(sanitizedCurrent);
    const formattedMax = integerFormatter.format(sanitizedMax);
    healthValue.textContent = `${formattedCurrent} / ${formattedMax}`;
    healthBar.setAttribute('aria-valuenow', String(sanitizedCurrent));
    healthBar.setAttribute('aria-valuemax', String(sanitizedMax));
    healthBar.setAttribute('aria-valuetext', `${formattedCurrent} of ${formattedMax} health`);
    const level = sauna.destroyed
      ? 'offline'
      : clampedPercent <= 0.2
        ? 'critical'
        : clampedPercent <= 0.55
          ? 'warning'
          : 'stable';
    healthBar.dataset.level = level;
    healthValue.dataset.state = level;
    integritySection.dataset.state = sauna.destroyed ? 'destroyed' : 'active';
  };

  const hideDestructionFx = () => {
    destructionFx.classList.remove('sauna-health__destruction--active');
    destructionFx.hidden = true;
  };

  let damageFlashTimeout: number | null = null;
  let destructionTimeout: number | null = null;

  const resetDamageFlash = () => {
    if (damageFlashTimeout !== null) {
      window.clearTimeout(damageFlashTimeout);
      damageFlashTimeout = null;
    }
    healthBar.classList.remove('sauna-health__bar--impact');
  };

  const handleDamageAnimationEnd = () => {
    healthFill.classList.remove('sauna-health__fill--damage');
  };
  healthFill.addEventListener('animationend', handleDamageAnimationEnd);

  const handleDestructionAnimationEnd = () => {
    hideDestructionFx();
  };
  destructionFx.addEventListener('animationend', handleDestructionAnimationEnd);

  const triggerDamageFlash = () => {
    resetDamageFlash();
    healthBar.classList.add('sauna-health__bar--impact');
    if (!prefersReducedMotion) {
      healthFill.classList.remove('sauna-health__fill--damage');
      void healthFill.offsetWidth;
      healthFill.classList.add('sauna-health__fill--damage');
    }
    damageFlashTimeout = window.setTimeout(() => {
      healthBar.classList.remove('sauna-health__bar--impact');
      damageFlashTimeout = null;
    }, prefersReducedMotion ? 360 : 560);
  };

  const triggerDestructionFx = () => {
    if (destructionTimeout !== null) {
      window.clearTimeout(destructionTimeout);
      destructionTimeout = null;
    }
    destructionFx.hidden = false;
    destructionFx.classList.remove('sauna-health__destruction--active');
    void destructionFx.offsetWidth;
    destructionFx.classList.add('sauna-health__destruction--active');
    destructionTimeout = window.setTimeout(() => {
      hideDestructionFx();
      destructionTimeout = null;
    }, prefersReducedMotion ? 720 : 1100);
  };

  const update = () => {
    updateHealthDisplay();
    const cooldown =
      sauna.playerSpawnCooldown > 0 ? sauna.playerSpawnCooldown : 1;
    const progress = 1 - sauna.playerSpawnTimer / cooldown;
    barFill.style.width = `${Math.max(0, Math.min(progress, 1)) * 100}%`;
    checkbox.checked = sauna.rallyToFront;
    refreshTierDisplay();
  };

  updateHealthDisplay();

  const handleDamage = (_payload: SaunaDamagedPayload) => {
    updateHealthDisplay();
    triggerDamageFlash();
  };

  const handleDestroyed = (_payload: SaunaDestroyedPayload) => {
    card.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    updateHealthDisplay();
    triggerDamageFlash();
    triggerDestructionFx();
  };

  const dispose = () => {
    placementObserver?.disconnect();
    placementObserver = null;
    btn.removeEventListener('click', handleToggle);
    if (reduceMotionQuery) {
      detachMqListener(reduceMotionQuery, handleMotionChange);
    }
    healthFill.removeEventListener('animationend', handleDamageAnimationEnd);
    destructionFx.removeEventListener('animationend', handleDestructionAnimationEnd);
    resetDamageFlash();
    if (destructionTimeout !== null) {
      window.clearTimeout(destructionTimeout);
      destructionTimeout = null;
    }
    hideDestructionFx();
    for (const entry of tierEntries.values()) {
      entry.button.removeEventListener('click', entry.handleClick);
    }
    tierEntries.clear();
    container.remove();
  };

  return {
    update,
    handleDamage,
    handleDestroyed,
    dispose
  } satisfies SaunaUIController;
}

