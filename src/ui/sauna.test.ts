import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupSaunaUI } from './sauna.tsx';
import { createSauna } from '../sim/sauna.ts';
import type { Sauna } from '../sim/sauna.ts';
import { DEFAULT_SAUNA_TIER_ID } from '../sauna/tiers.ts';
import type { SaunaTierId } from '../sauna/tiers.ts';

const mockMatchMedia = () =>
  vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));

describe('setupSaunaUI', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: mockMatchMedia()
    });
  });

  afterEach(() => {
    delete (window as typeof window & { matchMedia?: unknown }).matchMedia;
    vi.useRealTimers();
  });

  const createOverlay = (): HTMLDivElement => {
    const overlay = document.createElement('div');
    overlay.id = 'ui-overlay';
    document.body.appendChild(overlay);
    return overlay;
  };

  const createTestSauna = (): Sauna => {
    const sauna = createSauna({ q: 0, r: 0 });
    sauna.playerSpawnCooldown = 5;
    sauna.playerSpawnTimer = 0;
    return sauna;
  };

  it('renders sauna health with formatted totals and accessible meter attributes', () => {
    const overlay = createOverlay();
    const sauna = createTestSauna();
    sauna.maxHealth = 600;
    sauna.health = 300;

    const controller = setupSaunaUI(sauna);

    try {
      controller.update();
      const valueEl = overlay.querySelector<HTMLSpanElement>('.sauna-health__value');
      expect(valueEl?.textContent).toBe('300 / 600');
      const fillEl = overlay.querySelector<HTMLDivElement>('.sauna-health__fill');
      expect(fillEl?.style.width).toBe('50%');
      const barEl = overlay.querySelector<HTMLDivElement>('.sauna-health__bar');
      expect(barEl?.getAttribute('aria-valuenow')).toBe('300');
      expect(barEl?.getAttribute('aria-valuemax')).toBe('600');
      expect(barEl?.getAttribute('aria-valuetext')).toBe('300 of 600 health');
      expect(barEl?.dataset.level).toBe('warning');
    } finally {
      controller.dispose();
      overlay.remove();
    }
  });

  it('flashes the health bar when sauna takes damage', () => {
    vi.useFakeTimers();
    const overlay = createOverlay();
    const sauna = createTestSauna();
    sauna.maxHealth = 450;
    sauna.health = 320;

    const controller = setupSaunaUI(sauna);

    try {
      controller.handleDamage?.({ amount: 25, remainingHealth: 295 });
      const barEl = overlay.querySelector<HTMLDivElement>('.sauna-health__bar');
      const fillEl = overlay.querySelector<HTMLDivElement>('.sauna-health__fill');
      expect(barEl?.classList.contains('sauna-health__bar--impact')).toBe(true);
      expect(fillEl?.classList.contains('sauna-health__fill--damage')).toBe(true);
      vi.runOnlyPendingTimers();
    } finally {
      controller.dispose();
      overlay.remove();
    }
  });

  it('opens the sauna card and plays destruction FX on sauna destruction', () => {
    vi.useFakeTimers();
    const overlay = createOverlay();
    const sauna = createTestSauna();
    sauna.maxHealth = 420;
    sauna.health = 0;
    sauna.destroyed = true;

    const controller = setupSaunaUI(sauna);

    try {
      controller.handleDestroyed?.({});
      const cardEl = overlay.querySelector<HTMLDivElement>('.sauna-card');
      expect(cardEl?.hidden).toBe(false);
      const barEl = overlay.querySelector<HTMLDivElement>('.sauna-health__bar');
      expect(barEl?.dataset.level).toBe('offline');
      const fxEl = overlay.querySelector<HTMLDivElement>('.sauna-health__destruction');
      expect(fxEl?.classList.contains('sauna-health__destruction--active')).toBe(true);
      vi.runOnlyPendingTimers();
    } finally {
      controller.dispose();
      overlay.remove();
    }
  });

  it('renders tier badges with unlocked states and selection affordances', () => {
    const overlay = createOverlay();
    const sauna = createTestSauna();
    let activeTierId: SaunaTierId = DEFAULT_SAUNA_TIER_ID;
    const controller = setupSaunaUI(sauna, {
      getRosterCapLimit: () => 6,
      updateMaxRosterSize: (value) => value,
      getActiveTierId: () => activeTierId,
      setActiveTierId: (tierId) => {
        activeTierId = tierId;
        return true;
      },
      getTierContext: () => ({ ngPlusLevel: 4, unlockSlots: 4 })
    });

    try {
      controller.update();
      const activeButton = overlay.querySelector<HTMLButtonElement>(
        '.sauna-tier__option[data-state="active"]'
      );
      expect(activeButton?.dataset.tierId).toBe(DEFAULT_SAUNA_TIER_ID);

      const premiumButton = overlay.querySelector<HTMLButtonElement>(
        '.sauna-tier__option[data-tier-id="mythic-conclave"]'
      );
      expect(premiumButton).toBeTruthy();
      premiumButton?.click();
      controller.update();

      expect(activeTierId).toBe('mythic-conclave');
      const updatedActive = overlay.querySelector<HTMLButtonElement>(
        '.sauna-tier__option[data-state="active"]'
      );
      expect(updatedActive?.dataset.tierId).toBe('mythic-conclave');
    } finally {
      controller.dispose();
      overlay.remove();
    }
  });

  it('communicates locked tiers with progress cues', () => {
    const overlay = createOverlay();
    const sauna = createTestSauna();
    let activeTierId: SaunaTierId = DEFAULT_SAUNA_TIER_ID;
    const controller = setupSaunaUI(sauna, {
      getActiveTierId: () => activeTierId,
      setActiveTierId: () => false,
      getTierContext: () => ({ ngPlusLevel: 0, unlockSlots: 0 })
    });

    try {
      controller.update();
      const lockedTier = overlay.querySelector<HTMLButtonElement>(
        '.sauna-tier__option[data-tier-id="mythic-conclave"]'
      );
      expect(lockedTier?.dataset.state).toBe('locked');
      lockedTier?.click();
      expect(lockedTier?.classList.contains('sauna-tier__option--denied')).toBe(true);
    } finally {
      controller.dispose();
      overlay.remove();
    }
  });

  it('limits roster controls to the baseline unlock allowance for new profiles', () => {
    const overlay = createOverlay();
    const sauna = createTestSauna();
    sauna.maxRosterSize = 0;
    const controller = setupSaunaUI(sauna, {
      getRosterCapLimit: () => 3,
      getActiveTierId: () => DEFAULT_SAUNA_TIER_ID,
      getTierContext: () => ({ ngPlusLevel: 0, unlockSlots: 0 })
    });

    try {
      controller.update();
      const slider = overlay.querySelector<HTMLInputElement>('.sauna-roster__slider');
      expect(slider?.max).toBe('3');
      const numeric = overlay.querySelector<HTMLInputElement>('.sauna-roster__number');
      expect(numeric?.max).toBe('3');
    } finally {
      controller.dispose();
      overlay.remove();
    }
  });

  it('caps roster controls by the active tier even with excess unlocks', () => {
    const overlay = createOverlay();
    const sauna = createTestSauna();
    sauna.maxRosterSize = 4;
    let activeTierId: SaunaTierId = 'aurora-ward';
    const controller = setupSaunaUI(sauna, {
      getRosterCapLimit: () => 6,
      getActiveTierId: () => activeTierId,
      setActiveTierId: (tierId) => {
        activeTierId = tierId;
        return true;
      },
      getTierContext: () => ({ ngPlusLevel: 5, unlockSlots: 5 })
    });

    try {
      controller.update();
      const slider = overlay.querySelector<HTMLInputElement>('.sauna-roster__slider');
      const numeric = overlay.querySelector<HTMLInputElement>('.sauna-roster__number');
      expect(slider?.max).toBe('4');
      expect(numeric?.max).toBe('4');

      activeTierId = DEFAULT_SAUNA_TIER_ID;
      controller.update();
      expect(slider?.max).toBe('3');
      expect(numeric?.max).toBe('3');
    } finally {
      controller.dispose();
      overlay.remove();
    }
  });
});
