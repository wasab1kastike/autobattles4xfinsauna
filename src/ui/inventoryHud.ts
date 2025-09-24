import type {
  EquipAttemptResult,
  InventoryCollection,
  InventoryEvent,
  InventoryItem,
  InventoryState
} from '../inventory/state.ts';
import { ensureHudLayout } from './layout.ts';
import { zIndex } from './theme/tokens.ts';
import {
  createDefaultFilterState,
  selectInventoryView,
  type InventoryComparisonContext,
  type InventoryPanelView,
  type InventorySort,
  type InventoryListItemView
} from '../state/inventory.ts';
import { createStashPanel } from './stash/StashPanel.tsx';
import type { StashPanelCallbacks } from './stash/StashPanel.tsx';
import { ARTOCOIN_CREST_PNG_DATA_URL as artocoinIconUrl } from '../media/artocoinCrest.ts';
import {
  createSaunaShopPanel,
  type SaunaShopPanelController,
  type SaunaShopViewModel,
  type SaunaShopToastVariant
} from './shop/SaunaShopPanel.tsx';
import type { SaunaTierId } from '../sauna/tiers.ts';
import type { PurchaseSaunaTierResult } from '../progression/saunaShop.ts';

export interface InventoryHudOptions {
  readonly getSelectedUnitId?: () => string | null;
  readonly getComparisonContext?: () => InventoryComparisonContext | null;
  readonly onEquip?: (
    unitId: string,
    item: InventoryItem,
    source: InventoryCollection
  ) => EquipAttemptResult;
  readonly getUseUiV2?: () => boolean;
  readonly onUseUiV2Change?: (enabled: boolean) => void;
  readonly getSaunaShopViewModel?: () => SaunaShopViewModel | null;
  readonly onPurchaseSaunaTier?: (tierId: SaunaTierId) => PurchaseSaunaTierResult;
  readonly subscribeToSaunaShop?: (listener: () => void) => () => void;
}

const PAGE_SIZE = 24;
const TOAST_LIFETIME_MS = 4500;
const TOAST_EXIT_MS = 400;

const STAT_LABELS: Record<string, string> = {
  health: 'HP',
  attackDamage: 'ATK',
  attackRange: 'RNG',
  movementRange: 'MOV',
  defense: 'DEF',
  shield: 'Shield'
};

const TOAST_STACK_CLASSES =
  'pointer-events-none ml-auto flex w-full max-w-[min(22rem,90vw)] flex-col gap-[clamp(6px,1vw,12px)]';
const TOAST_BASE_CLASSES =
  'pointer-events-auto flex w-full items-center gap-[clamp(4px,0.8vw,12px)] rounded-hud-md border border-[color:var(--hud-border)] px-4 py-3 text-[0.9rem] font-semibold leading-[1.35] shadow-hud-lg backdrop-blur-[14px] backdrop-saturate-[135%] transition-all duration-300 ease-out';
const TOAST_VARIANT_CLASSES: Record<'loot' | 'info' | 'warn', string> = {
  loot:
    'bg-[linear-gradient(140deg,color-mix(in_srgb,var(--color-surface-strong)_82%,rgba(15,23,42,0.18))_0%,color-mix(in_srgb,var(--color-accent-gold)_46%,var(--color-surface))_100%)] text-[color:color-mix(in_srgb,var(--color-foreground)_95%,rgba(255,250,235,0.12))]',
  info:
    'bg-[linear-gradient(140deg,color-mix(in_srgb,var(--color-surface-strong)_84%,rgba(12,22,38,0.2))_0%,color-mix(in_srgb,var(--color-accent-blue)_48%,var(--color-surface))_100%)] text-[color:color-mix(in_srgb,var(--color-foreground)_95%,rgba(224,247,255,0.1))]',
  warn:
    'bg-[linear-gradient(140deg,color-mix(in_srgb,var(--color-surface-strong)_82%,rgba(40,18,12,0.35))_0%,color-mix(in_srgb,var(--color-accent-red)_52%,var(--color-surface))_100%)] text-[color:color-mix(in_srgb,var(--color-foreground)_92%,rgba(255,234,221,0.22))]',
};
const TOAST_EXIT_CLASSES = ['-translate-y-2', 'opacity-0'] as const;

