import { describe, expect, it, vi } from 'vitest';

import {
  createSaunaShopPanel,
  type SaunaShopLootUpgradeCategoryView,
  type SaunaShopLootUpgradeView,
  type SaunaShopViewModel
} from '../../src/ui/shop/SaunaShopPanel.tsx';
import type { PurchaseLootUpgradeResult } from '../../src/progression/lootUpgrades.ts';

const buildUpgrade = (
  override: Partial<SaunaShopLootUpgradeView> & { id: string }
): SaunaShopLootUpgradeView => ({
  id: override.id,
  title: 'Test Upgrade',
  tagline: 'Test Tagline',
  description: 'Description lorem ipsum.',
  effectSummary: 'Effect summary',
  successBlurb: 'Success blurb',
  badgeLabel: 'Badge',
  badgeGradient: 'linear-gradient(135deg,rgba(255,255,255,0.12),rgba(96,165,250,0.25))',
  accent: 'rarity',
  status: {
    owned: false,
    affordable: true,
    prerequisitesMet: true,
    cost: 500,
    requirementLabel: 'Costs 500 artocoins'
  },
  ...override,
  status: {
    owned: false,
    affordable: true,
    prerequisitesMet: true,
    cost: 500,
    requirementLabel: 'Costs 500 artocoins',
    lockedReason: undefined,
    ...override.status
  }
});

const buildViewModel = (
  upgrades: readonly SaunaShopLootUpgradeView[]
): SaunaShopViewModel => {
  const category: SaunaShopLootUpgradeCategoryView = {
    id: 'rarity',
    title: 'Rarity permits',
    description: 'Unlock higher-tier drops.',
    upgrades
  };
  return {
    balance: 1200,
    tiers: [],
    lootCategories: [category]
  } satisfies SaunaShopViewModel;
};

describe('SaunaShopPanel loot upgrades', () => {
  it('invokes loot upgrade purchase callback and emits success toast', () => {
    document.body.innerHTML = '';
    const upgrade = buildUpgrade({ id: 'lucky-incense' });
    const viewModel = buildViewModel([upgrade]);

    const onPurchaseLootUpgrade = vi
      .fn<[], PurchaseLootUpgradeResult>()
      .mockReturnValue({
        success: true,
        balance: 420,
        purchased: new Set<string>(),
        unlockedRarities: new Set<string>(),
        cost: upgrade.status.cost
      } as PurchaseLootUpgradeResult);
    const emitToast = vi.fn();

    const panel = createSaunaShopPanel({
      getViewModel: () => viewModel,
      callbacks: {
        onPurchaseLootUpgrade: (id) => onPurchaseLootUpgrade(id),
        emitToast
      }
    });

    document.body.appendChild(panel.element);

    const actionButton = panel.element.querySelector<HTMLButtonElement>(
      `[data-upgrade-id="${upgrade.id}"] button`
    );
    expect(actionButton).toBeTruthy();
    actionButton?.click();

    expect(onPurchaseLootUpgrade).toHaveBeenCalledWith('lucky-incense');
    expect(emitToast).toHaveBeenCalledWith(
      expect.stringContaining('activated'),
      'success'
    );

    panel.destroy();
  });

  it('emits informative toast when prerequisites are missing', () => {
    document.body.innerHTML = '';
    const upgrade = buildUpgrade({
      id: 'fortune-still',
      status: {
        owned: false,
        affordable: true,
        prerequisitesMet: true,
        cost: 640,
        requirementLabel: 'Costs 640 artocoins',
        lockedReason: 'Requires Lucky Incense Coils'
      }
    });
    const viewModel = buildViewModel([upgrade]);

    const onPurchaseLootUpgrade = vi
      .fn<[], PurchaseLootUpgradeResult>()
      .mockReturnValue({
        success: false,
        balance: 640,
        purchased: new Set<string>(),
        unlockedRarities: new Set<string>(),
        reason: 'prerequisite-missing',
        cost: upgrade.status.cost
      } as PurchaseLootUpgradeResult);
    const emitToast = vi.fn();

    const panel = createSaunaShopPanel({
      getViewModel: () => viewModel,
      callbacks: {
        onPurchaseLootUpgrade: (id) => onPurchaseLootUpgrade(id),
        emitToast
      }
    });

    document.body.appendChild(panel.element);

    const actionButton = panel.element.querySelector<HTMLButtonElement>(
      `[data-upgrade-id="${upgrade.id}"] button`
    );
    expect(actionButton).toBeTruthy();
    actionButton?.click();

    expect(onPurchaseLootUpgrade).toHaveBeenCalledWith('fortune-still');
    expect(emitToast).toHaveBeenCalledWith(
      expect.stringContaining('requires'),
      'info'
    );

    panel.destroy();
  });
});
