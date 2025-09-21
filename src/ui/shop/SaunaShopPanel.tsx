import artocoinIconUrl from '../../../assets/ui/artocoin.svg';
import type { PurchaseSaunaTierResult } from '../../progression/saunaShop.ts';
import type { SaunaTier, SaunaTierId, SaunaTierStatus } from '../../sauna/tiers.ts';

export interface SaunaShopTierView {
  readonly tier: SaunaTier;
  readonly status: SaunaTierStatus;
}

export interface SaunaShopViewModel {
  readonly balance: number;
  readonly tiers: readonly SaunaShopTierView[];
}

export type SaunaShopToastVariant = 'success' | 'info' | 'warn';

export interface SaunaShopPanelCallbacks {
  readonly onClose?: () => void;
  readonly onPurchaseTier?: (tierId: SaunaTierId) => PurchaseSaunaTierResult | void;
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
  subtitle.textContent = 'Commission tier upgrades with artocoins earned in the field.';
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
  balanceIconWrap.className = 'relative h-12 w-12 flex-shrink-0';
  balanceIconWrap.setAttribute('aria-hidden', 'true');

  const balanceIcon = document.createElement('img');
  balanceIcon.src = artocoinIconUrl;
  balanceIcon.alt = '';
  balanceIcon.className = 'h-full w-full drop-shadow-[0_12px_18px_rgba(255,186,92,0.35)]';
  balanceIcon.decoding = 'async';
  balanceIconWrap.appendChild(balanceIcon);

  balanceCard.append(balanceLabel, balanceIconWrap);
  element.appendChild(balanceCard);

  const tierList = document.createElement('div');
  tierList.className = 'flex flex-col gap-4';
  element.appendChild(tierList);

  const tierEntries = new Map<SaunaTierId, TierEntry>();

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
    badge.className = 'h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-white/40 bg-slate-900/40 shadow-[0_8px_16px_rgba(0,0,0,0.35)]';
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
