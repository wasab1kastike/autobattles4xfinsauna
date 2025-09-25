import { ensureHudLayout } from './layout.ts';
import type { RosterEntry, RosterProgression } from './rightPanel.tsx';
import type { UnitBehavior } from '../unit/types.ts';

const rosterCountFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const rosterUpkeepFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const behaviorLabels: Record<UnitBehavior, string> = {
  defend: 'Defend',
  attack: 'Attack',
  explore: 'Explore'
};

type RosterHudOptions = {
  rosterIcon: string;
  summaryLabel?: string;
};

export type RosterCardViewModel = {
  id: string;
  name: string;
  traits: readonly string[];
  upkeep: number;
  progression: RosterProgression;
  behavior: UnitBehavior;
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
    container.closest<HTMLElement>('#ui-overlay') ?? doc.getElementById('ui-overlay');
  if (overlay) {
    ensureHudLayout(overlay);
  }

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

  const toggleIcon = document.createElement('span');
  toggleIcon.classList.add('sauna-roster__toggle-icon');
  toggleIcon.setAttribute('aria-hidden', 'true');

  toggle.append(toggleLabel, toggleIcon);

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

  const rosterCardXp = document.createElement('div');
  rosterCardXp.classList.add('saunoja-card__xp');
  rosterCardXp.textContent = '0 / 0 XP • 0%';

  const rosterCardBehavior = document.createElement('p');
  rosterCardBehavior.classList.add('saunoja-card__behavior');
  rosterCardBehavior.textContent = 'Behavior: Defend';

  rosterCardIdentity.append(rosterCardName, rosterCardXp);
  rosterCardHeader.append(rosterCardLevel, rosterCardIdentity);

  const rosterCardTraits = document.createElement('p');
  rosterCardTraits.classList.add('saunoja-card__traits');

  const rosterCardStats = document.createElement('div');
  rosterCardStats.classList.add('saunoja-card__callouts');
  rosterCardStats.textContent = 'No level bonuses yet';

  const rosterCardUpkeep = document.createElement('p');
  rosterCardUpkeep.classList.add('saunoja-card__upkeep');

  rosterCard.append(
    rosterCardHeader,
    rosterCardBehavior,
    rosterCardTraits,
    rosterCardStats,
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
      toggleIcon.dataset.state = 'closed';
      return;
    }

    toggle.disabled = false;
    toggle.setAttribute('aria-expanded', allowDetails ? 'true' : 'false');
    const verb = allowDetails ? 'Hide' : 'Show';
    const label = `${verb} roster details`;
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    toggleLabel.textContent = `${verb} details`;
    toggleIcon.dataset.state = allowDetails ? 'open' : 'closed';
  }

  function setExpanded(next: boolean): void {
    isExpanded = next && hasFeaturedCard;
    applyDetailVisibility();
  }

  const handleToggleClick = () => {
    const next = !isExpanded;
    setExpanded(next);
  };
  toggle.addEventListener('click', handleToggleClick);

  const handleExpandRequest = () => {
    setExpanded(true);
  };
  const handleCollapseRequest = () => {
    setExpanded(false);
  };
  const handleToggleRequest = () => {
    const next = !isExpanded;
    setExpanded(next);
  };

  container.addEventListener('sauna-roster:expand', handleExpandRequest);
  container.addEventListener('sauna-roster:collapse', handleCollapseRequest);
  container.addEventListener('sauna-roster:toggle', handleToggleRequest);

  applyDetailVisibility();

  function renderCard(card: RosterCardViewModel | null): void {
    hasFeaturedCard = Boolean(card);
    if (!card) {
      setExpanded(false);
      return;
    }

    rosterCard.hidden = false;
    rosterCard.dataset.unitId = card.id;

    rosterCardName.textContent = card.name || 'Saunoja';

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

    const behaviorLabel = behaviorLabels[card.behavior] ?? card.behavior;
    const behaviorCopy = `Behavior: ${behaviorLabel}`;
    rosterCardBehavior.textContent = behaviorCopy;
    rosterCardBehavior.title = behaviorCopy;

    const upkeepValue = Math.max(0, Math.round(card.upkeep));
    const upkeepLabel = `Upkeep: ${rosterUpkeepFormatter.format(upkeepValue)} Beer`;
    rosterCardUpkeep.textContent = upkeepLabel;
    rosterCardUpkeep.title = upkeepLabel;

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
    destroy() {
      rosterRenderer = null;
      rosterSignature = null;
      toggle.removeEventListener('click', handleToggleClick);
      container.removeEventListener('sauna-roster:expand', handleExpandRequest);
      container.removeEventListener('sauna-roster:collapse', handleCollapseRequest);
      container.removeEventListener('sauna-roster:toggle', handleToggleRequest);
      container.replaceChildren();
    }
  } satisfies RosterHudController;
}
