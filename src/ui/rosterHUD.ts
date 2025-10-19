import {
  ensureHudLayout,
  getHudOverlayElement,
  type HudBottomTabId,
  ROSTER_HUD_OPEN_CLASS,
} from './layout.ts';
import type { RosterEntry, RosterProgression } from './rightPanel.tsx';
import type { SaunojaClass } from '../units/saunoja.ts';
import type { UnitBehavior } from '../unit/types.ts';

const rosterCountFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const rosterUpkeepFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const behaviorLabels: Record<UnitBehavior, string> = {
  defend: 'Defend',
  attack: 'Attack',
  explore: 'Explore'
};
const behaviorOrder: readonly UnitBehavior[] = ['defend', 'attack', 'explore'];

const saunojaClassLabels: Record<SaunojaClass, string> = {
  tank: 'Aegis Vanguard',
  rogue: 'Veilstrider',
  wizard: 'Aurora Sage',
  speedster: 'Gale Dancer'
};

const allSaunojaClasses: readonly SaunojaClass[] = ['tank', 'rogue', 'wizard', 'speedster'];

function resolveSaunojaClass(
  card: Pick<RosterCardViewModel, 'klass' | 'progression'>
): SaunojaClass | null {
  return card.klass ?? card.progression.klass ?? null;
}

function formatSaunojaClassLabel(klass: SaunojaClass): string {
  return saunojaClassLabels[klass] ?? klass;
}

type RosterHudOptions = {
  rosterIcon: string;
  summaryLabel?: string;
  onBehaviorChange?: (unitId: string, behavior: UnitBehavior) => void;
  onPromote?: (unitId: string, klass: SaunojaClass) => void;
};

export type RosterCardViewModel = {
  id: string;
  name: string;
  traits: readonly string[];
  upkeep: number;
  progression: RosterProgression;
  behavior: UnitBehavior;
  klass?: SaunojaClass | null;
  damageTakenMultiplier?: number;
  tauntRadius?: number;
  tauntActive?: boolean;
};

export type RosterHudSummary = {
  count: number;
  card: RosterCardViewModel | null;
};

export type RosterHudController = {
  updateSummary(summary: RosterHudSummary): void;
  installRenderer(renderer: (entries: RosterEntry[]) => void): void;
  renderRoster(entries: RosterEntry[]): void;
  setExpanded(expanded: boolean): void;
  toggleExpanded(): void;
  connectPanelBridge(bridge: {
    openRosterView: () => void;
    closeRosterView: () => void;
    onRosterVisibilityChange: (listener: (isOpen: boolean) => void) => () => void;
  } | null): void;
  destroy(): void;
};

function formatProgressPercent(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(progress * 100)));
}

function formatXpLabel(progression: RosterProgression): string {
  const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  if (progression.xpForNext === null) {
    return `${formatter.format(progression.xp)} XP • Max level`;
  }
  const percent = formatProgressPercent(progression.progress);
  return `${formatter.format(progression.xpIntoLevel)} / ${formatter.format(progression.xpForNext)} XP • ${percent}%`;
}

function formatPerkSummary(card: RosterCardViewModel): { text: string; active: boolean } | null {
  const parts: string[] = [];
  if (typeof card.damageTakenMultiplier === 'number' && Number.isFinite(card.damageTakenMultiplier)) {
    const percent = Math.round((1 - card.damageTakenMultiplier) * 100);
    if (percent !== 0) {
      const sign = percent > 0 ? '−' : '+';
      parts.push(`Damage taken ${sign}${rosterUpkeepFormatter.format(Math.abs(percent))}%`);
    }
  }
  if (typeof card.tauntRadius === 'number' && card.tauntRadius > 0) {
    const radius = rosterUpkeepFormatter.format(card.tauntRadius);
    const state = card.tauntActive ? 'Taunt active' : 'Taunt ready';
    parts.push(`${state} • ${radius}-hex aura`);
  }
  if (parts.length === 0) {
    return null;
  }
  return { text: parts.join(' • '), active: Boolean(card.tauntActive) };
}

