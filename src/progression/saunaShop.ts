import type { SaunaTier, SaunaTierId } from '../sauna/tiers.ts';
import {
  loadArtocoinBalance,
  saveArtocoinBalance,
  spendArtocoins,
  type SpendArtocoinResult
} from './artocoin.ts';

export const SAUNA_SHOP_STORAGE_KEY = 'progression:sauna-shop';

type SaunaShopRecord = {
  readonly version: 1;
  readonly tiers: SaunaTierId[];
};

type SaunaShopStorage = SaunaShopRecord | { readonly tiers?: SaunaTierId[] } | null;

function getStorage(): Storage | null {
  try {
    const globalWithStorage = globalThis as typeof globalThis & {
      localStorage?: Storage;
    };
    return globalWithStorage.localStorage ?? null;
  } catch {
    return null;
  }
}

function sanitizeRecord(raw: SaunaShopStorage): SaunaShopRecord {
  if (!raw || typeof raw !== 'object') {
    return { version: 1, tiers: [] } satisfies SaunaShopRecord;
  }
  const tiers = Array.isArray(raw.tiers) ? raw.tiers.filter(Boolean) : [];
  const unique = Array.from(new Set(tiers));
  return { version: 1, tiers: unique } satisfies SaunaShopRecord;
}

function loadRecord(): SaunaShopRecord {
  const storage = getStorage();
  if (!storage) {
    return { version: 1, tiers: [] } satisfies SaunaShopRecord;
  }
  try {
    const raw = storage.getItem(SAUNA_SHOP_STORAGE_KEY);
    if (!raw) {
      return { version: 1, tiers: [] } satisfies SaunaShopRecord;
    }
    const parsed = JSON.parse(raw) as SaunaShopStorage;
    return sanitizeRecord(parsed);
  } catch (error) {
    console.warn('Failed to parse sauna shop state', error);
    return { version: 1, tiers: [] } satisfies SaunaShopRecord;
  }
}

function persistRecord(record: SaunaShopRecord): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(SAUNA_SHOP_STORAGE_KEY, JSON.stringify(record));
  } catch (error) {
    console.warn('Failed to persist sauna shop state', error);
  }
}

let purchasedTierIds = new Set<SaunaTierId>(loadRecord().tiers);

export interface SaunaShopChangeEvent {
  readonly type: 'purchase' | 'grant';
  readonly tierId: SaunaTierId;
  readonly purchased: ReadonlySet<SaunaTierId>;
  readonly spendResult?: SpendArtocoinResult;
  readonly cost?: number;
}

type SaunaShopListener = (event: SaunaShopChangeEvent) => void;

const listeners = new Set<SaunaShopListener>();

function emitChange(event: SaunaShopChangeEvent): void {
  const snapshot = new Set(purchasedTierIds);
  for (const listener of listeners) {
    try {
      listener({ ...event, purchased: snapshot });
    } catch (error) {
      console.warn('Sauna shop listener failure', error);
    }
  }
}

export function onSaunaShopChange(listener: SaunaShopListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPurchasedSaunaTiers(): ReadonlySet<SaunaTierId> {
  return new Set(purchasedTierIds);
}

function updatePurchased(set: Set<SaunaTierId>): void {
  purchasedTierIds = new Set(set);
  persistRecord({ version: 1, tiers: Array.from(purchasedTierIds) });
}

export interface PurchaseSaunaTierResult {
  readonly success: boolean;
  readonly balance: number;
  readonly purchased: ReadonlySet<SaunaTierId>;
  readonly shortfall?: number;
  readonly reason?: 'already-owned' | 'insufficient-funds' | 'unsupported';
}

export interface PurchaseSaunaTierOptions {
  readonly getCurrentBalance?: () => number;
}

function sanitizeRuntimeBalance(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(numeric));
}

