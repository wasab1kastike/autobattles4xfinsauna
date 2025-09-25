import panelStyles from './StashPanel.module.css';
import filterStyles from './Filters.module.css';
import { renderItemCard, type ItemCardHandlers } from './ItemCard.tsx';
import type {
  InventoryCollection,
  InventoryListItemView,
  InventoryPanelView,
  InventorySort
} from '../../state/inventory.ts';

export interface StashPanelCallbacks {
  readonly onClose?: () => void;
  readonly onCollectionChange?: (collection: InventoryCollection) => void;
  readonly onFilterToggle?: (category: 'slots' | 'rarities' | 'tags', value: string) => void;
  readonly onSearchChange?: (value: string) => void;
  readonly onSortChange?: (value: InventorySort) => void;
  readonly onLoadMore?: () => void;
  readonly onItemEquip?: (item: InventoryListItemView) => void;
  readonly onItemTransfer?: (item: InventoryListItemView) => void;
  readonly onItemTrash?: (item: InventoryListItemView) => void;
  readonly getAutoEquipState?: () => boolean;
  readonly onAutoEquipChange?: (enabled: boolean) => void;
  readonly getUiV2State?: () => boolean;
  readonly onUiV2Change?: (enabled: boolean) => void;
}

export interface StashPanelController {
  readonly element: HTMLElement;
  render(view: InventoryPanelView): void;
  setOpen(open: boolean): void;
  focus(): void;
  destroy(): void;
  setAutoEquip(enabled: boolean): void;
  setUiV2(enabled: boolean): void;
}

interface FilterSlot {
  readonly row: HTMLDivElement;
  readonly group: HTMLDivElement;
}

const SORT_LABELS: Record<InventorySort, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  rarity: 'Rarity',
  name: 'Name A-Z'
};

function createFilterSlot(labelText: string): FilterSlot {
  const row = document.createElement('div');
  row.className = filterStyles.row;
  const label = document.createElement('div');
  label.className = filterStyles.label;
  label.textContent = labelText;
  const group = document.createElement('div');
  group.className = filterStyles.group;
  row.append(label, group);
  return { row, group } satisfies FilterSlot;
}

