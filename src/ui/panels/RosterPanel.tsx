import { renderItemIcon } from '../components/ItemIcon.tsx';
import { renderModPill } from '../components/ModPill.tsx';
import type { SaunojaItem, SaunojaModifier } from '../../units/saunoja.ts';
import type { EquipmentSlotId, EquipmentModifier } from '../../items/types.ts';
import type { StatAwards } from '../../progression/experiencePlan.ts';

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

export interface RosterProgression {
  readonly level: number;
  readonly xp: number;
  readonly xpIntoLevel: number;
  readonly xpForNext: number | null;
  readonly progress: number;
  readonly statBonuses: StatAwards;
}

export interface RosterEquipmentSlot {
  readonly id: EquipmentSlotId;
  readonly label: string;
  readonly description: string;
  readonly maxStacks: number;
  readonly item: (RosterItem & { slot: EquipmentSlotId }) | null;
  readonly modifiers: EquipmentModifier | null;
}

export interface RosterEntry {
  readonly id: string;
  readonly name: string;
  readonly upkeep: number;
  readonly status: RosterStatus;
  readonly selected: boolean;
  readonly traits: readonly string[];
  readonly stats: RosterStats;
  readonly baseStats: RosterStats;
  readonly progression: RosterProgression;
  readonly equipment: readonly RosterEquipmentSlot[];
  readonly items: readonly RosterItem[];
  readonly modifiers: readonly RosterModifier[];
}

export interface RosterPanelOptions {
  readonly onSelect?: (unitId: string) => void;
  readonly onEquipSlot?: (unitId: string, slot: EquipmentSlotId) => void;
  readonly onUnequipSlot?: (unitId: string, slot: EquipmentSlotId) => void;
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

function formatProgressPercent(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(progress * 100)));
}

function formatXpLabel(progression: RosterProgression): string {
  const formatter = integerFormatter;
  if (progression.xpForNext === null) {
    return `${formatter.format(progression.xp)} XP • Max level`;
  }
  const percent = formatProgressPercent(progression.progress);
  return `${formatter.format(progression.xpIntoLevel)} / ${formatter.format(progression.xpForNext)} XP • ${percent}%`;
}

function formatStatBonuses(bonuses: StatAwards): string {
  const segments: string[] = [];
  const push = (label: string, value: number) => {
    if (value > 0) {
      segments.push(`+${integerFormatter.format(value)} ${label}`);
    }
  };
  push('Vigor', bonuses.vigor);
  push('Focus', bonuses.focus);
  push('Resolve', bonuses.resolve);
  if (segments.length === 0) {
    return 'No level bonuses yet';
  }
  return segments.join(' • ');
}

function formatDelta(value: number, base: number | undefined): string {
  const baseline = typeof base === 'number' ? base : 0;
  const delta = Math.round(value - baseline);
  if (delta === 0) {
    return '';
  }
  const formatted = integerFormatter.format(Math.abs(delta));
  return delta > 0 ? ` (+${formatted})` : ` (-${formatted})`;
}

function formatModifierSummary(modifiers: EquipmentModifier | null): string {
  if (!modifiers) {
    return 'No stat changes';
  }
  const segments: string[] = [];
  const push = (label: string, value?: number) => {
    if (typeof value === 'number' && value !== 0) {
      const sign = value > 0 ? '+' : '−';
      segments.push(`${label} ${sign}${integerFormatter.format(Math.abs(value))}`);
    }
  };
  push('HP', modifiers.health);
  push('ATK', modifiers.attackDamage);
  push('RNG', modifiers.attackRange);
  push('MOV', modifiers.movementRange);
  push('DEF', modifiers.defense);
  push('Shield', modifiers.shield);
  if (segments.length === 0) {
    return 'No stat changes';
  }
  return segments.join(', ');
}

function buildMetaLine(entry: RosterEntry): string {
  const { stats, baseStats } = entry;
  const segments: string[] = [
    `HP ${integerFormatter.format(stats.health)}/${integerFormatter.format(stats.maxHealth)}${formatDelta(stats.maxHealth, baseStats.maxHealth)}`
  ];
  if (stats.shield && stats.shield > 0) {
    segments.push(
      `Shield ${integerFormatter.format(stats.shield)}${formatDelta(stats.shield, baseStats.shield)}`
    );
  }
  segments.push(
    `ATK ${integerFormatter.format(stats.attackDamage)}${formatDelta(stats.attackDamage, baseStats.attackDamage)}`
  );
  segments.push(
    `RNG ${integerFormatter.format(stats.attackRange)}${formatDelta(stats.attackRange, baseStats.attackRange)}`
  );
  if (stats.defense && stats.defense > 0) {
    segments.push(
      `DEF ${integerFormatter.format(stats.defense)}${formatDelta(stats.defense, baseStats.defense)}`
    );
  }
  segments.push(
    `MOV ${integerFormatter.format(stats.movementRange)}${formatDelta(stats.movementRange, baseStats.movementRange)}`
  );
  segments.push(`Upkeep ${integerFormatter.format(entry.upkeep)} beer`);
  return segments.join(' • ');
}

