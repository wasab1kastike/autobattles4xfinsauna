import { loadArtocoinBalance } from '../progression/artocoin.ts';
import {
  getPurchasedLootUpgrades,
  type LootUpgradeId
} from '../progression/lootUpgrades.ts';
import { getUnlockedSaunaTiers } from '../progression/saunaShop.ts';
import { loadSaunaSettings } from './saunaSettings.ts';
import type { SaunaTierId } from '../sauna/tiers.ts';

export type SaunaShopListener = () => void;

let artocoinBalance = loadArtocoinBalance();
let artocoinsSpentThisRun = 0;
let unlockedTierIds = new Set<SaunaTierId>(getUnlockedSaunaTiers());
let upgradedTierIds = new Set<SaunaTierId>();
let purchasedLootUpgrades = new Set<LootUpgradeId>(getPurchasedLootUpgrades());
const listeners = new Set<SaunaShopListener>();

export function reloadSaunaShopState(): void {
  artocoinBalance = loadArtocoinBalance();
  unlockedTierIds = new Set(getUnlockedSaunaTiers());
  const saunaSettings = loadSaunaSettings();
  upgradedTierIds = new Set(saunaSettings.ownedTierIds);
  purchasedLootUpgrades = new Set(getPurchasedLootUpgrades());
  artocoinsSpentThisRun = 0;
}

export function getArtocoinBalance(): number {
  return artocoinBalance;
}

export function setArtocoinBalance(next: number): void {
  artocoinBalance = Number.isFinite(next) ? next : 0;
}

export function getUnlockedTierIds(): ReadonlySet<SaunaTierId> {
  return unlockedTierIds;
}

export function setUnlockedTierIds(tiers: Iterable<SaunaTierId>): void {
  unlockedTierIds = new Set(tiers);
}

export function getUpgradedTierIds(): ReadonlySet<SaunaTierId> {
  return upgradedTierIds;
}

export function setUpgradedTierIds(tiers: Iterable<SaunaTierId>): void {
  upgradedTierIds = new Set(tiers);
}

export function getPurchasedLootUpgradeIds(): ReadonlySet<LootUpgradeId> {
  return purchasedLootUpgrades;
}

export function setPurchasedLootUpgradeIds(upgrades: Iterable<LootUpgradeId>): void {
  purchasedLootUpgrades = new Set(upgrades);
}

export function resetArtocoinSpend(): void {
  artocoinsSpentThisRun = 0;
}

export function addArtocoinSpend(amount: number): void {
  if (!Number.isFinite(amount)) {
    return;
  }
  const numeric = Math.max(0, Math.floor(amount));
  if (numeric === 0) {
    return;
  }
  artocoinsSpentThisRun = Math.max(0, artocoinsSpentThisRun + numeric);
}

export function getArtocoinsSpentThisRun(): number {
  return artocoinsSpentThisRun;
}

export function subscribeToSaunaShop(listener: SaunaShopListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifySaunaShopSubscribers(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.warn('Sauna shop listener failure', error);
    }
  }
}
