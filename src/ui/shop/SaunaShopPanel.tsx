import { ARTOCOIN_CREST_PNG_DATA_URL as artocoinIconUrl } from '../../media/artocoinCrest.ts';
import type { PurchaseSaunaTierResult } from '../../progression/saunaShop.ts';
import type {
  LootUpgradeId,
  PurchaseLootUpgradeResult
} from '../../progression/lootUpgrades.ts';
import type { SaunaTier, SaunaTierId, SaunaTierStatus } from '../../sauna/tiers.ts';

export interface SaunaShopTierView {
  readonly tier: SaunaTier;
  readonly status: SaunaTierStatus;
}

export interface SaunaShopUpgradeStatus {
  readonly owned: boolean;
  readonly affordable: boolean;
  readonly prerequisitesMet: boolean;
  readonly cost: number;
  readonly requirementLabel: string;
  readonly lockedReason?: string;
}

export interface SaunaShopLootUpgradeView {
  readonly id: LootUpgradeId;
  readonly title: string;
  readonly tagline: string;
  readonly description: string;
  readonly effectSummary: string;
  readonly successBlurb: string;
  readonly badgeLabel: string;
  readonly badgeGradient: string;
  readonly accent: 'rarity' | 'drop-rate';
  readonly status: SaunaShopUpgradeStatus;
}

export interface SaunaShopLootUpgradeCategoryView {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly upgrades: readonly SaunaShopLootUpgradeView[];
}

export interface SaunaShopViewModel {
  readonly balance: number;
  readonly tiers: readonly SaunaShopTierView[];
  readonly lootCategories: readonly SaunaShopLootUpgradeCategoryView[];
}

export type SaunaShopToastVariant = 'success' | 'info' | 'warn';

export interface SaunaShopPanelCallbacks {
  readonly onClose?: () => void;
  readonly onPurchaseTier?: (tierId: SaunaTierId) => PurchaseSaunaTierResult | void;
  readonly onPurchaseLootUpgrade?: (
    upgradeId: LootUpgradeId
  ) => PurchaseLootUpgradeResult | void;
  readonly emitToast?: (message: string, variant: SaunaShopToastVariant) => void;
}

export interface SaunaShopPanelOptions {
  readonly getViewModel: () => SaunaShopViewModel;
  readonly callbacks?: SaunaShopPanelCallbacks;
}

export interface SaunaShopPanelController {
  readonly element: HTMLElement;
  setOpen(open: boolean): void;
  update(viewModel?: SaunaShopViewModel): void;
  focus(): void;
  destroy(): void;
}

interface TierEntry {
  readonly root: HTMLDivElement;
  readonly statusChip: HTMLSpanElement;
  readonly description: HTMLParagraphElement;
  readonly rosterCap: HTMLSpanElement;
  readonly actionButton: HTMLButtonElement;
  readonly costLabel: HTMLSpanElement;
  status: SaunaTierStatus;
}

interface UpgradeEntry {
  readonly root: HTMLDivElement;
  readonly statusChip: HTMLSpanElement;
  readonly badge: HTMLDivElement;
  readonly title: HTMLHeadingElement;
  readonly tagline: HTMLSpanElement;
  readonly effect: HTMLParagraphElement;
  readonly description: HTMLParagraphElement;
  readonly lockNote: HTMLParagraphElement;
  readonly costLabel: HTMLSpanElement;
  readonly actionButton: HTMLButtonElement;
  status: SaunaShopUpgradeStatus;
}

interface UpgradeCategoryEntry {
  readonly root: HTMLDivElement;
  readonly title: HTMLHeadingElement;
  readonly description: HTMLParagraphElement;
  readonly list: HTMLDivElement;
  readonly entries: Map<LootUpgradeId, UpgradeEntry>;
}

const numberFormatter = new Intl.NumberFormat('en-US');

function formatBalance(balance: number): string {
  return numberFormatter.format(Math.max(0, Math.floor(Number.isFinite(balance) ? balance : 0)));
}

