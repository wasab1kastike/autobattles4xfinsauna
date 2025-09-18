import type { RosterEntry } from './rightPanel.tsx';

const rosterCountFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const rosterUpkeepFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

type RosterHudOptions = {
  rosterIcon: string;
  summaryLabel?: string;
};

export type RosterCardViewModel = {
  id: string;
  name: string;
  traits: readonly string[];
  upkeep: number;
};

export type RosterHudSummary = {
  count: number;
  card: RosterCardViewModel | null;
};

export type RosterHudController = {
  updateSummary(summary: RosterHudSummary): void;
  installRenderer(renderer: (entries: RosterEntry[]) => void): void;
  renderRoster(entries: RosterEntry[]): void;
  destroy(): void;
};

export function setupRosterHUD(
  container: HTMLElement,
  options: RosterHudOptions
): RosterHudController {
  const { rosterIcon, summaryLabel = 'Saunoja Roster' } = options;

  container.classList.add('sauna-roster');
  container.setAttribute('role', 'status');
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('title', 'Active sauna battalion on the field');
  container.replaceChildren();

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

  const rosterCard = document.createElement('div');
  rosterCard.classList.add('saunoja-card');
  rosterCard.setAttribute('aria-live', 'polite');
  rosterCard.hidden = true;

  const rosterCardName = document.createElement('h3');
  rosterCardName.classList.add('saunoja-card__name');
  rosterCardName.textContent = 'Saunoja';

  const rosterCardTraits = document.createElement('p');
  rosterCardTraits.classList.add('saunoja-card__traits');

  const rosterCardUpkeep = document.createElement('p');
  rosterCardUpkeep.classList.add('saunoja-card__upkeep');

  rosterCard.append(rosterCardName, rosterCardTraits, rosterCardUpkeep);
  container.append(summary, rosterCard);

  let rosterRenderer: ((entries: RosterEntry[]) => void) | null = null;
  let rosterSignature: string | null = null;

  function renderCard(card: RosterCardViewModel | null): void {
    if (!card) {
      rosterCard.hidden = true;
      return;
    }

    rosterCard.hidden = false;
    rosterCard.dataset.unitId = card.id;

    rosterCardName.textContent = card.name || 'Saunoja';

    const traitList = card.traits.filter((trait) => trait.length > 0);
    const traitLabel = traitList.length > 0 ? traitList.join(', ') : 'No notable traits yet';
    rosterCardTraits.textContent = traitLabel;
    rosterCardTraits.title = traitLabel;

    const upkeepValue = Math.max(0, Math.round(card.upkeep));
    const upkeepLabel = `Upkeep: ${rosterUpkeepFormatter.format(upkeepValue)} Beer`;
    rosterCardUpkeep.textContent = upkeepLabel;
    rosterCardUpkeep.title = upkeepLabel;
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
      entry.selected ? 1 : 0,
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
      container.setAttribute('aria-label', `Saunoja roster: ${formatted} active attendants`);
      container.setAttribute('title', `Saunoja roster • ${formatted} active attendants`);
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
    destroy() {
      rosterRenderer = null;
      rosterSignature = null;
      container.replaceChildren();
    }
  } satisfies RosterHudController;
}
