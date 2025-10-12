import styles from './ItemCard.module.css';
import type {
  InventoryListItemView,
  InventoryComparisonPreview,
  InventoryStatProjection
} from '../../state/inventory.ts';
import type { InventoryStatId } from '../../inventory/state.ts';

export interface ItemCardHandlers {
  readonly onEquip?: () => void;
  readonly onTransfer?: () => void;
  readonly onTrash?: () => void;
}

const STAT_LABELS: Record<InventoryStatId, string> = {
  health: 'HP',
  attackDamage: 'ATK',
  attackRange: 'Range',
  movementRange: 'Move',
  defense: 'Defense',
  shield: 'Shield'
};

const REASON_COPY: Record<string, string> = {
  'slot-occupied': 'Slot occupied. Unequip the current item first.',
  'stack-limit': 'Stack limit reached for this item.',
  'unknown-item': 'This item cannot be equipped yet.'
};

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function renderIcon(container: HTMLElement, view: InventoryListItemView): void {
  if (view.item.icon) {
    const img = document.createElement('img');
    img.src = view.item.icon;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 48;
    img.height = 48;
    container.appendChild(img);
    return;
  }
  const letter = document.createElement('span');
  letter.textContent = view.item.name.trim()[0]?.toUpperCase() ?? '?';
  container.appendChild(letter);
}

function describeReason(comparison: InventoryComparisonPreview | null): string | undefined {
  if (!comparison || comparison.canEquip) {
    return undefined;
  }
  if (comparison.reason && REASON_COPY[comparison.reason]) {
    return REASON_COPY[comparison.reason];
  }
  return 'Unable to equip this item right now.';
}

function createTooltip(stats: readonly InventoryStatProjection[], comparison: InventoryComparisonPreview): HTMLDivElement {
  const tooltip = document.createElement('div');
  tooltip.className = styles.tooltip;
  const title = document.createElement('h4');
  if (comparison.projected) {
    title.textContent = comparison.canEquip ? 'Projected stats' : 'Current loadout';
  } else {
    title.textContent = 'Stats';
  }
  tooltip.appendChild(title);
  if (!comparison.canEquip) {
    const reason = describeReason(comparison);
    if (reason) {
      const note = document.createElement('p');
      note.textContent = reason;
      note.style.margin = '0 0 0.5rem';
      note.style.fontSize = '0.78rem';
      tooltip.appendChild(note);
    }
  }
  const list = document.createElement('ul');
  list.className = styles.statList;
  for (const stat of stats) {
    const row = document.createElement('li');
    row.className = styles.stat;
    if (stat.delta > 0) {
      row.dataset.delta = 'positive';
    } else if (stat.delta < 0) {
      row.dataset.delta = 'negative';
    }
    const label = document.createElement('span');
    label.textContent = STAT_LABELS[stat.stat] ?? stat.stat;
    const value = document.createElement('span');
    const current = numberFormatter.format(stat.current);
    const projected = numberFormatter.format(stat.projected);
    const delta = stat.delta;
    const deltaString =
      delta === 0 ? '±0' : `${delta > 0 ? '+' : '−'}${numberFormatter.format(Math.abs(delta))}`;
    value.textContent = `${current} → ${projected} (${deltaString})`;
    row.append(label, value);
    list.appendChild(row);
  }
  tooltip.appendChild(list);
  return tooltip;
}

function createCompareBlock(view: InventoryListItemView): HTMLElement | null {
  const comparison = view.comparison;
  if (!comparison) {
    return null;
  }
  const wrapper = document.createElement('div');
  const compareButton = document.createElement('button');
  compareButton.type = 'button';
  compareButton.className = styles.compare;
  compareButton.textContent = comparison.canEquip ? 'Compare stats' : 'View details';
  const tooltipId = `${view.item.id}-compare-${view.location}-${view.index}`;
  compareButton.setAttribute('aria-controls', tooltipId);
  compareButton.setAttribute('aria-expanded', 'false');
  compareButton.setAttribute('aria-describedby', tooltipId);
  compareButton.addEventListener('focus', () => {
    compareButton.setAttribute('aria-expanded', 'true');
  });
  compareButton.addEventListener('blur', () => {
    compareButton.setAttribute('aria-expanded', 'false');
  });
  wrapper.appendChild(compareButton);
  const tooltip = createTooltip(comparison.stats, comparison);
  tooltip.id = tooltipId;
  wrapper.appendChild(tooltip);
  return wrapper;
}