export function createStashPanel(callbacks: StashPanelCallbacks): StashPanelController {
  const element = document.createElement('section');
  element.className = panelStyles.panel;
  element.tabIndex = -1;
  element.dataset.open = 'false';
  element.setAttribute('aria-label', 'Quartermaster stash');

  const header = document.createElement('header');
  header.className = panelStyles.header;

  const titleWrap = document.createElement('div');
  titleWrap.className = panelStyles.titleWrap;

  const emblem = document.createElement('div');
  emblem.className = panelStyles.emblem;

  const titleBlock = document.createElement('div');
  titleBlock.className = panelStyles.titleBlock;

  const title = document.createElement('h2');
  title.className = panelStyles.title;
  title.textContent = 'Quartermaster Stash';
  titleBlock.appendChild(title);

  const meta = document.createElement('div');
  meta.className = panelStyles.meta;
  meta.textContent = 'Loading…';
  titleBlock.appendChild(meta);

  titleWrap.append(emblem, titleBlock);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = panelStyles.close;
  close.textContent = 'Close';
  close.addEventListener('click', () => callbacks.onClose?.());

  header.append(titleWrap, close);
  element.appendChild(header);

  const controls = document.createElement('div');
  controls.className = panelStyles.controls;

  const collections = document.createElement('div');
  collections.className = panelStyles.collections;

  const collectionButtons: Record<InventoryCollection, HTMLButtonElement> = {
    stash: document.createElement('button'),
    inventory: document.createElement('button')
  };

  collectionButtons.stash.type = 'button';
  collectionButtons.stash.className = panelStyles.collectionButton;
  collectionButtons.stash.textContent = 'Stash';
  collectionButtons.stash.addEventListener('click', () => callbacks.onCollectionChange?.('stash'));

  collectionButtons.inventory.type = 'button';
  collectionButtons.inventory.className = panelStyles.collectionButton;
  collectionButtons.inventory.textContent = 'Ready';
  collectionButtons.inventory.addEventListener('click', () =>
    callbacks.onCollectionChange?.('inventory')
  );

  collections.append(collectionButtons.stash, collectionButtons.inventory);
  controls.appendChild(collections);

  const searchRow = document.createElement('div');
  searchRow.className = panelStyles.searchRow;

  const searchWrapper = document.createElement('div');
  searchWrapper.className = panelStyles.search;
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search stash…';
  searchInput.addEventListener('input', () => callbacks.onSearchChange?.(searchInput.value));
  const searchIcon = document.createElement('span');
  searchIcon.className = panelStyles.searchIcon;
  searchIcon.textContent = '🔍';
  searchWrapper.append(searchIcon, searchInput);
  searchRow.appendChild(searchWrapper);

  const sortSelect = document.createElement('select');
  sortSelect.className = panelStyles.sortSelect;
  (['newest', 'oldest', 'rarity', 'name'] as InventorySort[]).forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = SORT_LABELS[value];
    sortSelect.appendChild(option);
  });
  sortSelect.addEventListener('change', () =>
    callbacks.onSortChange?.(sortSelect.value as InventorySort)
  );
  searchRow.appendChild(sortSelect);

  controls.appendChild(searchRow);

  const settings = document.createElement('div');
  settings.className = panelStyles.settings;

  const buildToggle = (
    id: string,
    title: string,
    hint: string,
    onChange?: (value: boolean) => void
  ): { root: HTMLDivElement; setChecked: (checked: boolean) => void } => {
    const root = document.createElement('div');
    root.className = panelStyles.settingRow;

    const copy = document.createElement('div');
    copy.className = panelStyles.settingCopy;

    const label = document.createElement('span');
    label.className = panelStyles.settingLabel;
    label.textContent = title;
    copy.appendChild(label);

    const description = document.createElement('p');
    description.className = panelStyles.settingHint;
    description.textContent = hint;
    copy.appendChild(description);

    const control = document.createElement('div');
    control.className = panelStyles.settingControl;

    const state = document.createElement('span');
    state.className = panelStyles.settingState;
    state.textContent = 'Off';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.className = panelStyles.settingInput;

    const toggle = document.createElement('label');
    toggle.className = panelStyles.settingSwitch;
    toggle.htmlFor = id;
    toggle.dataset.state = 'off';

    const track = document.createElement('span');
    track.className = panelStyles.settingTrack;
    const thumb = document.createElement('span');
    thumb.className = panelStyles.settingThumb;
    toggle.append(track, thumb);

    const setChecked = (checked: boolean) => {
      input.checked = checked;
      toggle.dataset.state = checked ? 'on' : 'off';
      state.textContent = checked ? 'On' : 'Off';
    };

    input.addEventListener('change', () => {
      setChecked(input.checked);
      onChange?.(input.checked);
    });

    control.append(state, input, toggle);
    root.append(copy, control);
    return { root, setChecked };
  };

  const autoEquipToggle = buildToggle(
    'inventory-autoequip-toggle',
    'Auto-equip loot',
    'Try outfitting the selected attendant as soon as new gear arrives.',
    (value) => callbacks.onAutoEquipChange?.(value)
  );
  const uiVariantToggle = buildToggle(
    'inventory-ui-variant-toggle',
    'Experimental HUD',
    'Swap to the React/Tailwind HUD. You can revert at any time.',
    (value) => callbacks.onUiV2Change?.(value)
  );

  autoEquipToggle.setChecked(callbacks.getAutoEquipState?.() ?? false);
  uiVariantToggle.setChecked(callbacks.getUiV2State?.() ?? false);

  settings.append(autoEquipToggle.root, uiVariantToggle.root);
  controls.appendChild(settings);

  const filterSection = document.createElement('div');
  const filterSlots: Record<'slots' | 'rarities' | 'tags', FilterSlot> = {
    slots: createFilterSlot('Slots'),
    rarities: createFilterSlot('Rarity'),
    tags: createFilterSlot('Tags')
  };
  filterSection.append(
    filterSlots.slots.row,
    filterSlots.rarities.row,
    filterSlots.tags.row
  );
  controls.appendChild(filterSection);

  element.appendChild(controls);

  const body = document.createElement('div');
  body.className = panelStyles.body;
  const list = document.createElement('ul');
  list.className = panelStyles.grid;
  const empty = document.createElement('div');
  empty.className = panelStyles.empty;
  empty.textContent = 'No items match the current filters.';
  empty.hidden = true;
  body.append(list, empty);
  element.appendChild(body);

  const footer = document.createElement('div');
  footer.className = panelStyles.footer;
  const loadMore = document.createElement('button');
  loadMore.type = 'button';
  loadMore.className = panelStyles.loadMore;
  loadMore.textContent = 'Show more';
  loadMore.addEventListener('click', () => callbacks.onLoadMore?.());
  footer.appendChild(loadMore);
  element.appendChild(footer);

  function renderFilters(
    slot: FilterSlot,
    category: 'slots' | 'rarities' | 'tags',
    chips: readonly { id: string; label: string; count: number; active: boolean }[]
  ): void {
    slot.group.innerHTML = '';
    slot.row.hidden = chips.length === 0;
    for (const chip of chips) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = filterStyles.chip;
      button.dataset.active = chip.active ? 'true' : 'false';
      button.textContent = chip.label;
      if (chip.count > 0) {
        const count = document.createElement('span');
        count.className = filterStyles.count;
        count.textContent = String(chip.count);
        button.appendChild(count);
      }
      button.addEventListener('click', () => callbacks.onFilterToggle?.(category, chip.id));
      slot.group.appendChild(button);
    }
  }

  function renderItems(view: InventoryPanelView): void {
    list.replaceChildren();
    const fragment = document.createDocumentFragment();
    for (const itemView of view.items) {
      const handlers: ItemCardHandlers = {
        onEquip: () => callbacks.onItemEquip?.(itemView),
        onTransfer: () => callbacks.onItemTransfer?.(itemView),
        onTrash: () => callbacks.onItemTrash?.(itemView)
      };
      fragment.appendChild(renderItemCard(itemView, handlers));
    }
    list.appendChild(fragment);
    empty.hidden = view.filteredTotal !== 0;
    if (!empty.hidden) {
      empty.textContent = view.emptyMessage;
    }
  }

  const controller: StashPanelController = {
    element,
    render(view: InventoryPanelView) {
      meta.textContent =
        view.total === 0
          ? 'No items yet'
          : `${view.filteredTotal} of ${view.total} item${view.total === 1 ? '' : 's'}`;

      for (const [key, button] of Object.entries(collectionButtons) as [
        InventoryCollection,
        HTMLButtonElement
      ][]) {
        button.dataset.active = key === view.collection ? 'true' : 'false';
      }

      if (searchInput.value !== view.search) {
        searchInput.value = view.search;
      }
      if (sortSelect.value !== view.sort) {
        sortSelect.value = view.sort;
      }

      renderFilters(filterSlots.slots, 'slots', view.filters.slots);
      renderFilters(filterSlots.rarities, 'rarities', view.filters.rarities);
      renderFilters(filterSlots.tags, 'tags', view.filters.tags);

      renderItems(view);
      loadMore.hidden = !view.hasMore;
    },
    setOpen(open: boolean) {
      element.dataset.open = open ? 'true' : 'false';
    },
    focus() {
      const focusElement = element.focus.bind(element);
      try {
        focusElement({ preventScroll: true });
      } catch (error) {
        console.warn('Stash panel focus without scroll prevention fallback', error);
        try {
          focusElement();
        } catch (fallbackError) {
          console.warn('Unable to focus stash panel element', fallbackError);
        }
      }
    },
    destroy() {
      element.remove();
    },
    setAutoEquip(enabled: boolean) {
      autoEquipToggle.setChecked(enabled);
    },
    setUiV2(enabled: boolean) {
      uiVariantToggle.setChecked(enabled);
    }
  } satisfies StashPanelController;

  return controller;
}