function updateToastStackVisibility(stack: HTMLDivElement): void {
  stack.hidden = stack.childElementCount === 0;
}

function ensureToastStack(overlay: HTMLElement, target: HTMLElement): HTMLDivElement {
  const existing = overlay.querySelector<HTMLDivElement>('[data-ui="loot-toast-stack"]');
  if (existing) {
    if (existing.parentElement !== target) {
      target.appendChild(existing);
    }
    existing.className = TOAST_STACK_CLASSES;
    existing.style.zIndex = String(zIndex.toast);
    updateToastStackVisibility(existing);
    return existing;
  }
  const doc = overlay.ownerDocument ?? document;
  const stack = doc.createElement('div');
  stack.dataset.ui = 'loot-toast-stack';
  stack.className = TOAST_STACK_CLASSES;
  stack.setAttribute('aria-live', 'polite');
  stack.setAttribute('role', 'status');
  stack.style.zIndex = String(zIndex.toast);
  updateToastStackVisibility(stack);
  target.appendChild(stack);
  return stack;
}

function showToast(stack: HTMLDivElement, message: string, variant: 'loot' | 'info' | 'warn'): void {
  const toast = (stack.ownerDocument ?? document).createElement('div');
  toast.dataset.variant = variant;
  toast.className = `${TOAST_BASE_CLASSES} ${TOAST_VARIANT_CLASSES[variant]}`;
  toast.textContent = message;
  stack.appendChild(toast);
  updateToastStackVisibility(stack);
  const removeToast = () => {
    toast.remove();
    updateToastStackVisibility(stack);
  };
  const timeout = window.setTimeout(() => {
    toast.classList.add(...TOAST_EXIT_CLASSES);
    window.setTimeout(removeToast, TOAST_EXIT_MS);
  }, TOAST_LIFETIME_MS);
  toast.addEventListener('click', () => {
    window.clearTimeout(timeout);
    removeToast();
  });
}

function toggleFilterValue(set: Set<string>, value: string): void {
  if (set.has(value)) {
    set.delete(value);
  } else {
    set.add(value);
  }
}

function formatComparisonDelta(comparison: InventoryEvent & { type: 'item-equipped' }): string | null {
  const deltas = comparison.comparison?.deltas ?? [];
  if (deltas.length === 0) {
    return null;
  }
  const segments = deltas.map((entry) => {
    const label = STAT_LABELS[entry.stat] ?? entry.stat;
    const sign = entry.delta > 0 ? '+' : '';
    return `${sign}${entry.delta} ${label}`;
  });
  return segments.join(', ');
}

function formatLocation(location: InventoryCollection | 'equipped'): string {
  switch (location) {
    case 'inventory':
      return 'ready inventory';
    case 'stash':
      return 'stash';
    case 'equipped':
    default:
      return 'loadout';
  }
}

function createShopButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className =
    'group inline-flex items-center gap-2 rounded-hud-pill border border-white/12 bg-[linear-gradient(135deg,rgba(44,32,18,0.92),rgba(68,48,24,0.95))] px-3.5 py-2 font-semibold text-amber-200 shadow-[0_14px_24px_rgba(17,12,6,0.55)] transition-all duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 hover:-translate-y-0.5 hover:shadow-[0_18px_28px_rgba(17,12,6,0.65)]';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', 'Open artocoin shop');

  const iconWrap = document.createElement('span');
  iconWrap.className =
    'relative flex h-[1.65rem] w-[1.65rem] flex-shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,210,128,0.95),rgba(114,68,17,0.85))] shadow-[inset_0_0_0_1px_rgba(255,236,196,0.55)]';
  iconWrap.setAttribute('aria-hidden', 'true');

  const icon = document.createElement('img');
  icon.src = artocoinIconUrl;
  icon.alt = '';
  icon.decoding = 'async';
  icon.className = 'h-[78%] w-[78%] drop-shadow-[0_10px_18px_rgba(255,186,92,0.4)]';
  iconWrap.appendChild(icon);

  const label = document.createElement('span');
  label.className = 'text-[0.75rem] uppercase tracking-[0.08em]';
  label.textContent = 'Shop';

  button.append(iconWrap, label);
  return button;
}