function readSuppliedBalance(getter?: () => number): number | undefined {
  if (typeof getter !== 'function') {
    return undefined;
  }
  try {
    return sanitizeRuntimeBalance(getter());
  } catch (error) {
    console.warn('Failed to read supplied artocoin balance', error);
    return undefined;
  }
}

export function purchaseSaunaTier(
  tier: SaunaTier,
  options: PurchaseSaunaTierOptions = {}
): PurchaseSaunaTierResult {
  const storedBalance = loadArtocoinBalance();
  const suppliedBalance = readSuppliedBalance(options.getCurrentBalance);
  const storageAvailable = Boolean(getStorage());
  const fallbackBalance = !storageAvailable ? suppliedBalance : undefined;
  const effectiveBalance =
    typeof fallbackBalance === 'number' ? fallbackBalance : storedBalance;
  if (!tier || typeof tier !== 'object') {
    return {
      success: false,
      balance: effectiveBalance,
      purchased: getPurchasedSaunaTiers(),
      reason: 'unsupported'
    } satisfies PurchaseSaunaTierResult;
  }

  if (tier.unlock.type !== 'artocoin') {
    if (!purchasedTierIds.has(tier.id)) {
      purchasedTierIds.add(tier.id);
      updatePurchased(purchasedTierIds);
      emitChange({
        type: 'grant',
        tierId: tier.id,
        purchased: purchasedTierIds,
        cost: 0
      });
    }
    return {
      success: true,
      balance: effectiveBalance,
      purchased: getPurchasedSaunaTiers()
    } satisfies PurchaseSaunaTierResult;
  }

  if (purchasedTierIds.has(tier.id)) {
    return {
      success: false,
      balance: effectiveBalance,
      purchased: getPurchasedSaunaTiers(),
      reason: 'already-owned'
    } satisfies PurchaseSaunaTierResult;
  }

  const cost = Math.max(0, Math.floor(tier.unlock.cost));
  const metadata = { tierId: tier.id, type: 'sauna-tier' } as const;
  let spendResult: SpendArtocoinResult;
  if (cost === 0) {
    spendResult = { success: true, balance: effectiveBalance } satisfies SpendArtocoinResult;
  } else if (typeof fallbackBalance === 'number') {
    if (fallbackBalance < cost) {
      return {
        success: false,
        balance: effectiveBalance,
        purchased: getPurchasedSaunaTiers(),
        shortfall: cost - fallbackBalance,
        reason: 'insufficient-funds'
      } satisfies PurchaseSaunaTierResult;
    }
    const nextBalance = fallbackBalance - cost;
    saveArtocoinBalance(nextBalance, {
      reason: 'purchase',
      metadata,
      previousBalance: fallbackBalance
    });
    spendResult = { success: true, balance: nextBalance } satisfies SpendArtocoinResult;
  } else {
    spendResult = spendArtocoins(cost, {
      reason: 'purchase',
      metadata
    });
    if (!spendResult.success) {
      return {
        success: false,
        balance: spendResult.balance,
        purchased: getPurchasedSaunaTiers(),
        shortfall: spendResult.shortfall,
        reason: 'insufficient-funds'
      } satisfies PurchaseSaunaTierResult;
    }
  }

  purchasedTierIds.add(tier.id);
  updatePurchased(purchasedTierIds);
  emitChange({
    type: 'purchase',
    tierId: tier.id,
    purchased: purchasedTierIds,
    spendResult,
    cost
  });

  return {
    success: true,
    balance: spendResult.balance,
    purchased: getPurchasedSaunaTiers()
  } satisfies PurchaseSaunaTierResult;
}

export function grantSaunaTier(tierId: SaunaTierId): ReadonlySet<SaunaTierId> {
  if (!purchasedTierIds.has(tierId)) {
    purchasedTierIds.add(tierId);
    updatePurchased(purchasedTierIds);
    emitChange({
      type: 'grant',
      tierId,
      purchased: purchasedTierIds,
      cost: 0
    });
  }
  return getPurchasedSaunaTiers();
}
