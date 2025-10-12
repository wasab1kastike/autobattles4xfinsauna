import { loadArtocoinBalance } from '../progression/artocoin.ts';
import {
  getPurchasedLootUpgrades,
  type LootUpgradeId
} from '../progression/lootUpgrades.ts';
import { getPurchasedSaunaTiers } from '../progression/saunaShop.ts';
import type { SaunaTierId } from '../sauna/tiers.ts';

export type SaunaShopListener = () => void;

let artocoinBalance = loadArtocoinBalance();
let artocoinsSpentThisRun = 0;
let purchasedTierIds = new Set<SaunaTierId>(getPurchasedSaunaTiers());
let purchasedLootUpgrades = new Set<LootUpgradeId>(getPurchasedLootUpgrades());
const listeners = new Set<SaunaShopListener>();

export function reloadSaunaShopState(): void {
  artocoinBalance = loadArtocoinBalance();
  purchasedTierIds = new Set(getPurchasedSaunaTiers());
  purchasedLootUpgrades = new Set(getPurchasedLootUpgrades());
  artocoinsSpentThisRun = 0;
}

export function getArtocoinBalance(): number {
  return artocoinBalance;
}

export function setArtocoinBalance(next: number): void {
  artocoinBalance = Number.isFinite(next) ? next : 0;
}

export function getPurchasedTierIds(): ReadonlySet<SaunaTierId> {
  return purchasedTierIds;
}

export function setPurchasedTierIds(tiers: Iterable<SaunaTierId>): void {
  purchasedTierIds = new Set(tiers);
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
