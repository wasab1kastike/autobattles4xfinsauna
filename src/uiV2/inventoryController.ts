import type { SaunaShopViewModel } from '../ui/shop/SaunaShopPanel.tsx';

export interface UiV2InventorySnapshot {
  saunaShop: SaunaShopViewModel;
  useUiV2: boolean;
}

export interface UiV2InventoryController {
  getSnapshot(): UiV2InventorySnapshot;
  subscribe(listener: (snapshot: UiV2InventorySnapshot) => void): () => void;
  setUseUiV2(enabled: boolean): void;
  dispose(): void;
}

export interface UiV2InventoryControllerOptions {
  buildSaunaShopViewModel(): SaunaShopViewModel;
  subscribeToSaunaShop(listener: () => void): () => void;
  getUseUiV2(): boolean;
  setUseUiV2(enabled: boolean): void;
}

export function createUiV2InventoryController(
  options: UiV2InventoryControllerOptions
): UiV2InventoryController {
  let snapshot: UiV2InventorySnapshot = {
    saunaShop: options.buildSaunaShopViewModel(),
    useUiV2: options.getUseUiV2()
  };
  const listeners = new Set<(snapshot: UiV2InventorySnapshot) => void>();

  const notify = () => {
    const state: UiV2InventorySnapshot = {
      saunaShop: { ...snapshot.saunaShop, tiers: [...snapshot.saunaShop.tiers] },
      useUiV2: snapshot.useUiV2
    };
    for (const listener of listeners) {
      try {
        listener(state);
      } catch (error) {
        console.warn('Failed to notify UI v2 inventory listener', error);
      }
    }
  };

  const unsubscribeShop = options.subscribeToSaunaShop(() => {
    snapshot = {
      saunaShop: options.buildSaunaShopViewModel(),
      useUiV2: snapshot.useUiV2
    };
    notify();
  });

  return {
    getSnapshot() {
      return {
        saunaShop: { ...snapshot.saunaShop, tiers: [...snapshot.saunaShop.tiers] },
        useUiV2: snapshot.useUiV2
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      try {
        listener(this.getSnapshot());
      } catch (error) {
        console.warn('Failed to deliver initial UI v2 inventory snapshot', error);
      }
      return () => {
        listeners.delete(listener);
      };
    },
    setUseUiV2(enabled) {
      const normalized = Boolean(enabled);
      if (snapshot.useUiV2 === normalized) {
        return;
      }
      snapshot = {
        saunaShop: snapshot.saunaShop,
        useUiV2: normalized
      };
      options.setUseUiV2(normalized);
      notify();
    },
    dispose() {
      unsubscribeShop();
      listeners.clear();
    }
  } satisfies UiV2InventoryController;
}
