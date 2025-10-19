import { renderItemIcon } from '../components/ItemIcon.tsx';
import { renderModPill } from '../components/ModPill.tsx';
import type { SaunojaClass, SaunojaItem, SaunojaModifier } from '../../units/saunoja.ts';
import type { EquipmentSlotId, EquipmentModifier } from '../../items/types.ts';
import type { StatAwards } from '../../progression/experiencePlan.ts';
import type { UnitBehavior } from '../../unit/types.ts';

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
  readonly damageTakenMultiplier?: number;
  readonly tauntRadius?: number;
  readonly tauntActive?: boolean;
}

export interface RosterProgression {
  readonly level: number;
  readonly xp: number;
  readonly xpIntoLevel: number;
  readonly xpForNext: number | null;
  readonly progress: number;
  readonly statBonuses: StatAwards;
  readonly klass?: SaunojaClass | null;
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
  readonly behavior: UnitBehavior;
  readonly traits: readonly string[];
  readonly stats: RosterStats;
  readonly baseStats: RosterStats;
  readonly progression: RosterProgression;
  readonly equipment: readonly RosterEquipmentSlot[];
  readonly items: readonly RosterItem[];
  readonly modifiers: readonly RosterModifier[];
  readonly klass?: SaunojaClass | null;
}

export interface RosterPanelOptions {
  readonly onSelect?: (unitId: string) => void;
  readonly onEquipSlot?: (unitId: string, slot: EquipmentSlotId) => void;
  readonly onUnequipSlot?: (unitId: string, slot: EquipmentSlotId) => void;
  readonly onBehaviorChange?: (unitId: string, behavior: UnitBehavior) => void;
  readonly getRosterCap?: () => number;
  readonly getRosterCapLimit?: () => number;
  readonly updateMaxRosterSize?: (value: number, options?: { persist?: boolean }) => number;
  readonly onPromote?: (unitId: string, klass: SaunojaClass) => void;
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

const behaviorOrder: readonly UnitBehavior[] = ['defend', 'attack', 'explore'];

const behaviorLabels: Record<UnitBehavior, string> = {
  defend: 'Defend',
  attack: 'Attack',
  explore: 'Explore'
};

const saunojaClassLabels: Record<SaunojaClass, string> = {
  tank: 'Aegis Vanguard',
  rogue: 'Veilstrider',
  wizard: 'Aurora Sage',
  speedster: 'Gale Dancer'
};

const allSaunojaClasses: readonly SaunojaClass[] = ['tank', 'rogue', 'wizard', 'speedster'];

function resolveSaunojaClass(entry: RosterEntry): SaunojaClass | null {
  const klass = entry.klass ?? entry.progression.klass ?? null;
  return klass ?? null;
}

function formatSaunojaClassLabel(klass: SaunojaClass): string {
  return saunojaClassLabels[klass] ?? klass;
}

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
  const klass = resolveSaunojaClass(entry);
  const segments: string[] = [
    `HP ${integerFormatter.format(stats.health)}/${integerFormatter.format(stats.maxHealth)}${formatDelta(stats.maxHealth, baseStats.maxHealth)}`
  ];
  if (klass) {
    segments.push(`Class ${formatSaunojaClassLabel(klass)}`);
  }
  const mitigation = formatDamageMitigation(stats.damageTakenMultiplier);
  if (mitigation) {
    segments.push(mitigation);
  }
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
  if (typeof stats.tauntRadius === 'number' && stats.tauntRadius > 0) {
    const aura = integerFormatter.format(stats.tauntRadius);
    segments.push(`${stats.tauntActive ? 'Taunt active' : 'Taunt ready'} • ${aura}-hex aura`);
  }
  segments.push(`Upkeep ${integerFormatter.format(entry.upkeep)} beer`);
  return segments.join(' • ');
}

function formatDamageMitigation(multiplier?: number): string | null {
  if (typeof multiplier !== 'number' || !Number.isFinite(multiplier)) {
    return null;
  }
  const percent = Math.round((1 - multiplier) * 100);
  if (percent === 0) {
    return null;
  }
  const sign = percent > 0 ? '−' : '+';
  return `Damage taken ${sign}${integerFormatter.format(Math.abs(percent))}%`;
}