function formatStatBonuses(bonuses: RosterProgression['statBonuses']): string {
  const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const parts: string[] = [];
  if (bonuses.vigor > 0) {
    parts.push(`+${formatter.format(bonuses.vigor)} Vigor`);
  }
  if (bonuses.focus > 0) {
    parts.push(`+${formatter.format(bonuses.focus)} Focus`);
  }
  if (bonuses.resolve > 0) {
    parts.push(`+${formatter.format(bonuses.resolve)} Resolve`);
  }
  return parts.length > 0 ? parts.join(' • ') : 'No level bonuses yet';
}

export function setupRosterHUD(
  container: HTMLElement,
  options: RosterHudOptions
): RosterHudController {
  const { rosterIcon, summaryLabel = 'Saunoja Roster' } = options;

  const doc = container.ownerDocument ?? document;
  const overlay =
    container.closest<HTMLElement>('#ui-overlay') ?? getHudOverlayElement({ doc });
  const layout = overlay ? ensureHudLayout(overlay) : null;
  const bottomTabs = layout?.tabs ?? null;
  let suppressTabSync = false;
  let isOverlayOpen = false;
  let detachRosterVisibility: (() => void) | null = null;

  if (overlay?.classList.contains(ROSTER_HUD_OPEN_CLASS)) {
    overlay.classList.remove(ROSTER_HUD_OPEN_CLASS);
  }

  if (bottomTabs) {
    const activeTab = bottomTabs.getActive();
    bottomTabs.setActive(activeTab);
  }

  const rosterPanelId =
    container.id && container.id.trim().length > 0 ? container.id : 'resource-bar';
  if (!container.id || container.id.trim().length === 0) {
    container.id = rosterPanelId;
  }

  const syncBottomTab = (id: HudBottomTabId): void => {
    if (!bottomTabs) {
      return;
    }
    if (bottomTabs.getActive() === id) {
      return;
    }
    suppressTabSync = true;
    try {
      bottomTabs.setActive(id);
    } finally {
      suppressTabSync = false;
    }
  };

  container.classList.add('hud-bottom-tabs__panel');
  container.classList.add('hud-bottom-tabs__panel--roster');
  container.replaceChildren();

  const root = doc.createElement('section');
  root.classList.add('sauna-roster');
  root.dataset.expanded = 'false';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('title', 'Active sauna battalion on the field');
  root.dataset.tutorialTarget = 'upkeep';

  const header = document.createElement('div');
  header.classList.add('sauna-roster__header');

  const summary = document.createElement('div');
  summary.classList.add('sauna-roster__summary');

  const icon = document.createElement('img');
  icon.src = rosterIcon;
  icon.alt = 'Saunoja roster crest';
  icon.decoding = 'async';
  icon.classList.add('sauna-roster__icon');

  const textContainer = document.createElement('div');
  textContainer.classList.add('sauna-roster__text');

  const labelSpan = document.createElement('span');
  labelSpan.textContent = summaryLabel;
  labelSpan.classList.add('sauna-roster__label');

  const rosterValue = document.createElement('span');
  rosterValue.textContent = '0';
  rosterValue.classList.add('sauna-roster__value');

  textContainer.append(labelSpan, rosterValue);
  summary.append(icon, textContainer);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.classList.add('sauna-roster__toggle');
  toggle.setAttribute('aria-expanded', 'false');
  const detailsId = `sauna-roster-details-${Math.floor(Math.random() * 100000)}`;
  toggle.setAttribute('aria-controls', detailsId);

  const toggleLabel = document.createElement('span');
  toggleLabel.classList.add('sauna-roster__toggle-label');
  toggleLabel.textContent = 'Show details';

  const detailToggleIcon = document.createElement('span');
  detailToggleIcon.classList.add('sauna-roster__toggle-icon');
  detailToggleIcon.setAttribute('aria-hidden', 'true');

  toggle.append(toggleLabel, detailToggleIcon);

  header.append(summary, toggle);

  const details = document.createElement('div');
  details.classList.add('sauna-roster__details');
  details.id = detailsId;
  details.hidden = true;
  details.setAttribute('aria-hidden', 'true');

  const rosterCard = document.createElement('div');
  rosterCard.classList.add('saunoja-card');
  rosterCard.setAttribute('aria-live', 'polite');
  rosterCard.hidden = true;

  const rosterCardHeader = document.createElement('div');
  rosterCardHeader.classList.add('saunoja-card__header');

  const rosterCardLevel = document.createElement('div');
  rosterCardLevel.classList.add('saunoja-card__level');
  rosterCardLevel.setAttribute('role', 'img');
  rosterCardLevel.style.setProperty('--level-progress', '0%');
  const rosterCardLevelValue = document.createElement('span');
  rosterCardLevelValue.classList.add('saunoja-card__level-value');
  rosterCardLevelValue.textContent = '1';
  rosterCardLevel.appendChild(rosterCardLevelValue);

  const rosterCardIdentity = document.createElement('div');
  rosterCardIdentity.classList.add('saunoja-card__identity');

  const rosterCardName = document.createElement('h3');
  rosterCardName.classList.add('saunoja-card__name');
  rosterCardName.textContent = 'Saunoja';

  const rosterCardClass = document.createElement('span');
  rosterCardClass.classList.add('saunoja-card__class');
  rosterCardClass.hidden = true;

  const rosterCardXp = document.createElement('div');
  rosterCardXp.classList.add('saunoja-card__xp');
  rosterCardXp.textContent = '0 / 0 XP • 0%';

  const rosterCardBehavior = document.createElement('div');
  rosterCardBehavior.classList.add('saunoja-card__behavior');

  const rosterCardBehaviorHeader = document.createElement('div');
  rosterCardBehaviorHeader.classList.add('saunoja-card__behavior-header');

  const rosterCardBehaviorLabel = document.createElement('span');
  rosterCardBehaviorLabel.classList.add('saunoja-card__behavior-label');
  rosterCardBehaviorLabel.textContent = 'Behavior';

  const rosterCardBehaviorValue = document.createElement('span');
  rosterCardBehaviorValue.classList.add('saunoja-card__behavior-value');
  rosterCardBehaviorValue.textContent = behaviorLabels.defend;

  rosterCardBehaviorHeader.append(rosterCardBehaviorLabel, rosterCardBehaviorValue);

  const rosterCardBehaviorOptions = document.createElement('div');
  rosterCardBehaviorOptions.classList.add('saunoja-card__behavior-options');
  rosterCardBehaviorOptions.setAttribute('role', 'group');
  rosterCardBehaviorOptions.setAttribute('aria-label', 'Saunoja behavior');

  const behaviorButtons = new Map<UnitBehavior, HTMLButtonElement>();
  const behaviorClickHandlers = new Map<HTMLButtonElement, () => void>();
  const promotionClickHandlers = new Map<HTMLButtonElement, () => void>();

  for (const behavior of behaviorOrder) {
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.add('saunoja-card__behavior-option');
    button.dataset.behavior = behavior;
    const label = behaviorLabels[behavior] ?? behavior;
    button.textContent = label;
    const title = `Set behavior to ${label}`;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.setAttribute('aria-pressed', behavior === 'defend' ? 'true' : 'false');
    button.classList.toggle('is-active', behavior === 'defend');
    const handleClick = () => {
      const handler = options.onBehaviorChange;
      const unitId = rosterCard.dataset.unitId;
      if (!handler || !unitId) {
        return;
      }
      if (button.disabled || button.getAttribute('aria-pressed') === 'true') {
        return;
      }
      handler(unitId, behavior);
    };
    button.addEventListener('click', handleClick);
    behaviorButtons.set(behavior, button);
    behaviorClickHandlers.set(button, handleClick);
    rosterCardBehaviorOptions.appendChild(button);
  }

  if (!options.onBehaviorChange) {
    rosterCardBehaviorOptions.setAttribute('aria-disabled', 'true');
    for (const button of behaviorButtons.values()) {
      button.disabled = true;
    }
  }

  rosterCardBehavior.append(rosterCardBehaviorHeader, rosterCardBehaviorOptions);

  rosterCardIdentity.append(rosterCardName, rosterCardClass, rosterCardXp);
  rosterCardHeader.append(rosterCardLevel, rosterCardIdentity);

  const rosterCardPromotion = document.createElement('div');
  rosterCardPromotion.classList.add('saunoja-card__promotion');
  rosterCardPromotion.hidden = true;

  const rosterCardPromotionHeader = document.createElement('div');
  rosterCardPromotionHeader.classList.add('saunoja-card__promotion-header');

  const rosterCardPromotionTitle = document.createElement('span');
  rosterCardPromotionTitle.classList.add('saunoja-card__promotion-title');
  rosterCardPromotionTitle.textContent = 'Choose a calling';
  rosterCardPromotionHeader.appendChild(rosterCardPromotionTitle);

  const rosterCardPromotionSubtitle = document.createElement('span');
  rosterCardPromotionSubtitle.classList.add('saunoja-card__promotion-subtitle');
  rosterCardPromotionSubtitle.textContent = 'Unlock a signature combat role';
  rosterCardPromotionHeader.appendChild(rosterCardPromotionSubtitle);

  const rosterCardPromotionActions = document.createElement('div');
  rosterCardPromotionActions.classList.add('saunoja-card__promotion-actions');

  const rosterCardPromotionButton = document.createElement('button');
  rosterCardPromotionButton.type = 'button';
  rosterCardPromotionButton.classList.add('saunoja-card__promote');
  rosterCardPromotionButton.textContent = 'Select specialization';
  rosterCardPromotionButton.setAttribute('aria-expanded', 'false');

  const rosterCardPromotionOptions = document.createElement('div');
  rosterCardPromotionOptions.classList.add('saunoja-card__promote-options');
  rosterCardPromotionOptions.hidden = true;
  rosterCardPromotionOptions.setAttribute('role', 'list');
  rosterCardPromotionOptions.setAttribute('aria-hidden', 'true');

  rosterCardPromotionActions.append(rosterCardPromotionButton, rosterCardPromotionOptions);
  rosterCardPromotion.append(rosterCardPromotionHeader, rosterCardPromotionActions);

  const closePromotionOptions = () => {
    rosterCardPromotionOptions.hidden = true;
    rosterCardPromotionOptions.setAttribute('aria-hidden', 'true');
    rosterCardPromotionButton.setAttribute('aria-expanded', 'false');
    rosterCardPromotionButton.dataset.open = 'false';
  };

  const promotionToggleHandler = (event: MouseEvent) => {
    event.stopPropagation();
    if (rosterCardPromotionOptions.hidden) {
      rosterCardPromotionOptions.hidden = false;
      rosterCardPromotionOptions.setAttribute('aria-hidden', 'false');
      rosterCardPromotionButton.setAttribute('aria-expanded', 'true');
      rosterCardPromotionButton.dataset.open = 'true';
    } else {
      closePromotionOptions();
    }
  };

  rosterCardPromotionButton.addEventListener('click', promotionToggleHandler);

  for (const klass of allSaunojaClasses) {
    const option = document.createElement('button');
    option.type = 'button';
    option.classList.add('saunoja-card__promote-option');
    option.dataset.klass = klass;
    const label = formatSaunojaClassLabel(klass);
    option.textContent = label;
    option.title = `Promote to ${label}`;
    option.setAttribute('role', 'listitem');
    const handler = () => {
      const unitId = rosterCard.dataset.unitId;
      if (!unitId) {
        return;
      }
      if (!options.onPromote) {
        return;
      }
      closePromotionOptions();
      options.onPromote(unitId, klass);
    };
    option.addEventListener('click', handler);
    promotionClickHandlers.set(option, handler);
    rosterCardPromotionOptions.appendChild(option);
  }

  const rosterCardTraits = document.createElement('p');
  rosterCardTraits.classList.add('saunoja-card__traits');

  const rosterCardStats = document.createElement('div');
  rosterCardStats.classList.add('saunoja-card__callouts');
  rosterCardStats.textContent = 'No level bonuses yet';

  const rosterCardPerks = document.createElement('div');
  rosterCardPerks.classList.add('saunoja-card__perks');
  rosterCardPerks.hidden = true;

  const rosterCardUpkeep = document.createElement('p');
  rosterCardUpkeep.classList.add('saunoja-card__upkeep');

  rosterCard.append(
    rosterCardHeader,
    rosterCardBehavior,
    rosterCardPromotion,
    rosterCardTraits,
    rosterCardStats,
    rosterCardPerks,
    rosterCardUpkeep
  );
  details.appendChild(rosterCard);
  root.append(header, details);
  container.append(root);

  let rosterRenderer: ((entries: RosterEntry[]) => void) | null = null;
  let rosterSignature: string | null = null;
  let isExpanded = false;
  let hasFeaturedCard = false;

  function applyDetailVisibility(): void {
    const allowDetails = hasFeaturedCard && isExpanded;
    root.dataset.expanded = allowDetails ? 'true' : 'false';
    root.classList.toggle('sauna-roster--expanded', allowDetails);
    details.hidden = !allowDetails;
    details.setAttribute('aria-hidden', allowDetails ? 'false' : 'true');
    rosterCard.hidden = !hasFeaturedCard || !allowDetails;

    if (!hasFeaturedCard) {
      toggle.disabled = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Roster details unavailable');
      toggle.title = 'Roster details unavailable';
      toggleLabel.textContent = 'Details unavailable';
      detailToggleIcon.dataset.state = 'closed';
      return;
    }

    toggle.disabled = false;
    toggle.setAttribute('aria-expanded', allowDetails ? 'true' : 'false');
    const verb = allowDetails ? 'Hide' : 'Show';
    const label = `${verb} roster details`;
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    toggleLabel.textContent = `${verb} details`;
    detailToggleIcon.dataset.state = allowDetails ? 'open' : 'closed';
  }

  function setExpanded(next: boolean): void {
    isExpanded = next && hasFeaturedCard;
    applyDetailVisibility();
  }

  function setOverlayOpen(next: boolean, options: { suppressSync?: boolean } = {}): void {
    const safeNext = Boolean(next);
    isOverlayOpen = safeNext;
    if (overlay) {
      overlay.classList.toggle(ROSTER_HUD_OPEN_CLASS, safeNext);
    }
    if (bottomTabs) {
      const activeTab = bottomTabs.getActive();
      bottomTabs.setActive(activeTab);
    }
    if (safeNext) {
      if (!options.suppressSync) {
        syncBottomTab('roster');
      }
      setExpanded(true);
    } else {
      setExpanded(false);
    }
  }

  function connectPanelBridge(
    bridge:
      | {
          openRosterView: () => void;
          closeRosterView: () => void;
          onRosterVisibilityChange: (listener: (isOpen: boolean) => void) => () => void;
        }
      | null
  ): void {
    detachRosterVisibility?.();
    detachRosterVisibility = null;

    if (!bridge) {
      setOverlayOpen(false, { suppressSync: true });
      return;
    }

    detachRosterVisibility = bridge.onRosterVisibilityChange((open) => {
      if (isOverlayOpen === open) {
        return;
      }
      setOverlayOpen(open);
    });
  }

  connectPanelBridge(null);

  const handleToggleClick = () => {
    const next = !isExpanded;
    if (next && !suppressTabSync) {
      syncBottomTab('roster');
    }
    setExpanded(next);
  };
  toggle.addEventListener('click', handleToggleClick);

  applyDetailVisibility();

  function renderCard(card: RosterCardViewModel | null): void {
    hasFeaturedCard = Boolean(card);
    if (!card) {
      delete rosterCard.dataset.unitId;
      rosterCardPerks.hidden = true;
      rosterCardPerks.textContent = '';
      delete rosterCardPerks.dataset.active;
      setExpanded(false);
      return;
    }

    rosterCard.hidden = false;
    rosterCard.dataset.unitId = card.id;

    rosterCardName.textContent = card.name || 'Saunoja';

    const resolvedClass = resolveSaunojaClass(card);
    if (resolvedClass) {
      const label = formatSaunojaClassLabel(resolvedClass);
      rosterCardClass.hidden = false;
      rosterCardClass.dataset.klass = resolvedClass;
      rosterCardClass.textContent = label;
      rosterCardClass.title = `${card.name || 'Saunoja'} specializes as ${label}`;
    } else {
      rosterCardClass.hidden = true;
      rosterCardClass.textContent = '';
      rosterCardClass.title = '';
      delete rosterCardClass.dataset.klass;
    }

    const traitList = card.traits.filter((trait) => trait.length > 0);
    const traitLabel = traitList.length > 0 ? traitList.join(', ') : 'No notable traits yet';
    rosterCardTraits.textContent = traitLabel;
    rosterCardTraits.title = traitLabel;

    const xpLabel = formatXpLabel(card.progression);
    rosterCardXp.textContent = xpLabel;
    rosterCardXp.title = xpLabel;

    const progressPercent = formatProgressPercent(card.progression.progress);
    rosterCardLevel.style.setProperty('--level-progress', `${progressPercent}%`);
    rosterCardLevelValue.textContent = String(card.progression.level);
    const levelAria =
      card.progression.xpForNext === null
        ? `Level ${card.progression.level}, at mastery`
        : `Level ${card.progression.level}, ${progressPercent}% toward next level`;
    rosterCardLevel.setAttribute('aria-label', levelAria);

    const bonusLabel = formatStatBonuses(card.progression.statBonuses);
    rosterCardStats.textContent = bonusLabel;
    rosterCardStats.title = bonusLabel;

    const perkSummary = formatPerkSummary(card);
    if (perkSummary) {
      rosterCardPerks.hidden = false;
      rosterCardPerks.textContent = perkSummary.text;
      rosterCardPerks.title = perkSummary.text;
      rosterCardPerks.dataset.active = perkSummary.active ? 'true' : 'false';
    } else {
      rosterCardPerks.hidden = true;
      rosterCardPerks.textContent = '';
      rosterCardPerks.title = '';
      delete rosterCardPerks.dataset.active;
    }

    const behaviorLabel = behaviorLabels[card.behavior] ?? card.behavior;
    rosterCardBehaviorValue.textContent = behaviorLabel;
    rosterCardBehaviorValue.title = `Behavior: ${behaviorLabel}`;
    rosterCardBehaviorOptions.setAttribute(
      'aria-label',
      `${card.name || 'Saunoja'} behavior`
    );
    const hasBehaviorHandler = Boolean(options.onBehaviorChange);
    if (hasBehaviorHandler) {
      rosterCardBehaviorOptions.setAttribute('aria-disabled', 'false');
    } else {
      rosterCardBehaviorOptions.setAttribute('aria-disabled', 'true');
    }
    for (const [behavior, button] of behaviorButtons.entries()) {
      const isActive = behavior === card.behavior;
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      button.classList.toggle('is-active', isActive);
      button.disabled = !hasBehaviorHandler;
    }

    const upkeepValue = Math.max(0, Math.round(card.upkeep));
    const upkeepLabel = `Upkeep: ${rosterUpkeepFormatter.format(upkeepValue)} Beer`;
    rosterCardUpkeep.textContent = upkeepLabel;
    rosterCardUpkeep.title = upkeepLabel;

    const canPromote =
      card.progression.xpForNext === null && !resolvedClass && typeof options.onPromote === 'function';
    rosterCardPromotion.hidden = !canPromote;
    rosterCardPromotionButton.disabled = !canPromote;
    if (!canPromote) {
      closePromotionOptions();
    }

    applyDetailVisibility();
  }

  function encodeTimerValue(value: number | typeof Infinity): string {
    if (value === Infinity) {
      return 'inf';
    }
    if (!Number.isFinite(value) || value <= 0) {
      return '0';
    }
    return String(Math.ceil(value));
  }

  function encodeRosterItem(item: RosterEntry['items'][number]): string {
    return [
      item.id,
      item.name,
      item.icon ?? '',
      item.rarity ?? '',
      item.description ?? '',
      item.quantity
    ].join('^');
  }

  function encodeRosterModifier(modifier: RosterEntry['modifiers'][number]): string {
    return [
      modifier.id,
      modifier.name,
      modifier.description ?? '',
      encodeTimerValue(modifier.duration),
      encodeTimerValue(modifier.remaining),
      modifier.appliedAt ?? '',
      modifier.stacks ?? 1,
      modifier.source ?? ''
    ].join('^');
  }

  function encodeRosterEntry(entry: RosterEntry): string {
    const { stats } = entry;
    const traitSig = entry.traits.join('|');
    const itemSig = entry.items.map(encodeRosterItem).join('|');
    const modifierSig = entry.modifiers.map(encodeRosterModifier).join('|');
    return [
      entry.id,
      entry.name,
      entry.upkeep,
      entry.status,
      entry.behavior,
      entry.klass ?? entry.progression.klass ?? '',
      entry.selected ? 1 : 0,
      entry.progression.level,
      entry.progression.xp,
      entry.progression.xpIntoLevel,
      entry.progression.xpForNext ?? 'max',
      stats.health,
      stats.maxHealth,
      stats.attackDamage,
      stats.attackRange,
      stats.movementRange,
      stats.defense ?? 0,
      stats.shield ?? 0,
      stats.damageTakenMultiplier ?? 1,
      stats.tauntRadius ?? 0,
      stats.tauntActive ? 1 : 0,
      traitSig,
      itemSig,
      modifierSig
    ].join('~');
  }

  function createRosterSignature(entries: readonly RosterEntry[]): string {
    return `${entries.length}:${entries.map(encodeRosterEntry).join('||')}`;
  }

  return {
    updateSummary(summary) {
      const total = Math.max(0, Math.floor(summary.count));
      const formatted = rosterCountFormatter.format(total);
      rosterValue.textContent = formatted;
      root.setAttribute('aria-label', `Saunoja roster: ${formatted} active attendants`);
      root.setAttribute('title', `Saunoja roster • ${formatted} active attendants`);
      renderCard(summary.card);
    },
    installRenderer(renderer) {
      rosterSignature = null;
      rosterRenderer = renderer;
    },
    renderRoster(entries) {
      if (!rosterRenderer) {
        return;
      }
      const signature = createRosterSignature(entries);
      if (signature === rosterSignature) {
        return;
      }
      rosterSignature = signature;
      rosterRenderer(entries);
    },
    setExpanded,
    toggleExpanded() {
      setExpanded(!isExpanded);
    },
    connectPanelBridge,
    destroy() {
      rosterRenderer = null;
      rosterSignature = null;
      toggle.removeEventListener('click', handleToggleClick);
      for (const [button, handler] of behaviorClickHandlers.entries()) {
        button.removeEventListener('click', handler);
      }
      rosterCardPromotionButton.removeEventListener('click', promotionToggleHandler);
      for (const [button, handler] of promotionClickHandlers.entries()) {
        button.removeEventListener('click', handler);
      }
      detachRosterVisibility?.();
      detachRosterVisibility = null;
      if (overlay) {
        overlay.classList.remove(ROSTER_HUD_OPEN_CLASS);
      }
      isOverlayOpen = false;
      container.replaceChildren();
    }
  } satisfies RosterHudController;
}