function formatCost(cost: number): string {
  return numberFormatter.format(Math.max(0, Math.floor(Number.isFinite(cost) ? cost : 0)));
}

export function createSaunaShopPanel(options: SaunaShopPanelOptions): SaunaShopPanelController {
  const callbacks = options.callbacks ?? {};
  const element = document.createElement('section');
  element.className =
    'sauna-shop-panel pointer-events-auto flex w-[min(26rem,92vw)] flex-col gap-5 rounded-hud-xl border border-white/10 bg-[linear-gradient(145deg,rgba(20,27,41,0.95),rgba(33,44,66,0.9))] p-5 text-slate-100 shadow-[0_32px_68px_rgba(10,16,32,0.55)] backdrop-blur-[16px] backdrop-saturate-[140%] transition-transform duration-200 ease-out';
  element.tabIndex = -1;
  element.dataset.open = 'false';
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'true');
  element.setAttribute('aria-label', 'Steamforge atelier');
  element.setAttribute('aria-hidden', 'true');
  element.setAttribute('inert', '');

  const header = document.createElement('header');
  header.className = 'flex items-start justify-between gap-3';

  const headingGroup = document.createElement('div');
  headingGroup.className = 'flex flex-col gap-1';

  const title = document.createElement('h2');
  title.className = 'text-lg font-semibold tracking-wide text-sky-50';
  title.textContent = 'Steamforge Atelier';
  headingGroup.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.className = 'text-sm text-slate-300/85';
  subtitle.textContent =
    'Commission tier upgrades with artocoins earned in the field and unlock rarer loot caches as the atelier expands.';
  headingGroup.appendChild(subtitle);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className =
    'group inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition-colors duration-150 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
  closeButton.textContent = 'Close';
  closeButton.addEventListener('click', () => callbacks.onClose?.());

  header.append(headingGroup, closeButton);
  element.appendChild(header);

  const balanceCard = document.createElement('div');
  balanceCard.className =
    'flex items-center justify-between rounded-hud-lg border border-white/12 bg-[linear-gradient(135deg,rgba(255,245,224,0.18),rgba(255,192,120,0.12))] px-4 py-3 text-sm text-slate-100 shadow-[inset_0_0_18px_rgba(255,180,90,0.08)]';

  const balanceLabel = document.createElement('div');
  balanceLabel.className = 'flex flex-col gap-0.5';

  const balanceTitle = document.createElement('span');
  balanceTitle.className = 'text-xs font-semibold uppercase tracking-[0.14em] text-slate-200/80';
  balanceTitle.textContent = 'Artocoin balance';
  balanceLabel.appendChild(balanceTitle);

  const balanceValue = document.createElement('span');
  balanceValue.className = 'text-xl font-bold text-amber-200 drop-shadow-[0_0_12px_rgba(255,190,100,0.25)]';
  balanceValue.textContent = '0';
  balanceLabel.appendChild(balanceValue);

  const balanceIconWrap = document.createElement('div');
  balanceIconWrap.className = 'sauna-shop-panel__crest relative';
  balanceIconWrap.setAttribute('aria-hidden', 'true');

  const balanceIcon = document.createElement('img');
  balanceIcon.src = artocoinIconUrl;
  balanceIcon.alt = '';
  balanceIcon.className = 'drop-shadow-[0_12px_18px_rgba(255,186,92,0.35)]';
  balanceIcon.decoding = 'async';
  balanceIconWrap.appendChild(balanceIcon);

  balanceCard.append(balanceLabel, balanceIconWrap);
  element.appendChild(balanceCard);

  const tierList = document.createElement('div');
  tierList.className = 'flex flex-col gap-4';
  element.appendChild(tierList);

  const upgradeSection = document.createElement('section');
  upgradeSection.className = 'flex flex-col gap-4';
  upgradeSection.setAttribute('aria-label', 'Loot atelier enhancements');
  upgradeSection.hidden = true;

  const upgradeHeading = document.createElement('div');
  upgradeHeading.className = 'flex flex-col gap-1';

  const upgradeTitle = document.createElement('h3');
  upgradeTitle.className = 'text-sm font-semibold uppercase tracking-[0.22em] text-slate-200/80';
  upgradeTitle.textContent = 'Loot atelier upgrades';
  upgradeHeading.appendChild(upgradeTitle);

  const upgradeSubtitle = document.createElement('p');
  upgradeSubtitle.className = 'text-xs text-slate-300/85';
  upgradeSubtitle.textContent =
    'Authorize new rarity permits and coax richer battlefield drops with atelier refinements.';
  upgradeHeading.appendChild(upgradeSubtitle);

  const upgradeCatalog = document.createElement('div');
  upgradeCatalog.className = 'flex flex-col gap-4';

  upgradeSection.append(upgradeHeading, upgradeCatalog);
  element.appendChild(upgradeSection);

  const tierEntries = new Map<SaunaTierId, TierEntry>();
  const upgradeCategories = new Map<string, UpgradeCategoryEntry>();

  function findUpgradeViewById(
    id: LootUpgradeId
  ): SaunaShopLootUpgradeView | null {
    try {
      const viewModel = options.getViewModel();
      for (const category of viewModel.lootCategories ?? []) {
        const match = category.upgrades.find((upgrade) => upgrade.id === id);
        if (match) {
          return match;
        }
      }
    } catch (error) {
      console.warn('Failed to resolve loot upgrade view model', error);
    }
    return null;
  }

  function buildTierCard(view: SaunaShopTierView): TierEntry {
    const { tier } = view;
    const card = document.createElement('article');
    card.className =
      'relative overflow-hidden rounded-hud-lg border border-white/10 bg-[linear-gradient(135deg,rgba(24,30,46,0.86),rgba(42,56,78,0.9))] p-4 shadow-[0_16px_36px_rgba(10,16,32,0.4)] transition-transform duration-200 ease-out hover:-translate-y-1';
    card.dataset.tierId = tier.id;

    const glow = document.createElement('div');
    glow.className = 'pointer-events-none absolute inset-0 opacity-40';
    glow.style.background = tier.art.glow ?? 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 70%)';
    card.appendChild(glow);

    const content = document.createElement('div');
    content.className = 'relative flex flex-col gap-3';
    card.appendChild(content);

    const headerRow = document.createElement('div');
    headerRow.className = 'flex items-start justify-between gap-3';
    content.appendChild(headerRow);

    const titleBlock = document.createElement('div');
    titleBlock.className = 'flex items-center gap-3';
    headerRow.appendChild(titleBlock);

    const badge = document.createElement('div');
    badge.className = 'sauna-shop-panel__tier-badge overflow-hidden rounded-full border border-white/40 bg-slate-900/40 shadow-[0_8px_16px_rgba(0,0,0,0.35)]';
    badge.style.backgroundImage = `url(${tier.art.badge})`;
    badge.style.backgroundSize = 'cover';
    badge.style.backgroundPosition = 'center';
    badge.setAttribute('aria-hidden', 'true');
    titleBlock.appendChild(badge);

    const textCol = document.createElement('div');
    textCol.className = 'flex flex-col gap-1';
    titleBlock.appendChild(textCol);

    const tierName = document.createElement('h3');
    tierName.className = 'text-base font-semibold text-slate-50';
    tierName.textContent = tier.name;
    textCol.appendChild(tierName);

    const rosterCap = document.createElement('span');
    rosterCap.className = 'text-xs font-medium uppercase tracking-[0.16em] text-slate-300/85';
    rosterCap.textContent = `Cap ${tier.rosterCap}`;
    textCol.appendChild(rosterCap);

    const statusChip = document.createElement('span');
    statusChip.className =
      'rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-200 shadow-[0_4px_10px_rgba(12,17,32,0.45)]';
    statusChip.textContent = 'Locked';
    headerRow.appendChild(statusChip);

    const description = document.createElement('p');
    description.className = 'text-sm leading-relaxed text-slate-200/85';
    description.textContent = tier.description;
    content.appendChild(description);

    const actionRow = document.createElement('div');
    actionRow.className = 'flex items-center justify-between gap-3';
    content.appendChild(actionRow);

    const costLabel = document.createElement('span');
    costLabel.className = 'text-sm font-semibold text-amber-200/90';
    costLabel.textContent = '—';
    actionRow.appendChild(costLabel);

    const actionButton = document.createElement('button');
    actionButton.type = 'button';
    actionButton.className =
      'group relative inline-flex items-center justify-center gap-2 rounded-full border border-amber-200/50 bg-[linear-gradient(135deg,rgba(255,200,120,0.9),rgba(255,157,66,0.92))] px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-slate-900 shadow-[0_12px_20px_rgba(255,168,74,0.35)] transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(255,168,74,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200';
    actionButton.textContent = 'Unlock';
    actionRow.appendChild(actionButton);

    actionButton.addEventListener('click', () => {
      if (!callbacks.onPurchaseTier) {
        return;
      }
      const result = callbacks.onPurchaseTier(tier.id);
      if (!result) {
        return;
      }
      if (result.success) {
        const spent =
          typeof view.status.cost === 'number'
            ? view.status.cost
            : tier.unlock.type === 'artocoin'
              ? tier.unlock.cost
              : 0;
        callbacks.emitToast?.(
          `${tier.name} unlocked for ${formatCost(spent)} artocoins.`,
          'success'
        );
      } else if (result.reason === 'insufficient-funds') {
        callbacks.emitToast?.(
          `Need ${formatCost(result.shortfall ?? 0)} more artocoins to commission ${tier.name}.`,
          'warn'
        );
      } else if (result.reason === 'already-owned') {
        callbacks.emitToast?.(`${tier.name} is already unlocked.`, 'info');
      }
      updatePanel();
    });

    tierList.appendChild(card);

    return {
      root: card,
      statusChip,
      description,
      rosterCap,
      actionButton,
      costLabel,
      status: view.status
    } satisfies TierEntry;
  }

  function updateTierCard(entry: TierEntry, view: SaunaShopTierView): void {
    const { tier, status } = view;
    entry.rosterCap.textContent = `Cap ${tier.rosterCap}`;
    entry.description.textContent = tier.description;
    entry.status = status;
    entry.root.setAttribute('aria-label', `${tier.name} — ${status.requirementLabel}`);
    entry.actionButton.title = status.requirementLabel;
    entry.actionButton.setAttribute(
      'aria-label',
      status.owned ? `${tier.name} unlocked` : status.requirementLabel
    );

    entry.root.dataset.state = status.owned
      ? 'owned'
      : status.affordable
        ? 'ready'
        : 'locked';

    if (status.owned) {
      entry.statusChip.textContent = 'Unlocked';
      entry.statusChip.classList.add('bg-emerald-300/15', 'text-emerald-200');
      entry.statusChip.classList.remove('text-slate-200');
      entry.actionButton.disabled = true;
      entry.actionButton.textContent = 'Unlocked';
      entry.actionButton.classList.add('cursor-not-allowed', 'opacity-60');
      entry.costLabel.textContent = 'Owned';
      entry.costLabel.dataset.state = 'owned';
    } else {
      entry.statusChip.textContent = status.affordable ? 'Ready' : 'Locked';
      entry.statusChip.classList.remove('bg-emerald-300/15', 'text-emerald-200');
      entry.statusChip.classList.add('text-slate-200');
      entry.actionButton.disabled = !status.affordable;
      entry.actionButton.textContent = status.affordable ? 'Unlock now' : 'Insufficient';
      entry.actionButton.classList.toggle('opacity-60', !status.affordable);
      entry.actionButton.classList.toggle('cursor-not-allowed', !status.affordable);
      entry.costLabel.textContent = status.cost ? `${formatCost(status.cost)} artocoins` : 'Included';
      entry.costLabel.dataset.state = status.affordable ? 'ready' : 'locked';
    }
  }

  function ensureUpgradeCategory(
    view: SaunaShopLootUpgradeCategoryView
  ): UpgradeCategoryEntry {
    const existing = upgradeCategories.get(view.id);
    if (existing) {
      existing.title.textContent = view.title;
      existing.description.textContent = view.description;
      upgradeCatalog.appendChild(existing.root);
      return existing;
    }
    const container = document.createElement('div');
    container.className = 'flex flex-col gap-3';
    container.dataset.categoryId = view.id;

    const header = document.createElement('div');
    header.className = 'flex flex-col gap-1';

    const title = document.createElement('h4');
    title.className = 'text-sm font-semibold uppercase tracking-[0.2em] text-slate-200/85';
    title.textContent = view.title;
    header.appendChild(title);

    const description = document.createElement('p');
    description.className = 'text-xs text-slate-300/85';
    description.textContent = view.description;
    header.appendChild(description);

    const list = document.createElement('div');
    list.className = 'flex flex-col gap-3';

    container.append(header, list);
    upgradeCatalog.appendChild(container);

    const entry: UpgradeCategoryEntry = {
      root: container,
      title,
      description,
      list,
      entries: new Map<LootUpgradeId, UpgradeEntry>()
    };
    upgradeCategories.set(view.id, entry);
    return entry;
  }

  function buildUpgradeCard(view: SaunaShopLootUpgradeView): UpgradeEntry {
    const card = document.createElement('article');
    card.className =
      'relative overflow-hidden rounded-hud-lg border border-white/12 bg-[linear-gradient(140deg,rgba(20,26,42,0.9),rgba(12,16,30,0.94))] p-4 shadow-[0_18px_36px_rgba(6,10,22,0.55)] transition-transform duration-200 ease-out hover:-translate-y-1';
    card.dataset.upgradeId = view.id;
    card.dataset.accent = view.accent;

    const glow = document.createElement('div');
    glow.className = 'pointer-events-none absolute inset-0 opacity-35 mix-blend-screen';
    glow.style.background = view.badgeGradient;
    card.appendChild(glow);

    const content = document.createElement('div');
    content.className = 'relative flex flex-col gap-3';
    card.appendChild(content);

    const headerRow = document.createElement('div');
    headerRow.className = 'flex items-start justify-between gap-3';
    content.appendChild(headerRow);

    const titleBlock = document.createElement('div');
    titleBlock.className = 'flex items-center gap-3';
    headerRow.appendChild(titleBlock);

    const badge = document.createElement('div');
    badge.className =
      'relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/35 shadow-[0_12px_24px_rgba(10,16,32,0.5)] backdrop-blur-[6px]';
    badge.style.background = view.badgeGradient;

    const badgeLabel = document.createElement('span');
    badgeLabel.className = 'text-xs font-semibold uppercase tracking-[0.22em] text-slate-950/90 drop-shadow-[0_1px_6px_rgba(255,255,255,0.45)]';
    badgeLabel.textContent = view.badgeLabel;
    badge.appendChild(badgeLabel);
    titleBlock.appendChild(badge);

    const textCol = document.createElement('div');
    textCol.className = 'flex flex-col gap-1';
    titleBlock.appendChild(textCol);

    const upgradeTitleEl = document.createElement('h3');
    upgradeTitleEl.className = 'text-base font-semibold text-slate-50';
    upgradeTitleEl.textContent = view.title;
    textCol.appendChild(upgradeTitleEl);

    const tagline = document.createElement('span');
    tagline.className = 'text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-300/85';
    tagline.textContent = view.tagline;
    textCol.appendChild(tagline);

    const statusChip = document.createElement('span');
    statusChip.className =
      'rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-200 shadow-[0_4px_10px_rgba(12,17,32,0.45)]';
    statusChip.textContent = 'Locked';
    headerRow.appendChild(statusChip);

    const effect = document.createElement('p');
    effect.className = 'text-sm font-semibold text-amber-100 drop-shadow-[0_0_16px_rgba(255,210,140,0.28)]';
    effect.textContent = view.effectSummary;
    content.appendChild(effect);

    const description = document.createElement('p');
    description.className = 'text-sm leading-relaxed text-slate-200/85';
    description.textContent = view.description;
    content.appendChild(description);

    const lockNote = document.createElement('p');
    lockNote.className = 'text-xs font-semibold uppercase tracking-[0.2em] text-rose-200/85';
    lockNote.hidden = true;
    content.appendChild(lockNote);

    const actionRow = document.createElement('div');
    actionRow.className = 'flex items-center justify-between gap-3';
    content.appendChild(actionRow);

    const costLabel = document.createElement('span');
    costLabel.className = 'text-sm font-semibold text-amber-200/90';
    costLabel.textContent = '—';
    actionRow.appendChild(costLabel);

    const actionButton = document.createElement('button');
    actionButton.type = 'button';
    actionButton.className =
      'group relative inline-flex items-center justify-center gap-2 rounded-full border border-amber-200/55 bg-[linear-gradient(135deg,rgba(255,198,120,0.92),rgba(255,163,70,0.94))] px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-slate-900 shadow-[0_12px_20px_rgba(255,176,84,0.38)] transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(255,176,84,0.42)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200';
    actionButton.textContent = 'Activate';
    actionRow.appendChild(actionButton);

    actionButton.addEventListener('click', () => {
      if (!callbacks.onPurchaseLootUpgrade) {
        return;
      }
      const result = callbacks.onPurchaseLootUpgrade(view.id);
      if (!result) {
        return;
      }
      const latest = findUpgradeViewById(view.id) ?? view;
      if (result.success) {
        const cost = Math.max(0, Math.floor(result.cost ?? latest.status.cost ?? 0));
        const costMessage = cost > 0 ? ` for ${formatCost(cost)} artocoins` : '';
        callbacks.emitToast?.(
          `${latest.title} activated${costMessage} — ${latest.successBlurb}`,
          'success'
        );
      } else if (result.reason === 'insufficient-funds') {
        const shortfall = Math.max(0, Math.floor(result.shortfall ?? 0));
        callbacks.emitToast?.(
          `Need ${formatCost(shortfall)} more artocoins to commission ${latest.title}.`,
          'warn'
        );
      } else if (result.reason === 'already-owned') {
        callbacks.emitToast?.(`${latest.title} is already active.`, 'info');
      } else if (result.reason === 'prerequisite-missing') {
        const requirement = latest.status.lockedReason ?? 'a prior upgrade';
        callbacks.emitToast?.(
          `${latest.title} requires ${requirement.toLowerCase()}.`,
          'info'
        );
      } else {
        callbacks.emitToast?.(
          `${latest.title} cannot be commissioned right now.`,
          'warn'
        );
      }
      updatePanel();
    });

    return {
      root: card,
      statusChip,
      badge,
      title: upgradeTitleEl,
      tagline,
      effect,
      description,
      lockNote,
      costLabel,
      actionButton,
      status: view.status
    } satisfies UpgradeEntry;
  }

  function updateUpgradeCard(
    entry: UpgradeEntry,
    view: SaunaShopLootUpgradeView
  ): void {
    const { status } = view;
    entry.status = status;
    entry.title.textContent = view.title;
    entry.tagline.textContent = view.tagline;
    entry.effect.textContent = view.effectSummary;
    entry.description.textContent = view.description;
    entry.badge.style.background = view.badgeGradient;
    entry.root.dataset.accent = view.accent;
    entry.root.setAttribute('aria-label', `${view.title} — ${status.requirementLabel}`);
    entry.actionButton.title = status.requirementLabel;
    entry.actionButton.setAttribute(
      'aria-label',
      status.owned ? `${view.title} activated` : status.requirementLabel
    );

    entry.lockNote.hidden = true;
    entry.lockNote.textContent = '';

    if (status.owned) {
      entry.statusChip.textContent = 'Activated';
      entry.statusChip.classList.add('bg-emerald-300/15', 'text-emerald-200');
      entry.statusChip.classList.remove('text-slate-200');
      entry.actionButton.disabled = true;
      entry.actionButton.textContent = 'Activated';
      entry.actionButton.classList.add('cursor-not-allowed', 'opacity-60');
      entry.costLabel.textContent = 'Owned';
      entry.costLabel.dataset.state = 'owned';
      entry.root.dataset.state = 'owned';
    } else {
      const ready = status.prerequisitesMet && status.affordable;
      const requires = !status.prerequisitesMet;
      entry.root.dataset.state = ready
        ? 'ready'
        : requires
          ? 'requires'
          : 'locked';
      entry.statusChip.textContent = ready
        ? 'Ready'
        : requires
          ? 'Requires'
          : 'Locked';
      entry.statusChip.classList.remove('bg-emerald-300/15', 'text-emerald-200');
      entry.statusChip.classList.add('text-slate-200');
      entry.actionButton.disabled = !ready;
      entry.actionButton.textContent = ready
        ? 'Activate'
        : requires
          ? 'Requires upgrade'
          : 'Insufficient';
      entry.actionButton.classList.toggle('opacity-60', !ready);
      entry.actionButton.classList.toggle('cursor-not-allowed', !ready);
      if (!status.prerequisitesMet && status.lockedReason) {
        entry.lockNote.hidden = false;
        entry.lockNote.textContent = status.lockedReason;
      }
      const costLabel = status.cost > 0 ? `${formatCost(status.cost)} artocoins` : 'Included';
      entry.costLabel.textContent = costLabel;
      entry.costLabel.dataset.state = ready ? 'ready' : requires ? 'requires' : 'locked';
    }
  }

  function updatePanel(next?: SaunaShopViewModel): void {
    const viewModel = next ?? options.getViewModel();
    balanceValue.textContent = formatBalance(viewModel.balance);

    viewModel.tiers.forEach((view) => {
      const existing = tierEntries.get(view.tier.id);
      if (existing) {
        updateTierCard(existing, view);
        return;
      }
      const entry = buildTierCard(view);
      tierEntries.set(view.tier.id, entry);
      updateTierCard(entry, view);
    });

    const visibleCategories = new Set<string>();
    for (const category of viewModel.lootCategories ?? []) {
      const entry = ensureUpgradeCategory(category);
      visibleCategories.add(category.id);
      const seenUpgrades = new Set<LootUpgradeId>();
      for (const upgrade of category.upgrades) {
        let upgradeEntry = entry.entries.get(upgrade.id);
        if (!upgradeEntry) {
          upgradeEntry = buildUpgradeCard(upgrade);
          entry.entries.set(upgrade.id, upgradeEntry);
          entry.list.appendChild(upgradeEntry.root);
        }
        updateUpgradeCard(upgradeEntry, upgrade);
        seenUpgrades.add(upgrade.id);
      }
      for (const [upgradeId, upgradeEntry] of Array.from(entry.entries)) {
        if (!seenUpgrades.has(upgradeId)) {
          upgradeEntry.root.remove();
          entry.entries.delete(upgradeId);
        }
      }
    }

    for (const [categoryId, categoryEntry] of Array.from(upgradeCategories)) {
      if (!visibleCategories.has(categoryId)) {
        categoryEntry.root.remove();
        upgradeCategories.delete(categoryId);
      }
    }

    upgradeSection.hidden = (viewModel.lootCategories?.length ?? 0) === 0;
  }

  function setOpen(open: boolean): void {
    element.dataset.open = open ? 'true' : 'false';
    element.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      element.removeAttribute('inert');
    } else {
      element.setAttribute('inert', '');
    }
  }

  function focusPanel(): void {
    requestAnimationFrame(() => {
      element.focus({ preventScroll: true });
    });
  }

  function destroy(): void {
    element.remove();
    tierEntries.clear();
    for (const entry of upgradeCategories.values()) {
      entry.root.remove();
      entry.entries.clear();
    }
    upgradeCategories.clear();
  }

  updatePanel();

  return {
    element,
    setOpen,
    update: updatePanel,
    focus: focusPanel,
    destroy
  } satisfies SaunaShopPanelController;
}