function buildAriaLabel(entry: RosterEntry): string {
  const { stats } = entry;
  const segments: string[] = [entry.name, rosterStatusLabels[entry.status]];
  segments.push(`level ${entry.progression.level}`);
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
  if (entry.progression.xpForNext === null) {
    segments.push(`${integerFormatter.format(entry.progression.xp)} total experience`);
  } else {
    segments.push(
      `${integerFormatter.format(entry.progression.xpIntoLevel)} of ${integerFormatter.format(entry.progression.xpForNext)} experience toward next level`
    );
  }
  const bonusSummary = formatStatBonuses(entry.progression.statBonuses);
  if (bonusSummary) {
    segments.push(`level bonuses ${bonusSummary}`);
  }
  const equippedCount = entry.equipment.filter((slot) => slot.item).length;
  if (equippedCount > 0) {
    segments.push(`${equippedCount} equipped item${equippedCount === 1 ? '' : 's'}`);
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

function renderLoadout(
  root: HTMLButtonElement,
  entry: RosterEntry,
  options: RosterPanelOptions
): void {
  const loadout = document.createElement('div');
  loadout.classList.add('panel-roster__loadout');

  const slotsList = document.createElement('ul');
  slotsList.classList.add('panel-roster__slots');
  slotsList.setAttribute('role', 'list');
  slotsList.setAttribute('aria-label', `${entry.name} equipment slots`);

  for (const slot of entry.equipment) {
    const slotItem = document.createElement('li');
    slotItem.classList.add('panel-roster__slot');
    slotItem.dataset.slot = slot.id;

    const header = document.createElement('div');
    header.classList.add('panel-roster__slot-header');

    const label = document.createElement('span');
    label.classList.add('panel-roster__slot-label');
    label.textContent = slot.label;
    label.title = slot.description;
    header.appendChild(label);

    const summary = document.createElement('span');
    summary.classList.add('panel-roster__slot-summary');
    summary.textContent = slot.item ? slot.item.name : 'Empty';
    summary.title = slot.description;
    header.appendChild(summary);

    slotItem.appendChild(header);

    if (slot.item) {
      const iconList = document.createElement('ul');
      iconList.classList.add('panel-roster__slot-icons');
      iconList.setAttribute('role', 'list');
      iconList.appendChild(renderItemIcon(slot.item));
      slotItem.appendChild(iconList);
    }

    const modifierLabel = document.createElement('span');
    modifierLabel.classList.add('panel-roster__slot-modifiers');
    modifierLabel.textContent = formatModifierSummary(slot.modifiers);
    modifierLabel.title = modifierLabel.textContent;
    slotItem.appendChild(modifierLabel);

    const actions = document.createElement('div');
    actions.classList.add('panel-roster__slot-actions');

    const equipBtn = document.createElement('button');
    equipBtn.type = 'button';
    equipBtn.classList.add('panel-roster__slot-action');
    equipBtn.textContent = slot.item ? 'Replace' : 'Equip';
    equipBtn.setAttribute('aria-label', `Equip ${slot.label} for ${entry.name}`);
    equipBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      options.onEquipSlot?.(entry.id, slot.id);
    });
    actions.appendChild(equipBtn);

    const unequipBtn = document.createElement('button');
    unequipBtn.type = 'button';
    unequipBtn.classList.add('panel-roster__slot-action');
    unequipBtn.textContent = 'Unequip';
    unequipBtn.disabled = slot.item === null;
    unequipBtn.setAttribute('aria-label', `Unequip ${slot.label} from ${entry.name}`);
    unequipBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!unequipBtn.disabled) {
        options.onUnequipSlot?.(entry.id, slot.id);
      }
    });
    actions.appendChild(unequipBtn);

    slotItem.appendChild(actions);
    slotsList.appendChild(slotItem);
  }

  loadout.appendChild(slotsList);

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

      const identity = document.createElement('div');
      identity.classList.add('panel-roster__identity');

      const level = document.createElement('span');
      level.classList.add('panel-roster__level');
      level.dataset.level = String(entry.progression.level);
      level.style.setProperty('--level-progress', '0%');
      const levelProgress = formatProgressPercent(entry.progression.progress);
      level.style.setProperty('--level-progress', `${levelProgress}%`);
      level.setAttribute('role', 'img');
      const levelAria =
        entry.progression.xpForNext === null
          ? `Level ${entry.progression.level}, at mastery`
          : `Level ${entry.progression.level}, ${levelProgress}% toward next level`;
      level.setAttribute('aria-label', levelAria);

      const levelValue = document.createElement('span');
      levelValue.classList.add('panel-roster__level-value');
      levelValue.textContent = String(entry.progression.level);
      level.appendChild(levelValue);

      const name = document.createElement('span');
      name.classList.add('panel-roster__name');
      name.textContent = entry.name;
      name.title = entry.name;

      identity.append(level, name);
      nameRow.appendChild(identity);

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

      const xpRow = document.createElement('div');
      xpRow.classList.add('panel-roster__xp');
      const xpLabel = formatXpLabel(entry.progression);
      xpRow.textContent = xpLabel;
      xpRow.title = xpLabel;

      const callouts = document.createElement('div');
      callouts.classList.add('panel-roster__callouts');
      const calloutLabel = formatStatBonuses(entry.progression.statBonuses);
      callouts.textContent = calloutLabel;
      callouts.title = calloutLabel;

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

      button.append(nameRow, xpRow, meta, callouts, healthBar, traits);
      renderLoadout(button, entry, options);

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
