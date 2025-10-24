import { describe, expect, it, vi } from 'vitest';

import {
  createSaunaShopPanel,
  type SaunaShopLootUpgradeCategoryView,
  type SaunaShopLootUpgradeView,
  type SaunaShopTierView,
  type SaunaShopViewModel
} from '../../src/ui/shop/SaunaShopPanel.tsx';
import type { SaunaTier, SaunaTierStatus } from '../../src/sauna/tiers.ts';
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

describe('SaunaShopPanel sauna tiers', () => {
  const tier: SaunaTier = {
    id: 'aurora-ward',
    name: 'Aurora Ward Gallery',
    rosterCap: 4,
    description: 'Prismatic timberwork expands the benches.',
    art: { badge: 'badge.png' },
    unlock: { type: 'artocoin', cost: 70 },
    upgrade: { type: 'saunakunnia', cost: 80 }
  };

  const buildTier = (status: Omit<SaunaTierStatus, 'tier'>): SaunaShopTierView => ({
    tier,
    status: { ...status, tier }
  });

  it('enables unlock button when artocoins cover the cost', () => {
    document.body.innerHTML = '';
    const tierView = buildTier({
      unlocked: false,
      owned: false,
      requirementLabel: 'Invest 70 artocoins — Ready to unlock',
      unlock: {
        affordable: true,
        cost: 70,
        progress: 1,
        requirementLabel: 'Invest 70 artocoins — Ready to unlock'
      },
      upgrade: {
        affordable: false,
        cost: 80,
        progress: 0,
        requirementLabel: 'Channel Saunakunnia — Need 80 more'
      }
    });

    const panel = createSaunaShopPanel({
      getViewModel: () => ({ balance: 120, tiers: [tierView], lootCategories: [] })
    });

    document.body.appendChild(panel.element);
    const card = panel.element.querySelector('[data-tier-id="aurora-ward"]');
    const button = card?.querySelector<HTMLButtonElement>('button');
    const costLabel = card?.querySelector<HTMLSpanElement>('span.text-sm');

    expect(button?.disabled).toBe(false);
    expect(button?.textContent).toContain('Unlock');
    expect(card?.getAttribute('data-state')).toBe('ready');
    expect(costLabel?.textContent).toContain('70');

    panel.destroy();
  });

  it('disables purchase button once the tier is unlocked but not yet upgraded', () => {
    document.body.innerHTML = '';
    const tierView = buildTier({
      unlocked: true,
      owned: false,
      requirementLabel: 'Channel Saunakunnia — Need 20 more',
      unlock: {
        affordable: false,
        cost: 70,
        progress: 1,
        requirementLabel: 'Invest 70 artocoins — Ready to unlock'
      },
      upgrade: {
        affordable: false,
        cost: 80,
        progress: 0.75,
        requirementLabel: 'Channel Saunakunnia — Need 20 more'
      }
    });

    const panel = createSaunaShopPanel({
      getViewModel: () => ({ balance: 40, tiers: [tierView], lootCategories: [] })
    });

    document.body.appendChild(panel.element);
    const card = panel.element.querySelector('[data-tier-id="aurora-ward"]');
    const button = card?.querySelector<HTMLButtonElement>('button');
    const costLabel = card?.querySelector<HTMLSpanElement>('span.text-sm');

    expect(button?.disabled).toBe(true);
    expect(button?.textContent).toBe('Unlocked');
    expect(card?.getAttribute('data-state')).toBe('unlocked');
    expect(costLabel?.textContent).toContain('Saunakunnia');

    panel.destroy();
  });
});