function buildPerkLine(entry: RosterEntry): string | null {
  const perks: string[] = [];
  const mitigation = formatDamageMitigation(entry.stats.damageTakenMultiplier);
  if (mitigation) {
    perks.push(mitigation);
  }
  if (typeof entry.stats.tauntRadius === 'number' && entry.stats.tauntRadius > 0) {
    const radius = integerFormatter.format(entry.stats.tauntRadius);
    const state = entry.stats.tauntActive ? 'Taunt active' : 'Taunt ready';
    perks.push(`${state} • ${radius}-hex aura`);
  }
  return perks.length > 0 ? perks.join(' • ') : null;
}

function buildAriaLabel(entry: RosterEntry): string {
  const { stats } = entry;
  const segments: string[] = [entry.name, rosterStatusLabels[entry.status]];
  segments.push(`level ${entry.progression.level}`);
  const klass = resolveSaunojaClass(entry);
  if (klass) {
    segments.push(`class ${formatSaunojaClassLabel(klass)}`);
  }
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

    const renderCapControl = (): void => {
      if (typeof options.getRosterCapLimit !== 'function' || typeof options.getRosterCap !== 'function') {
        return;
      }

      const capSection = document.createElement('section');
      capSection.classList.add('panel-roster__cap');

      const capHeader = document.createElement('div');
      capHeader.classList.add('panel-roster__cap-header');

      const capTitle = document.createElement('span');
      capTitle.classList.add('panel-roster__cap-title');
      capTitle.textContent = 'Roster Cap';
      capHeader.appendChild(capTitle);

      const capValue = document.createElement('span');
      capValue.classList.add('panel-roster__cap-value');
      capValue.setAttribute('aria-live', 'polite');
      capHeader.appendChild(capValue);

      capSection.appendChild(capHeader);

      const capDescription = document.createElement('p');
      capDescription.classList.add('panel-roster__cap-description');
      capDescription.textContent = 'Tune how many attendants rally before new recruits await the steam.';
      capSection.appendChild(capDescription);

      const sliderId = `panel-roster-cap-${Math.floor(Math.random() * 100000)}`;
      const sliderLabel = document.createElement('label');
      sliderLabel.classList.add('panel-roster__cap-label');
      sliderLabel.htmlFor = sliderId;
      sliderLabel.textContent = 'Active attendants';

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.id = sliderId;
      slider.min = '0';
      slider.step = '1';
      slider.classList.add('panel-roster__cap-slider');
      slider.setAttribute('aria-label', 'Roster cap');

      const numericInput = document.createElement('input');
      numericInput.type = 'number';
      numericInput.min = '0';
      numericInput.step = '1';
      numericInput.inputMode = 'numeric';
      numericInput.classList.add('panel-roster__cap-number');

      const controls = document.createElement('div');
      controls.classList.add('panel-roster__cap-controls');
      controls.append(sliderLabel, slider, numericInput);
      capSection.appendChild(controls);

      const resolveLimit = (): number => {
        const rawLimit = options.getRosterCapLimit?.();
        if (typeof rawLimit !== 'number' || !Number.isFinite(rawLimit)) {
          return 0;
        }
        return Math.max(0, Math.floor(rawLimit));
      };

      const readCapValue = (): number => {
        const rawValue = options.getRosterCap?.();
        if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
          return 0;
        }
        return Math.max(0, Math.floor(rawValue));
      };

      const updateDisplay = (limit: number, value: number): void => {
        const cappedValue = Math.max(0, Math.min(limit, Math.floor(value)));
        const formatted = integerFormatter.format(cappedValue);
        slider.max = String(limit);
        slider.value = String(cappedValue);
        slider.setAttribute('aria-valuemin', '0');
        slider.setAttribute('aria-valuemax', slider.max);
        slider.setAttribute('aria-valuenow', slider.value);
        numericInput.max = String(limit);
        numericInput.value = String(cappedValue);
        numericInput.setAttribute('aria-label', `Roster cap set to ${formatted}`);
        const valueLabel = cappedValue === 0 ? 'Paused' : formatted;
        capValue.textContent = valueLabel;
        capValue.dataset.state = cappedValue === 0 ? 'paused' : 'active';
      };

      const canAdjustCap = typeof options.updateMaxRosterSize === 'function';
      slider.disabled = !canAdjustCap;
      numericInput.disabled = !canAdjustCap;

      const applyCap = (raw: number, persist: boolean): void => {
        const limit = resolveLimit();
        const sanitized = Math.max(0, Math.min(limit, Number.isFinite(raw) ? Math.floor(raw) : 0));
        let applied = sanitized;
        if (canAdjustCap) {
          applied = options.updateMaxRosterSize!(sanitized, { persist });
        }
        updateDisplay(limit, applied);
      };

      updateDisplay(resolveLimit(), readCapValue());

      if (canAdjustCap) {
        slider.addEventListener('input', () => {
          applyCap(Number(slider.value), false);
        });
        slider.addEventListener('change', () => {
          applyCap(Number(slider.value), true);
        });
        const handleNumeric = (persist: boolean) => {
          applyCap(Number(numericInput.value), persist);
        };
        numericInput.addEventListener('input', () => handleNumeric(false));
        numericInput.addEventListener('change', () => handleNumeric(true));
        numericInput.addEventListener('blur', () => handleNumeric(true));
      }

      container.appendChild(capSection);
    };

    renderCapControl();

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
      const resolvedClass = resolveSaunojaClass(entry);
      if (resolvedClass) {
        const classBadge = document.createElement('span');
        classBadge.classList.add('panel-roster__class');
        classBadge.dataset.klass = resolvedClass;
        const label = formatSaunojaClassLabel(resolvedClass);
        classBadge.textContent = label;
        classBadge.title = `${entry.name} specializes as ${label}`;
        classBadge.setAttribute('aria-label', `Class ${label}`);
        identity.appendChild(classBadge);
      }
      nameRow.appendChild(identity);

      const badge = document.createElement('span');
      badge.classList.add('panel-roster__status');
      badge.dataset.status = entry.status;
      badge.textContent = rosterStatusLabels[entry.status];
      nameRow.appendChild(badge);

      const behaviorRow = document.createElement('div');
      behaviorRow.classList.add('panel-roster__behavior');

      const behaviorHeader = document.createElement('div');
      behaviorHeader.classList.add('panel-roster__behavior-header');

      const behaviorLabel = document.createElement('span');
      behaviorLabel.classList.add('panel-roster__behavior-label');
      behaviorLabel.textContent = 'Behavior';

      const behaviorValue = document.createElement('span');
      behaviorValue.classList.add('panel-roster__behavior-value');
      behaviorValue.textContent = behaviorLabels[entry.behavior];

      behaviorHeader.append(behaviorLabel, behaviorValue);
      behaviorRow.appendChild(behaviorHeader);

      const behaviorControls = document.createElement('div');
      behaviorControls.classList.add('panel-roster__behavior-options');
      behaviorControls.setAttribute('role', 'group');
      behaviorControls.setAttribute('aria-label', `${entry.name} behavior`);

      const hasBehaviorHandler = typeof options.onBehaviorChange === 'function';
      for (const behavior of behaviorOrder) {
        const behaviorButton = document.createElement('button');
        behaviorButton.type = 'button';
        behaviorButton.classList.add('panel-roster__behavior-option');
        behaviorButton.dataset.behavior = behavior;
        const label = behaviorLabels[behavior];
        behaviorButton.textContent = label;
        const title = `Set ${entry.name} to ${label}`;
        behaviorButton.title = title;
        behaviorButton.setAttribute('aria-label', title);
        const isActive = behavior === entry.behavior;
        behaviorButton.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        behaviorButton.classList.toggle('is-active', isActive);
        behaviorButton.disabled = !hasBehaviorHandler;
        behaviorButton.addEventListener('click', (event) => {
          event.stopPropagation();
          if (!hasBehaviorHandler || behavior === entry.behavior) {
            return;
          }
          options.onBehaviorChange?.(entry.id, behavior);
        });
        behaviorControls.appendChild(behaviorButton);
      }

      behaviorRow.appendChild(behaviorControls);

      const meta = document.createElement('div');
      meta.classList.add('panel-roster__meta');
      const metaLabel = buildMetaLine(entry);
      meta.textContent = metaLabel;
      meta.title = metaLabel;

      const perkLine = buildPerkLine(entry);
      let perks: HTMLDivElement | null = null;
      if (perkLine) {
        perks = document.createElement('div');
        perks.classList.add('panel-roster__perks');
        perks.textContent = perkLine;
        perks.title = perkLine;
      }

      const xpRow = document.createElement('div');
      xpRow.classList.add('panel-roster__xp');
      const xpLabel = formatXpLabel(entry.progression);
      xpRow.textContent = xpLabel;
      xpRow.title = xpLabel;

      let promotionRow: HTMLDivElement | null = null;
      const canPromote =
        entry.progression.xpForNext === null && !resolvedClass && typeof options.onPromote === 'function';
      if (canPromote) {
        promotionRow = document.createElement('div');
        promotionRow.classList.add('panel-roster__promotion');

        const promotionHeader = document.createElement('div');
        promotionHeader.classList.add('panel-roster__promotion-header');

        const promotionTitle = document.createElement('span');
        promotionTitle.classList.add('panel-roster__promotion-title');
        promotionTitle.textContent = 'Choose a calling';
        promotionHeader.appendChild(promotionTitle);

        const promotionSubtitle = document.createElement('span');
        promotionSubtitle.classList.add('panel-roster__promotion-subtitle');
        promotionSubtitle.textContent = 'Unlock a signature combat role';
        promotionHeader.appendChild(promotionSubtitle);

        const promotionActions = document.createElement('div');
        promotionActions.classList.add('panel-roster__promotion-actions');

        const promoteButton = document.createElement('button');
        promoteButton.type = 'button';
        promoteButton.classList.add('panel-roster__promote');
        promoteButton.textContent = 'Select specialization';
        promoteButton.setAttribute('aria-expanded', 'false');
        const optionsId = `panel-roster-promote-${entry.id}`;
        promoteButton.setAttribute('aria-controls', optionsId);

        const optionList = document.createElement('div');
        optionList.id = optionsId;
        optionList.classList.add('panel-roster__promote-options');
        optionList.hidden = true;
        optionList.setAttribute('role', 'list');
        optionList.setAttribute('aria-hidden', 'true');

        const closeOptions = () => {
          optionList.hidden = true;
          optionList.setAttribute('aria-hidden', 'true');
          promoteButton.setAttribute('aria-expanded', 'false');
          promoteButton.dataset.open = 'false';
        };

        promoteButton.addEventListener('click', (event) => {
          event.stopPropagation();
          const nextHidden = !optionList.hidden;
          if (nextHidden) {
            closeOptions();
            return;
          }
          optionList.hidden = false;
          optionList.setAttribute('aria-hidden', 'false');
          promoteButton.setAttribute('aria-expanded', 'true');
          promoteButton.dataset.open = 'true';
        });

        for (const klass of allSaunojaClasses) {
          const option = document.createElement('button');
          option.type = 'button';
          option.classList.add('panel-roster__promote-option');
          option.dataset.klass = klass;
          const label = formatSaunojaClassLabel(klass);
          option.textContent = label;
          option.title = `Promote ${entry.name} to ${label}`;
          option.setAttribute('role', 'listitem');
          option.addEventListener('click', (event) => {
            event.stopPropagation();
            closeOptions();
            options.onPromote?.(entry.id, klass);
          });
          optionList.appendChild(option);
        }

        promotionActions.append(promoteButton, optionList);
        promotionRow.append(promotionHeader, promotionActions);
      }

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

      button.append(nameRow, behaviorRow, xpRow);
      if (promotionRow) {
        button.appendChild(promotionRow);
      }
      if (perks) {
        button.append(meta, perks, callouts, healthBar, traits);
      } else {
        button.append(meta, callouts, healthBar, traits);
      }
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
