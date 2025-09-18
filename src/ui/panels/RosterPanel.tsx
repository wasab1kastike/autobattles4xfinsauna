import { renderItemIcon } from '../components/ItemIcon.tsx';
import { renderModPill } from '../components/ModPill.tsx';
import type { SaunojaItem, SaunojaModifier } from '../../units/saunoja.ts';

export type RosterStatus = 'engaged' | 'reserve' | 'downed';

export type RosterItem = SaunojaItem;
export type RosterModifier = SaunojaModifier;

export interface RosterStats {
  readonly health: number;
  readonly maxHealth: number;
  readonly attackDamage: number;
  readonly attackRange: number;
  readonly movementRange: number;
  readonly defense?: number;
  readonly shield?: number;
}

export interface RosterEntry {
  readonly id: string;
  readonly name: string;
  readonly upkeep: number;
  readonly status: RosterStatus;
  readonly selected: boolean;
  readonly traits: readonly string[];
  readonly stats: RosterStats;
  readonly items: readonly RosterItem[];
  readonly modifiers: readonly RosterModifier[];
}

export interface RosterPanelOptions {
  readonly onSelect?: (unitId: string) => void;
}

const rosterStatusLabels: Record<RosterStatus, string> = {
  engaged: 'Engaged on the field',
  reserve: 'On reserve duty',
  downed: 'Recovering from battle'
};

const integerFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0
});

const rosterTitleId = 'panel-roster-title';

function formatTraits(traits: readonly string[]): string {
  if (traits.length === 0) {
    return 'No defining traits yet';
  }
  return traits.join(' • ');
}

function buildMetaLine(entry: RosterEntry): string {
  const { stats } = entry;
  const segments: string[] = [
    `HP ${integerFormatter.format(stats.health)}/${integerFormatter.format(stats.maxHealth)}`
  ];
  if (stats.shield && stats.shield > 0) {
    segments.push(`Shield ${integerFormatter.format(stats.shield)}`);
  }
  segments.push(`ATK ${integerFormatter.format(stats.attackDamage)}`);
  segments.push(`RNG ${integerFormatter.format(stats.attackRange)}`);
  if (stats.defense && stats.defense > 0) {
    segments.push(`DEF ${integerFormatter.format(stats.defense)}`);
  }
  segments.push(`MOV ${integerFormatter.format(stats.movementRange)}`);
  segments.push(`Upkeep ${integerFormatter.format(entry.upkeep)} beer`);
  return segments.join(' • ');
}

function buildAriaLabel(entry: RosterEntry): string {
  const { stats } = entry;
  const segments: string[] = [entry.name, rosterStatusLabels[entry.status]];
  segments.push(`health ${integerFormatter.format(stats.health)} of ${integerFormatter.format(stats.maxHealth)}`);
  if (stats.shield && stats.shield > 0) {
    segments.push(`shield ${integerFormatter.format(stats.shield)}`);
  }
  segments.push(`attack ${integerFormatter.format(stats.attackDamage)}`);
  if (stats.defense && stats.defense > 0) {
    segments.push(`defense ${integerFormatter.format(stats.defense)}`);
  }
  if (stats.attackRange > 0) {
    segments.push(`attack range ${integerFormatter.format(stats.attackRange)}`);
  }
  segments.push(`movement ${integerFormatter.format(stats.movementRange)}`);
  segments.push(`upkeep ${integerFormatter.format(entry.upkeep)} beer`);
  if (entry.items.length > 0) {
    segments.push(`${entry.items.length} equipped item${entry.items.length === 1 ? '' : 's'}`);
  }
  if (entry.modifiers.length > 0) {
    segments.push(`${entry.modifiers.length} active modifier${entry.modifiers.length === 1 ? '' : 's'}`);
  }
  return segments.join(', ');
}

function renderMetrics(container: HTMLElement, entries: readonly RosterEntry[]): void {
  const engaged = entries.filter((entry) => entry.status === 'engaged').length;
  const reserve = entries.filter((entry) => entry.status === 'reserve').length;
  const downed = entries.filter((entry) => entry.status === 'downed').length;

  const buildMetric = (label: string, value: number, status: RosterStatus): HTMLSpanElement => {
    const metric = document.createElement('span');
    metric.classList.add('panel-roster__metric');
    metric.dataset.status = status;
    metric.textContent = `${integerFormatter.format(value)} ${label}`;
    metric.setAttribute('aria-label', metric.textContent);
    return metric;
  };

  const metrics = document.createElement('div');
  metrics.classList.add('panel-roster__metrics');
  metrics.append(
    buildMetric('engaged', engaged, 'engaged'),
    buildMetric('reserve', reserve, 'reserve'),
    buildMetric('downed', downed, 'downed')
  );
  container.appendChild(metrics);
}

