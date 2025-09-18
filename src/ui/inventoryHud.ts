import type { InventoryEvent, InventoryItem, InventoryState } from '../inventory/state.ts';
import { ensureHudLayout } from './layout.ts';

export interface InventoryHudOptions {
  readonly getSelectedUnitId?: () => string | null;
  readonly onEquip?: (unitId: string, item: InventoryItem) => boolean;
}

const TOAST_LIFETIME_MS = 4500;

function formatTimestamp(value: number): string {
  const date = new Date(value);
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function setupInventoryHud(
  inventory: InventoryState,
  options: InventoryHudOptions = {}
): { destroy: () => void } {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) {
    return { destroy: () => {} };
  }

  const { actions } = ensureHudLayout(overlay);

  const existingStack = overlay.querySelector<HTMLDivElement>('.loot-toast-stack');
  const toastStack = existingStack ?? document.createElement('div');
  if (!existingStack) {
    toastStack.classList.add('loot-toast-stack');
    toastStack.setAttribute('aria-live', 'polite');
    toastStack.setAttribute('role', 'status');
    overlay.appendChild(toastStack);
  }

  overlay.querySelectorAll('.inventory-badge').forEach((el) => el.remove());
  const badgeButton = document.createElement('button');
  badgeButton.type = 'button';
  badgeButton.classList.add('inventory-badge');
  badgeButton.setAttribute('aria-expanded', 'false');
  badgeButton.setAttribute('aria-controls', 'inventory-stash-panel');
  badgeButton.setAttribute('aria-label', 'Open quartermaster stash');

  const badgeIcon = document.createElement('span');
  badgeIcon.classList.add('inventory-badge__icon');
  badgeIcon.setAttribute('aria-hidden', 'true');

  const badgeText = document.createElement('span');
  badgeText.classList.add('inventory-badge__text');
  badgeText.textContent = 'Stash';

  const badgeCount = document.createElement('span');
  badgeCount.classList.add('inventory-badge__count');
  badgeCount.textContent = '0';
  badgeCount.setAttribute('aria-hidden', 'true');

  badgeButton.append(badgeIcon, badgeText, badgeCount);

  overlay.querySelector('#inventory-stash-panel')?.remove();
  const panel = document.createElement('section');
  panel.id = 'inventory-stash-panel';
  panel.classList.add('inventory-stash');
  panel.hidden = true;
  panel.tabIndex = -1;
  panel.setAttribute('aria-label', 'Quartermaster stash');

  const panelHeader = document.createElement('header');
  panelHeader.classList.add('inventory-stash__header');

  const panelTitle = document.createElement('h3');
  panelTitle.classList.add('inventory-stash__title');
  panelTitle.textContent = 'Quartermaster Stash';
  panelHeader.appendChild(panelTitle);

  const panelMeta = document.createElement('span');
  panelMeta.classList.add('inventory-stash__meta');
  panelHeader.appendChild(panelMeta);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.classList.add('inventory-stash__close');
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => {
    panel.hidden = true;
    badgeButton.setAttribute('aria-expanded', 'false');
    badgeButton.focus({ preventScroll: true });
  });
  panelHeader.appendChild(closeBtn);

  const list = document.createElement('ul');
  list.classList.add('inventory-stash__list');
  list.setAttribute('role', 'list');

  panel.append(panelHeader, list);
  actions.appendChild(badgeButton);
  overlay.appendChild(panel);

  function togglePanel(): void {
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    badgeButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    badgeButton.setAttribute(
      'aria-label',
      willOpen ? 'Close quartermaster stash' : 'Open quartermaster stash'
    );
    if (willOpen) {
      panel.focus({ preventScroll: true });
    }
  }

  badgeButton.addEventListener('click', () => {
    togglePanel();
  });

  function renderEmptyState(): void {
    list.innerHTML = '';
    const empty = document.createElement('li');
    empty.classList.add('inventory-stash__empty');
    empty.textContent = 'No items are waiting in the stash.';
    list.appendChild(empty);
  }

  function showToast(message: string, emphasis: 'loot' | 'info' | 'warn' = 'loot'): void {
    const toast = document.createElement('div');
    toast.classList.add('loot-toast');
    toast.dataset.variant = emphasis;
    toast.textContent = message;
    toastStack.appendChild(toast);
    const timeout = window.setTimeout(() => {
      toast.classList.add('loot-toast--exit');
      window.setTimeout(() => toast.remove(), 400);
    }, TOAST_LIFETIME_MS);
    toast.addEventListener('click', () => {
      window.clearTimeout(timeout);
      toast.remove();
    });
  }

  function renderStash(stash: readonly InventoryItem[]): void {
    badgeCount.textContent = String(stash.length);
    badgeButton.dataset.count = String(stash.length);
    panelMeta.textContent = stash.length === 0 ? 'Empty' : `${stash.length} item(s)`;
    if (stash.length === 0) {
      renderEmptyState();
      return;
    }
    list.innerHTML = '';
    stash.forEach((item, index) => {
      const entry = document.createElement('li');
      entry.classList.add('inventory-stash__item');
      entry.dataset.rarity = item.rarity ?? 'common';

      const title = document.createElement('div');
      title.classList.add('inventory-stash__item-title');
      title.textContent = item.name;
      entry.appendChild(title);

      if (item.rarity) {
        const rarity = document.createElement('span');
        rarity.classList.add('inventory-stash__item-rarity');
        rarity.textContent = item.rarity;
        entry.appendChild(rarity);
      }

      const quantity = document.createElement('span');
      quantity.classList.add('inventory-stash__item-quantity');
      quantity.textContent = `×${item.quantity}`;
      entry.appendChild(quantity);

      const acquired = document.createElement('span');
      acquired.classList.add('inventory-stash__item-time');
      acquired.textContent = formatTimestamp(item.acquiredAt);
      entry.appendChild(acquired);

      const actionRow = document.createElement('div');
      actionRow.classList.add('inventory-stash__actions');

      const equipBtn = document.createElement('button');
      equipBtn.type = 'button';
      equipBtn.classList.add('inventory-stash__action');
      equipBtn.textContent = 'Equip to selected';
      equipBtn.addEventListener('click', () => {
        const selectedId = options.getSelectedUnitId?.() ?? null;
        if (!selectedId) {
          showToast('Select an attendant before equipping an item.', 'warn');
          return;
        }
        const handler = options.onEquip ?? (() => false);
        const equipped = inventory.equipFromStash(index, selectedId, handler);
        if (!equipped) {
          showToast('Unable to equip that item right now.', 'warn');
          return;
        }
        showToast(`Equipped ${item.name} to the selected attendant.`, 'info');
      });
      actionRow.appendChild(equipBtn);

      const discardBtn = document.createElement('button');
      discardBtn.type = 'button';
      discardBtn.classList.add('inventory-stash__action', 'inventory-stash__action--danger');
      discardBtn.textContent = 'Discard';
      discardBtn.addEventListener('click', () => {
        const removed = inventory.discardFromStash(index);
        if (removed) {
          showToast(`${removed.name} was discarded from the stash.`, 'warn');
        }
      });
      actionRow.appendChild(discardBtn);

      entry.appendChild(actionRow);
      list.appendChild(entry);
    });
  }

  badgeButton.dataset.autoequip = inventory.isAutoEquipEnabled() ? 'on' : 'off';
  renderStash(inventory.getStash());

  const unsubscribe = inventory.on((event: InventoryEvent) => {
    switch (event.type) {
      case 'item-acquired':
        if (event.equipped) {
          showToast(`${event.item.name} auto-equipped successfully.`, 'info');
        } else {
          showToast(`New item secured: ${event.item.name}`);
        }
        break;
      case 'item-equipped':
        showToast(`${event.item.name} equipped to the selected attendant.`, 'info');
        break;
      case 'item-discarded':
        showToast(`${event.item.name} discarded from the stash.`, 'warn');
        break;
      case 'stash-updated':
        renderStash(event.stash);
        break;
      case 'settings-updated':
        badgeButton.dataset.autoequip = event.autoEquip ? 'on' : 'off';
        break;
      default:
        break;
    }
  });

  const destroy = (): void => {
    unsubscribe();
    badgeButton.remove();
    panel.remove();
    if (!toastStack.hasChildNodes()) {
      toastStack.remove();
    }
  };

  return { destroy };
}