export function setupInventoryHud(
  inventory: InventoryState,
  options: InventoryHudOptions = {}
): { destroy: () => void } {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) {
    return { destroy: () => {} };
  }

  const doc = overlay.ownerDocument ?? document;
  const { anchors, tabs } = ensureHudLayout(overlay);
  const topLeftCluster = anchors.topLeftCluster;
  const toastStack = ensureToastStack(overlay, anchors.topRightCluster);

  overlay.querySelector('#inventory-stash-panel')?.remove();
  overlay.querySelector('#inventory-shop-panel')?.remove();

  const stashSlot = tabs.panels.stash;
  const previousStashSlotId = stashSlot.id || null;
  const previousStashDescribedBy = stashSlot.getAttribute('aria-describedby');
  const stashSlotId = previousStashSlotId || 'hud-bottom-panel-stash';
  stashSlot.id = stashSlotId;
  stashSlot.replaceChildren();

  const stashProxy = doc.createElement('p');
  stashProxy.id = 'inventory-stash-panel-proxy';
  stashProxy.className = 'sr-only';
  stashProxy.textContent =
    'Quartermaster stash drawer opens alongside the command dock. Focus shifts to the drawer when this tab is active.';
  stashSlot.appendChild(stashProxy);

  const describedByTokens = [previousStashDescribedBy, stashProxy.id]
    .map((token) => token?.trim())
    .filter((token): token is string => Boolean(token && token.length > 0));
  if (describedByTokens.length > 0) {
    stashSlot.setAttribute('aria-describedby', describedByTokens.join(' '));
  } else {
    stashSlot.removeAttribute('aria-describedby');
  }

  const stashButton =
    tabs.tabList.querySelector<HTMLButtonElement>('[data-hud-tab="stash"]') ?? null;
  const previousAriaControls = stashButton?.getAttribute('aria-controls') ?? null;
  if (stashButton) {
    const controlTargets = [stashSlotId, 'inventory-stash-panel'].filter(Boolean).join(' ');
    stashButton.setAttribute('aria-controls', controlTargets);
  }

  const rosterHudPanel = tabs.panels.roster;

  const dispatchRosterEvent = (type: 'expand' | 'collapse' | 'toggle'): void => {
    if (!rosterHudPanel) {
      return;
    }
    const event = new CustomEvent(`sauna-roster:${type}`, { bubbles: true });
    rosterHudPanel.dispatchEvent(event);
  };

  const requestRosterExpand = (): void => dispatchRosterEvent('expand');
  const requestRosterCollapse = (): void => dispatchRosterEvent('collapse');

  const updateStashBadge = (count: number): void => {
    tabs.setBadge('stash', count > 0 ? count : null);
  };

  const shopNumberFormatter = new Intl.NumberFormat('en-US');
  let shopPanel: SaunaShopPanelController | null = null;
  let shopButton: HTMLButtonElement | null = null;
  let isShopOpen = false;
  let unsubscribeShop: (() => void) | null = null;
  let onShopButtonClick: (() => void) | null = null;
  let setShopOpen: (next: boolean) => void = () => {};

  const updateShopButtonState = (view: SaunaShopViewModel | null): void => {
    if (!shopButton || !view) {
      return;
    }
    const balanceLabel = shopNumberFormatter.format(
      Math.max(0, Math.floor(Number.isFinite(view.balance) ? view.balance : 0))
    );
    shopButton.dataset.balance = balanceLabel;
    shopButton.title = `Artocoins ${balanceLabel}`;
    const ready = view.tiers.some((entry) => !entry.status.owned && entry.status.affordable);
    const locked = view.tiers.some((entry) => !entry.status.owned && !entry.status.affordable);
    shopButton.dataset.state = ready ? 'ready' : locked ? 'locked' : 'complete';
  };

  const shopToastVariants: Record<SaunaShopToastVariant, 'loot' | 'info' | 'warn'> = {
    success: 'loot',
    info: 'info',
    warn: 'warn'
  };

  if (typeof options.getSaunaShopViewModel === 'function') {
    const resolveView = (): SaunaShopViewModel =>
      options.getSaunaShopViewModel?.() ?? { balance: 0, tiers: [] };
    shopButton = createShopButton();
    shopButton.dataset.state = 'locked';
    topLeftCluster.appendChild(shopButton);

    const emitShopToast = (message: string, variant: SaunaShopToastVariant) => {
      const mapped = shopToastVariants[variant] ?? 'info';
      showToast(toastStack, message, mapped);
    };

    const handlePurchase = (tierId: SaunaTierId): PurchaseSaunaTierResult => {
      const handler = options.onPurchaseSaunaTier;
      if (!handler) {
        const fallback = resolveView();
        return {
          success: false,
          balance: fallback.balance,
          purchased: new Set<SaunaTierId>(),
          reason: 'unsupported'
        } satisfies PurchaseSaunaTierResult;
      }
      return handler(tierId);
    };

    shopPanel = createSaunaShopPanel({
      getViewModel: resolveView,
      callbacks: {
        onClose: () => setShopOpen(false),
        onPurchaseTier: handlePurchase,
        emitToast: emitShopToast
      }
    });
    shopPanel.element.id = 'inventory-shop-panel';
    shopButton.setAttribute('aria-controls', 'inventory-shop-panel');
    overlay.appendChild(shopPanel.element);

    const initialView = resolveView();
    shopPanel.update(initialView);
    updateShopButtonState(initialView);

    setShopOpen = (next: boolean) => {
      if (isShopOpen === next) {
        return;
      }
      isShopOpen = next;
      shopPanel?.setOpen(next);
      shopButton?.setAttribute('aria-expanded', next ? 'true' : 'false');
      shopButton?.setAttribute(
        'aria-label',
        next ? 'Close artocoin shop' : 'Open artocoin shop'
      );
      if (next) {
        if (tabs.getActive() === 'stash') {
          tabs.setActive('roster');
          requestRosterExpand();
        }
        overlay.classList.add('inventory-shop-open');
        const view = resolveView();
        shopPanel?.update(view);
        updateShopButtonState(view);
        try {
          shopPanel?.focus();
        } catch (error) {
          console.warn('Unable to focus artocoin shop', error);
        }
      } else {
        overlay.classList.remove('inventory-shop-open');
        try {
          shopButton?.focus({ preventScroll: true });
        } catch (error) {
          console.warn('Unable to restore focus to artocoin shop button', error);
        }
      }
    };

    onShopButtonClick = () => setShopOpen(!isShopOpen);
    shopButton.addEventListener('click', onShopButtonClick);

    unsubscribeShop = options.subscribeToSaunaShop?.(() => {
      const view = resolveView();
      shopPanel?.update(view);
      updateShopButtonState(view);
    });
  }

  const panelCallbacks: StashPanelCallbacks = {
    onClose: () => {
      if (tabs.getActive() === 'stash') {
        tabs.setActive('roster');
        requestRosterExpand();
      }
    },
    onCollectionChange: (next) => {
      if (collection !== next) {
        collection = next;
        page = 1;
        refresh();
      }
    },
    onFilterToggle: (category, value) => {
      const target = filters[category] as Set<string>;
      toggleFilterValue(target, value);
      page = 1;
      refresh();
    },
    onSearchChange: (value) => {
      search = value;
      page = 1;
      refresh();
    },
    onSortChange: (value) => {
      sort = value;
      page = 1;
      refresh();
    },
    onLoadMore: () => {
      page += 1;
      refresh();
    },
    onItemEquip: (item) => {
      handleEquip(item);
    },
    onItemTransfer: (item) => {
      handleTransfer(item);
    },
    onItemTrash: (item) => {
      handleTrash(item);
    },
    getAutoEquipState: () => inventory.isAutoEquipEnabled(),
    onAutoEquipChange: (enabled) => {
      inventory.setAutoEquip(enabled);
      showToast(
        toastStack,
        enabled
          ? 'Auto-equip enabled. Newly recovered gear will try to arm your selected attendant.'
          : 'Auto-equip disabled. Loot will head to the stash until you equip it manually.',
        'info'
      );
    },
    getUiV2State: () => options.getUseUiV2?.() ?? false,
    onUiV2Change: (enabled) => {
      options.onUseUiV2Change?.(enabled);
      showToast(
        toastStack,
        enabled
          ? 'Experimental HUD enabled. Reload to try the React/Tailwind experience.'
          : 'Classic HUD restored for your next session.',
        'info'
      );
    }
  };

  const panel = createStashPanel(panelCallbacks);
  panel.element.id = 'inventory-stash-panel';
  const stashButtonLabelId = stashButton?.id?.trim();
  if (stashButtonLabelId) {
    panel.element.setAttribute('aria-labelledby', stashButtonLabelId);
  }
  overlay.appendChild(panel.element);

  let collection: InventoryCollection = 'stash';
  const filters = createDefaultFilterState();
  let search = '';
  let sort: InventorySort = 'newest';
  let page = 1;

  const applyStashOpen = (open: boolean, focusPanel: boolean): void => {
    panel.setOpen(open);
    if (open) {
      overlay.classList.add('inventory-panel-open');
      if (focusPanel) {
        try {
          panel.focus();
        } catch (error) {
          console.warn('Unable to focus stash panel', error);
        }
      }
    } else {
      overlay.classList.remove('inventory-panel-open');
    }
  };

  const unsubscribeTabs = tabs.onChange((tabId) => {
    const open = tabId === 'stash';
    if (open) {
      setShopOpen(false);
      requestRosterCollapse();
    } else if (tabId === 'roster') {
      requestRosterExpand();
    } else {
      requestRosterCollapse();
    }
    applyStashOpen(open, open);
  });

  const initialTab = tabs.getActive();
  applyStashOpen(initialTab === 'stash', false);
  if (initialTab === 'roster') {
    requestRosterExpand();
  } else {
    requestRosterCollapse();
  }

  function computeView(): InventoryPanelView {
    const comparisonContext = options.getComparisonContext?.() ?? null;
    let view = selectInventoryView({
      stash: inventory.getStash(),
      inventory: inventory.getInventory(),
      filters,
      search,
      sort,
      page,
      pageSize: PAGE_SIZE,
      collection,
      comparisonContext
    });
    if (view.filteredTotal > 0) {
      const maxPage = Math.max(1, Math.ceil(view.filteredTotal / PAGE_SIZE));
      if (page > maxPage) {
        page = maxPage;
        view = selectInventoryView({
          stash: inventory.getStash(),
          inventory: inventory.getInventory(),
          filters,
          search,
          sort,
          page,
          pageSize: PAGE_SIZE,
          collection,
          comparisonContext
        });
      }
    }
    return view;
  }

  function refresh(): void {
    const view = computeView();
    const stashSummary = view.collections.find((entry) => entry.id === 'stash');
    const stashCount = stashSummary?.count ?? 0;
    updateStashBadge(stashCount);
    panel.render(view);
  }

  function ensureSelectedUnit(): string | null {
    const selected = options.getSelectedUnitId?.() ?? null;
    if (!selected) {
      showToast(toastStack, 'Select an attendant before equipping an item.', 'warn');
      return null;
    }
    return selected;
  }

  function handleEquip(item: InventoryListItemView): void {
    const unitId = ensureSelectedUnit();
    if (!unitId) {
      return;
    }
    const equipHandler = options.onEquip ?? (() => ({ success: false }));
    const source = item.location;
    const result =
      source === 'stash'
        ? inventory.equipFromStash(item.index, unitId, (id, entry) =>
            equipHandler(id, entry, 'stash')
          )
        : inventory.equipFromInventory(item.index, unitId, (id, entry) =>
            equipHandler(id, entry, 'inventory')
          );
    if (!result) {
      showToast(toastStack, 'Unable to equip that item right now.', 'warn');
    }
  }

  function handleTransfer(item: InventoryListItemView): void {
    const moved =
      item.location === 'stash'
        ? inventory.moveToInventory(item.index)
        : inventory.moveToStash(item.index);
    if (!moved) {
      showToast(toastStack, 'Unable to move that item right now.', 'warn');
      return;
    }
    const destination = item.location === 'stash' ? 'ready inventory' : 'stash';
    showToast(toastStack, `Moved ${moved.name} to the ${destination}.`, 'info');
    page = 1;
    refresh();
  }

  function handleTrash(item: InventoryListItemView): void {
    const removed =
      item.location === 'stash'
        ? inventory.discardFromStash(item.index)
        : inventory.discardFromInventory(item.index);
    if (!removed) {
      showToast(toastStack, 'That item was already removed.', 'warn');
      return;
    }
    const locationLabel = item.location === 'stash' ? 'stash' : 'ready inventory';
    showToast(toastStack, `${removed.name} discarded from the ${locationLabel}.`, 'warn');
    refresh();
  }

  function handleInventoryEvent(event: InventoryEvent): void {
    switch (event.type) {
      case 'stash-updated':
      case 'inventory-updated':
        refresh();
        break;
      case 'item-acquired':
        if (event.equipped) {
          showToast(toastStack, `${event.item.name} auto-equipped successfully.`, 'info');
        } else {
          const stored = formatLocation(event.location);
          showToast(toastStack, `New item secured: ${event.item.name} (${stored}).`, 'loot');
        }
        break;
      case 'item-equipped': {
        const deltaSummary = formatComparisonDelta(event);
        const suffix = deltaSummary ? ` (${deltaSummary})` : '';
        showToast(toastStack, `Equipped ${event.item.name}${suffix}.`, 'info');
        break;
      }
      case 'item-unequipped':
        showToast(
          toastStack,
          `${event.item.name} returned to the stash from slot ${event.slot}.`,
          'info'
        );
        break;
      case 'item-moved': {
        const target = formatLocation(event.to);
        showToast(toastStack, `Moved ${event.item.name} to the ${target}.`, 'info');
        break;
      }
      case 'item-discarded': {
        const location = formatLocation(event.location);
        showToast(toastStack, `${event.item.name} discarded from the ${location}.`, 'warn');
        break;
      }
      case 'settings-updated':
        panel.setAutoEquip(event.autoEquip);
        break;
      default:
        break;
    }
  }

  const unsubscribe = inventory.on((event) => handleInventoryEvent(event));

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) {
      return;
    }
    if (event.code === 'KeyI' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      const active = tabs.getActive();
      const next = active === 'stash' ? 'roster' : 'stash';
      tabs.setActive(next);
      if (next === 'roster') {
        requestRosterExpand();
      } else {
        requestRosterCollapse();
      }
    }
  };
  window.addEventListener('keydown', onKeyDown);

  refresh();

  const destroy = (): void => {
    unsubscribe();
    unsubscribeTabs();
    window.removeEventListener('keydown', onKeyDown);
    if (stashButton) {
      if (previousAriaControls !== null) {
        stashButton.setAttribute('aria-controls', previousAriaControls);
      } else {
        stashButton.removeAttribute('aria-controls');
      }
    }
    stashSlot.replaceChildren();
    if (previousStashDescribedBy && previousStashDescribedBy.trim().length > 0) {
      stashSlot.setAttribute('aria-describedby', previousStashDescribedBy);
    } else {
      stashSlot.removeAttribute('aria-describedby');
    }
    if (previousStashSlotId) {
      stashSlot.id = previousStashSlotId;
    } else {
      stashSlot.removeAttribute('id');
    }
    panel.destroy();
    updateStashBadge(0);
    overlay.classList.remove('inventory-panel-open');
    if (shopButton && onShopButtonClick) {
      shopButton.removeEventListener('click', onShopButtonClick);
    }
    shopPanel?.destroy();
    shopButton?.remove();
    unsubscribeShop?.();
    overlay.classList.remove('inventory-shop-open');
    if (!toastStack.hasChildNodes()) {
      toastStack.remove();
    }
  };

  return { destroy };
}