function renderLoadout(root: HTMLButtonElement, entry: RosterEntry): void {
  if (entry.items.length === 0 && entry.modifiers.length === 0) {
    return;
  }

  const loadout = document.createElement('div');
  loadout.classList.add('panel-roster__loadout');

  if (entry.items.length > 0) {
    const list = document.createElement('ul');
    list.classList.add('panel-roster__items');
    list.setAttribute('role', 'list');
    list.setAttribute('aria-label', `${entry.name} equipped items`);
    list.title = entry.items.map((item) => item.name).join(', ');
    for (const item of entry.items) {
      list.appendChild(renderItemIcon(item));
    }
    loadout.appendChild(list);
  }

  if (entry.modifiers.length > 0) {
    const list = document.createElement('ul');
    list.classList.add('panel-roster__mods');
    list.setAttribute('role', 'list');
    list.setAttribute('aria-label', `${entry.name} active modifiers`);
    list.title = entry.modifiers.map((modifier) => modifier.name).join(', ');
    for (const modifier of entry.modifiers) {
      list.appendChild(renderModPill(modifier));
    }
    loadout.appendChild(list);
  }

  root.appendChild(loadout);
}

export function createRosterPanel(
  container: HTMLElement,
  options: RosterPanelOptions = {}
): { render: (entries: readonly RosterEntry[]) => void } {
  const render = (entries: readonly RosterEntry[]): void => {
    container.innerHTML = '';
    container.dataset.count = String(entries.length);
    container.classList.add('panel-roster');

    const header = document.createElement('div');
    header.classList.add('panel-roster__header');

    const heading = document.createElement('h4');
    heading.classList.add('panel-roster__title');
    heading.textContent = 'Battalion Roster';
    heading.id = rosterTitleId;
    header.appendChild(heading);

    container.setAttribute('aria-labelledby', rosterTitleId);

    const totalLabel =
      entries.length === 0
        ? 'No attendants mustered yet'
        : `${integerFormatter.format(entries.length)} attendant${entries.length === 1 ? '' : 's'} enlisted`;
    const count = document.createElement('span');
    count.classList.add('panel-roster__count');
    count.textContent = totalLabel;
    header.appendChild(count);

    container.appendChild(header);

    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.classList.add('panel-roster__empty');
      empty.textContent = 'No attendants have rallied to the sauna yet.';
      container.appendChild(empty);
      return;
    }

    renderMetrics(container, entries);

    const list = document.createElement('ul');
    list.classList.add('panel-roster__list');
    list.setAttribute('role', 'list');

    for (const entry of entries) {
      const item = document.createElement('li');
      item.classList.add('panel-roster__row');

      const button = document.createElement('button');
      button.type = 'button';
      button.classList.add('panel-roster__item');
      button.dataset.unitId = entry.id;
      button.dataset.status = entry.status;
      button.setAttribute('aria-pressed', entry.selected ? 'true' : 'false');
      button.setAttribute('aria-label', buildAriaLabel(entry));
      button.title = `${entry.name} • ${rosterStatusLabels[entry.status]}`;
      if (entry.selected) {
        button.classList.add('is-selected');
      }
      if (entry.status === 'downed') {
        button.classList.add('is-downed');
      }

      const nameRow = document.createElement('div');
      nameRow.classList.add('panel-roster__name-row');

      const name = document.createElement('span');
      name.classList.add('panel-roster__name');
      name.textContent = entry.name;
      name.title = entry.name;
      nameRow.appendChild(name);

      const badge = document.createElement('span');
      badge.classList.add('panel-roster__status');
      badge.dataset.status = entry.status;
      badge.textContent = rosterStatusLabels[entry.status];
      nameRow.appendChild(badge);

      const meta = document.createElement('div');
      meta.classList.add('panel-roster__meta');
      const metaLabel = buildMetaLine(entry);
      meta.textContent = metaLabel;
      meta.title = metaLabel;

      const healthBar = document.createElement('div');
      healthBar.classList.add('panel-roster__health');
      const fill = document.createElement('div');
      fill.classList.add('panel-roster__health-fill');
      const percent =
        entry.stats.maxHealth > 0
          ? Math.max(0, Math.min(100, Math.round((entry.stats.health / entry.stats.maxHealth) * 100)))
          : 0;
      fill.style.width = `${percent}%`;
      fill.dataset.percent = `${percent}`;
      healthBar.appendChild(fill);

      const traits = document.createElement('div');
      traits.classList.add('panel-roster__traits');
      const traitLabel = formatTraits(entry.traits);
      traits.textContent = traitLabel;
      traits.title = traitLabel;

      button.append(nameRow, meta, healthBar, traits);
      renderLoadout(button, entry);

      if (typeof options.onSelect === 'function') {
        button.addEventListener('click', () => options.onSelect?.(entry.id));
      }

      item.appendChild(button);
      list.appendChild(item);
    }

    container.appendChild(list);
  };

  return { render };
}