function setActionState(button: HTMLButtonElement, comparison: InventoryComparisonPreview | null): void {
  if (!comparison) {
    return;
  }
  if (!comparison.canEquip) {
    button.disabled = true;
    const reason = describeReason(comparison);
    if (reason) {
      button.title = reason;
    }
  }
}

function formatTags(tags: readonly string[]): readonly string[] {
  return tags.map((tag) => {
    const normalized = tag.trim();
    if (!normalized) {
      return normalized;
    }
    return normalized
      .split(/[-_\s]/g)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  });
}

function renderActions(
  container: HTMLElement,
  view: InventoryListItemView,
  handlers: ItemCardHandlers
): void {
  const actions = document.createElement('div');
  actions.className = styles.actions;

  const equip = document.createElement('button');
  equip.type = 'button';
  equip.className = `${styles.action} ${styles.primary}`;
  equip.textContent = 'Equip';
  setActionState(equip, view.comparison);
  equip.addEventListener('click', () => {
    handlers.onEquip?.();
  });
  actions.appendChild(equip);

  const transfer = document.createElement('button');
  transfer.type = 'button';
  transfer.className = styles.action;
  transfer.textContent = view.location === 'stash' ? 'Send to inventory' : 'Return to stash';
  transfer.addEventListener('click', () => {
    handlers.onTransfer?.();
  });
  actions.appendChild(transfer);

  const trash = document.createElement('button');
  trash.type = 'button';
  trash.className = `${styles.action} ${styles.danger}`;
  trash.textContent = 'Trash';
  let pendingConfirm: number | null = null;
  const reset = () => {
    if (pendingConfirm !== null) {
      window.clearTimeout(pendingConfirm);
      pendingConfirm = null;
    }
    trash.dataset.confirm = 'false';
    trash.textContent = 'Trash';
  };
  trash.addEventListener('click', () => {
    if (pendingConfirm !== null) {
      reset();
      handlers.onTrash?.();
      return;
    }
    trash.dataset.confirm = 'true';
    trash.textContent = 'Confirm trash';
    pendingConfirm = window.setTimeout(() => {
      reset();
    }, 2600);
  });
  actions.appendChild(trash);

  container.appendChild(actions);
}

export function renderItemCard(view: InventoryListItemView, handlers: ItemCardHandlers): HTMLLIElement {
  const root = document.createElement('li');
  root.className = styles.card;
  root.dataset.location = view.location;
  root.setAttribute('role', 'listitem');

  const header = document.createElement('div');
  header.className = styles.header;

  const icon = document.createElement('div');
  icon.className = styles.icon;
  renderIcon(icon, view);
  header.appendChild(icon);

  const details = document.createElement('div');
  details.className = styles.details;

  const titleRow = document.createElement('div');
  titleRow.className = styles.titleRow;
  const title = document.createElement('h4');
  title.className = styles.title;
  title.textContent = view.item.name;
  titleRow.appendChild(title);

  const rarity = document.createElement('span');
  rarity.className = styles.rarity;
  rarity.textContent = view.metadata.rarity.toUpperCase();
  titleRow.appendChild(rarity);

  details.appendChild(titleRow);

  const slot = document.createElement('span');
  slot.className = styles.slot;
  slot.textContent = view.metadata.slot ? view.metadata.slotLabel : 'No slot';
  details.appendChild(slot);

  if (view.metadata.tags.length > 0) {
    const tags = document.createElement('div');
    tags.className = styles.tags;
    for (const tag of formatTags(view.metadata.tags)) {
      const chip = document.createElement('span');
      chip.className = styles.tag;
      chip.textContent = tag;
      tags.appendChild(chip);
    }
    details.appendChild(tags);
  }

  const compare = createCompareBlock(view);
  if (compare) {
    details.appendChild(compare);
  }

  header.appendChild(details);
  root.appendChild(header);

  if (view.item.quantity > 1) {
    const badge = document.createElement('span');
    badge.className = styles.badge;
    badge.textContent = `×${numberFormatter.format(view.item.quantity)}`;
    root.appendChild(badge);
  }

  renderActions(root, view, handlers);
  return root;
}
