import { GameState, Resource } from '../core/GameState.ts';
import {
  eventBus,
  eventScheduler,
  SCHEDULER_EVENTS,
  type ActiveSchedulerEvent,
  type SchedulerEventContent,
  type SchedulerTriggeredPayload
} from '../events';
import { ensureHudLayout } from './layout.ts';
import { subscribeToIsMobile } from './hooks/useIsMobile.ts';
import { createRosterPanel } from './panels/RosterPanel.tsx';
import type { RosterEntry } from './panels/RosterPanel.tsx';
import type { EquipmentSlotId } from '../items/types.ts';
import {
  listPolicies,
  POLICY_EVENTS,
  type PolicyDefinition,
  type PolicyAppliedEvent,
  type PolicyRejectedEvent
} from '../data/policies.ts';
import {
  getLogHistory,
  LOG_EVENT_META,
  LOG_EVENT_ORDER,
  logEvent,
  readLogPreferences,
  subscribeToLogs,
  type LogChange,
  type LogEntry,
  type LogEventPayload,
  type LogEventType,
  writeLogPreferences
} from './logging.ts';

export type {
  RosterEntry,
  RosterItem,
  RosterModifier,
  RosterStats,
  RosterProgression
} from './panels/RosterPanel.tsx';

export type GameEvent = SchedulerEventContent;

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

type RightPanelOptions = {
  onRosterSelect?: (unitId: string) => void;
  onRosterRendererReady?: (renderer: (entries: RosterEntry[]) => void) => void;
  onRosterEquipSlot?: (unitId: string, slot: EquipmentSlotId) => void;
  onRosterUnequipSlot?: (unitId: string, slot: EquipmentSlotId) => void;
};

export function setupRightPanel(
  state: GameState,
  options: RightPanelOptions = {}
): {
  log: (event: LogEventPayload) => void;
  addEvent: (ev: GameEvent) => void;
  renderRoster: (entries: RosterEntry[]) => void;
  dispose: () => void;
} {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) {
    return { log: () => {}, addEvent: () => {}, renderRoster: () => {}, dispose: () => {} };
  }

  const { regions, mobileBar } = ensureHudLayout(overlay);
  const topRegion = regions.top;
  const rightRegion = regions.right;

  const existingPanel = overlay.querySelector<HTMLDivElement>('#right-panel');
  if (existingPanel) {
    existingPanel.remove();
  }
  const existingSlide = overlay.querySelector<HTMLDivElement>('.right-panel-slide');
  if (existingSlide) {
    existingSlide.remove();
  }

  const existingToggle = overlay.querySelector<HTMLButtonElement>('#right-panel-toggle');
  if (existingToggle) {
    existingToggle.remove();
  }

  const panel = document.createElement('div');
  panel.id = 'right-panel';
  panel.classList.add('hud-card');
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'Sauna command console');
  panel.tabIndex = -1;

  const slideOver = document.createElement('div');
  slideOver.className = 'right-panel-slide';
  slideOver.setAttribute('aria-hidden', 'true');

  const slideBackdrop = document.createElement('div');
  slideBackdrop.className = 'right-panel-slide__backdrop';
  slideBackdrop.setAttribute('aria-hidden', 'true');

  const slideSheet = document.createElement('div');
  slideSheet.className = 'right-panel-slide__sheet';
  slideSheet.appendChild(panel);
  slideOver.append(slideBackdrop, slideSheet);

  const smallViewportQuery = window.matchMedia('(max-width: 1040px)');
  const disposers: Array<() => void> = [];

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.id = 'right-panel-toggle';
  toggle.classList.add('hud-panel-toggle');
  toggle.setAttribute('aria-controls', panel.id);

  const toggleIcon = document.createElement('span');
  toggleIcon.classList.add('hud-panel-toggle__icon');
  toggleIcon.setAttribute('aria-hidden', 'true');
  const toggleBars = document.createElement('span');
  toggleBars.classList.add('hud-panel-toggle__icon-bars');
  toggleIcon.appendChild(toggleBars);

  const toggleText = document.createElement('span');
  toggleText.classList.add('hud-panel-toggle__text');
  const toggleTitle = document.createElement('span');
  toggleTitle.classList.add('hud-panel-toggle__title');
  toggleTitle.textContent = 'Command Console';
  const toggleState = document.createElement('span');
  toggleState.classList.add('hud-panel-toggle__state');
  toggleText.append(toggleTitle, toggleState);

  toggle.append(toggleIcon, toggleText);

  const insertToggle = (): void => {
    const topbar = topRegion.querySelector<HTMLElement>('#topbar');
    if (topbar && topbar.parentElement === topRegion) {
      topbar.insertAdjacentElement('afterend', toggle);
    } else {
      topRegion.prepend(toggle);
    }
  };

  let isCollapsed = false;
  let narrowLayoutCollapsed = false;
  let isMobileViewport = false;
  let isMobilePanelOpen = false;

  const scrollLockClass = 'is-mobile-panel-open';

  const updateToggleStateText = () => {
    if (isMobileViewport) {
      toggleState.textContent = isMobilePanelOpen ? 'Close' : 'Menu';
    } else {
      toggleState.textContent = isCollapsed ? 'Open' : 'Close';
    }
  };

  const updateToggleAccessibility = () => {
    if (isMobileViewport) {
      toggle.setAttribute('aria-expanded', isMobilePanelOpen ? 'true' : 'false');
      const label = isMobilePanelOpen ? 'Close command console panel' : 'Open command console panel';
      toggle.setAttribute('aria-label', label);
      toggle.title = isMobilePanelOpen
        ? 'Close the sauna command console overlay'
        : 'Open the sauna command console overlay';
    } else {
      toggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      const label = isCollapsed ? 'Open command console panel' : 'Close command console panel';
      toggle.setAttribute('aria-label', label);
      toggle.title = isCollapsed
        ? 'Open the sauna command console overlay'
        : 'Close the sauna command console overlay';
    }
  };

  const refreshTogglePresentation = () => {
    updateToggleStateText();
    updateToggleAccessibility();
  };

  const applyCollapsedState = (
    collapsed: boolean,
    matches = smallViewportQuery.matches
  ): void => {
    if (isMobileViewport) {
      return;
    }
    const wasCollapsed = isCollapsed;
    if (matches) {
      narrowLayoutCollapsed = collapsed;
    }
    const shouldCollapse = collapsed && matches;
    isCollapsed = shouldCollapse;
    panel.classList.toggle('right-panel--collapsed', shouldCollapse);
    panel.setAttribute('aria-hidden', shouldCollapse ? 'true' : 'false');
    refreshTogglePresentation();
    if (wasCollapsed && !shouldCollapse && matches) {
      panel.focus({ preventScroll: true });
    }
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (!isMobileViewport || !isMobilePanelOpen) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMobilePanel();
    }
  };

  let keydownBound = false;
  const bindMobileKeydown = () => {
    if (!keydownBound) {
      document.addEventListener('keydown', handleKeydown);
      keydownBound = true;
    }
  };
  const unbindMobileKeydown = () => {
    if (keydownBound) {
      document.removeEventListener('keydown', handleKeydown);
      keydownBound = false;
    }
  };

  const openMobilePanel = () => {
    if (!isMobileViewport || isMobilePanelOpen) {
      return;
    }
    isMobilePanelOpen = true;
    slideOver.classList.add('right-panel-slide--open');
    slideOver.setAttribute('aria-hidden', 'false');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add(scrollLockClass);
    slideOver.style.setProperty('--panel-drag-progress', '1');
    refreshTogglePresentation();
    bindMobileKeydown();
    requestAnimationFrame(() => {
      panel.focus({ preventScroll: true });
    });
  };

  const closeMobilePanel = ({ skipFocus = false }: { skipFocus?: boolean } = {}) => {
    if (!isMobileViewport || !isMobilePanelOpen) {
      return;
    }
    resetDrag();
    isMobilePanelOpen = false;
    slideOver.classList.remove('right-panel-slide--open');
    slideOver.setAttribute('aria-hidden', 'true');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove(scrollLockClass);
    slideOver.style.setProperty('--panel-drag-progress', '0');
    refreshTogglePresentation();
    unbindMobileKeydown();
    if (!skipFocus) {
      toggle.focus({ preventScroll: true });
    }
  };

  const handleViewportChange = (event: MediaQueryListEvent): void => {
    if (isMobileViewport) {
      return;
    }
    const matches = event.matches;
    toggle.hidden = !matches;
    const collapsed = matches ? narrowLayoutCollapsed : false;
    applyCollapsedState(collapsed, matches);
  };

  if (typeof smallViewportQuery.addEventListener === 'function') {
    smallViewportQuery.addEventListener('change', handleViewportChange);
    disposers.push(() => smallViewportQuery.removeEventListener('change', handleViewportChange));
  } else {
    smallViewportQuery.addListener(handleViewportChange);
    disposers.push(() => smallViewportQuery.removeListener(handleViewportChange));
  }

  const handleToggleClick = (): void => {
    if (isMobileViewport) {
      if (isMobilePanelOpen) {
        closeMobilePanel();
      } else {
        openMobilePanel();
      }
      return;
    }
    const next = !isCollapsed;
    applyCollapsedState(next);
  };
  toggle.addEventListener('click', handleToggleClick);
  disposers.push(() => toggle.removeEventListener('click', handleToggleClick));

  const handleBackdropClick = () => {
    closeMobilePanel();
  };
  slideBackdrop.addEventListener('click', handleBackdropClick);
  disposers.push(() => slideBackdrop.removeEventListener('click', handleBackdropClick));

  let dragPointerId: number | null = null;
  let dragStartX = 0;
  let dragDeltaX = 0;

  const resetDrag = () => {
    if (dragPointerId !== null) {
      slideSheet.releasePointerCapture(dragPointerId);
      dragPointerId = null;
    }
    slideSheet.style.transition = '';
    slideSheet.style.transform = '';
    slideOver.style.setProperty('--panel-drag-progress', isMobilePanelOpen ? '1' : '0');
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (!isMobileViewport || !isMobilePanelOpen) {
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    dragPointerId = event.pointerId;
    dragStartX = event.clientX;
    dragDeltaX = 0;
    slideSheet.style.transition = 'none';
    slideSheet.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!isMobileViewport || event.pointerId !== dragPointerId || !isMobilePanelOpen) {
      return;
    }
    dragDeltaX = Math.max(0, event.clientX - dragStartX);
    const maxOffset = slideSheet.offsetWidth || 1;
    const offset = Math.min(dragDeltaX, maxOffset);
    slideSheet.style.transform = `translateX(${offset}px)`;
    slideOver.style.setProperty('--panel-drag-progress', String(1 - offset / maxOffset));
  };

  const finishDrag = (shouldClose: boolean) => {
    resetDrag();
    if (shouldClose) {
      closeMobilePanel();
    }
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (event.pointerId !== dragPointerId) {
      return;
    }
    const maxOffset = slideSheet.offsetWidth || 1;
    const shouldClose = dragDeltaX > maxOffset * 0.35;
    finishDrag(shouldClose);
  };

  const handlePointerCancel = () => {
    finishDrag(false);
  };

  slideSheet.addEventListener('pointerdown', handlePointerDown);
  slideSheet.addEventListener('pointermove', handlePointerMove);
  slideSheet.addEventListener('pointerup', handlePointerUp);
  slideSheet.addEventListener('pointercancel', handlePointerCancel);
  disposers.push(() => {
    slideSheet.removeEventListener('pointerdown', handlePointerDown);
    slideSheet.removeEventListener('pointermove', handlePointerMove);
    slideSheet.removeEventListener('pointerup', handlePointerUp);
    slideSheet.removeEventListener('pointercancel', handlePointerCancel);
  });

  const detachMobilePlacement = subscribeToIsMobile((isMobile) => {
    isMobileViewport = isMobile;
    if (isMobileViewport) {
      slideSheet.appendChild(panel);
      if (!slideOver.isConnected) {
        overlay.appendChild(slideOver);
      }
      mobileBar.appendChild(toggle);
      toggle.classList.add('hud-panel-toggle--mobile');
      toggle.hidden = false;
      if (!isMobilePanelOpen) {
        panel.setAttribute('aria-hidden', 'true');
        slideOver.setAttribute('aria-hidden', 'true');
        slideOver.style.setProperty('--panel-drag-progress', '0');
      }
    } else {
      closeMobilePanel({ skipFocus: true });
      slideOver.style.setProperty('--panel-drag-progress', '1');
      slideOver.remove();
  rightRegion.appendChild(panel);
      insertToggle();
      toggle.classList.remove('hud-panel-toggle--mobile');
      toggle.hidden = !smallViewportQuery.matches;
      panel.setAttribute('aria-hidden', 'false');
      applyCollapsedState(narrowLayoutCollapsed, smallViewportQuery.matches);
    }
    refreshTogglePresentation();
  });
  disposers.push(detachMobilePlacement);

  const tabBar = document.createElement('div');
  tabBar.classList.add('panel-tabs');
  panel.appendChild(tabBar);

  const content = document.createElement('div');
  content.classList.add('panel-content');
  panel.appendChild(content);

  const rosterTab = document.createElement('div');
  rosterTab.id = 'right-panel-roster';
  rosterTab.setAttribute('role', 'region');
  rosterTab.setAttribute('aria-live', 'polite');
  rosterTab.setAttribute('aria-label', 'Battalion roster');
  const policiesTab = document.createElement('div');
  policiesTab.id = 'right-panel-policies';
  const eventsTab = document.createElement('div');
  eventsTab.id = 'right-panel-events';
  const logSection = document.createElement('div');
  logSection.id = 'right-panel-log';
  logSection.setAttribute('role', 'region');
  logSection.setAttribute('aria-label', 'Combat log');

  const logContainer = document.createElement('section');
  logContainer.className = 'panel-log';

  const logHeader = document.createElement('header');
  logHeader.className = 'panel-log__header';

  const logTitle = document.createElement('h3');
  logTitle.className = 'panel-log__title';
  logTitle.textContent = 'Combat Log';

  const logTotal = document.createElement('span');
  logTotal.className = 'panel-log__total';
  logTotal.textContent = '0 entries';
  logHeader.append(logTitle, logTotal);

  const logFilters = document.createElement('div');
  logFilters.className = 'panel-log__filters';

  const logFeed = document.createElement('div');
  logFeed.id = 'event-log';
  logFeed.className = 'panel-log__feed';
  logFeed.setAttribute('role', 'log');
  logFeed.setAttribute('aria-live', 'polite');

  logContainer.append(logHeader, logFilters, logFeed);
  logSection.appendChild(logContainer);

  const tabs: Record<string, HTMLDivElement> = {
    Roster: rosterTab,
    Policies: policiesTab,
    Events: eventsTab,
    Log: logSection
  };

  const { onRosterSelect, onRosterRendererReady, onRosterEquipSlot, onRosterUnequipSlot } = options;
  for (const [name, section] of Object.entries(tabs)) {
    section.classList.add('panel-section', 'panel-section--scroll');
    section.dataset.tab = name;
    section.hidden = true;
  }
  logSection.classList.add('panel-section--log');

  function show(tab: string): void {
    for (const [name, el] of Object.entries(tabs)) {
      el.hidden = name !== tab;
    }
    for (const btn of Array.from(tabBar.children)) {
      const b = btn as HTMLButtonElement;
      const isActive = b.textContent === tab;
      b.disabled = isActive;
      b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
  }

  for (const name of Object.keys(tabs)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = name;
    const section = tabs[name];
    if (section?.id) {
      btn.setAttribute('aria-controls', section.id);
    }
    btn.setAttribute('aria-pressed', 'false');
    const handleClick = (): void => show(name);
    btn.addEventListener('click', handleClick);
    disposers.push(() => btn.removeEventListener('click', handleClick));
    tabBar.appendChild(btn);
    content.appendChild(tabs[name]);
  }

  // --- Roster ---
  const rosterPanel = createRosterPanel(rosterTab, {
    onSelect: onRosterSelect,
    onEquipSlot: onRosterEquipSlot,
    onUnequipSlot: onRosterUnequipSlot
  });

  const renderRoster = (entries: RosterEntry[]): void => {
    rosterPanel.render(entries);
  };

  renderRoster([]);

  if (typeof onRosterRendererReady === 'function') {
    onRosterRendererReady(renderRoster);
  }

  // --- Policies ---
  const resourceLabel: Record<Resource, string> = {
    [Resource.SAUNA_BEER]: 'Sauna Beer Bottles',
    [Resource.SAUNAKUNNIA]: 'Saunakunnia',
    [Resource.SISU]: 'Sisu'
  };

  type PolicyUiElements = {
    card: HTMLElement;
    action: HTMLButtonElement;
    stateBadge: HTMLSpanElement;
    statusCopy: HTMLParagraphElement;
    requirements: HTMLUListElement;
    costChip: HTMLSpanElement;
  };

  const policies = listPolicies();
  const policyElements = new Map<PolicyDefinition['id'], PolicyUiElements>();

  function createBadge(text: string): HTMLSpanElement {
    const badge = document.createElement('span');
    badge.className = 'policy-card__badge';
    badge.textContent = text;
    return badge;
  }

  function createPolicyCard(def: PolicyDefinition): HTMLElement {
    const card = document.createElement('article');
    card.className = 'policy-card';
    card.style.setProperty('--policy-gradient', def.visuals.gradient);
    card.style.setProperty('--policy-accent', def.visuals.accentColor);

    const header = document.createElement('div');
    header.className = 'policy-card__header';

    const iconFrame = document.createElement('div');
    iconFrame.className = 'policy-card__icon-frame';

    const icon = document.createElement('img');
    icon.className = 'policy-card__icon';
    icon.src = def.visuals.icon;
    icon.alt = `${def.name} icon`;
    iconFrame.appendChild(icon);

    const heading = document.createElement('div');
    heading.className = 'policy-card__heading';

    const title = document.createElement('h4');
    title.className = 'policy-card__title';
    title.textContent = def.name;
    heading.appendChild(title);

    if (def.visuals.badges?.length) {
      const badgeStrip = document.createElement('div');
      badgeStrip.className = 'policy-card__badges';
      def.visuals.badges.forEach((text) => badgeStrip.appendChild(createBadge(text)));
      heading.appendChild(badgeStrip);
    }

    const stateBadge = document.createElement('span');
    stateBadge.className = 'policy-card__state';
    stateBadge.textContent = 'Ready';

    header.append(iconFrame, heading, stateBadge);

    const description = document.createElement('p');
    description.className = 'policy-card__description';
    description.textContent = def.description;

    const flair = def.visuals.flair
      ? (() => {
          const flairLine = document.createElement('p');
          flairLine.className = 'policy-card__flair';
          flairLine.textContent = def.visuals.flair ?? '';
          return flairLine;
        })()
      : null;

    const actions = document.createElement('div');
    actions.className = 'policy-card__actions';

    const costChip = document.createElement('span');
    costChip.className = 'policy-card__cost';

    const costLabel = document.createElement('span');
    costLabel.className = 'policy-card__cost-label';
    costLabel.textContent = 'Cost';
    const costValue = document.createElement('span');
    costValue.className = 'policy-card__cost-value';
    costValue.textContent = `${numberFormatter.format(def.cost)} ${resourceLabel[def.resource]}`;
    costChip.append(costLabel, costValue);

    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'policy-card__action';
    action.textContent = 'Enact Policy';

    const statusCopy = document.createElement('p');
    statusCopy.className = 'policy-card__status';

    const requirements = document.createElement('ul');
    requirements.className = 'policy-card__requirements';
    requirements.hidden = true;

    actions.append(costChip, action);

    const handleClick = (): void => {
      if (state.applyPolicy(def.id)) {
        updatePolicyCard(def);
      }
    };
    action.addEventListener('click', handleClick);
    disposers.push(() => action.removeEventListener('click', handleClick));

    card.append(header, description);
    if (flair) {
      card.appendChild(flair);
    }
    card.append(actions, statusCopy, requirements);

    policyElements.set(def.id, {
      card,
      action,
      stateBadge,
      statusCopy,
      requirements,
      costChip
    });

    return card;
  }

  function renderPolicies(): void {
    policiesTab.innerHTML = '';
    policyElements.clear();
    const grid = document.createElement('div');
    grid.className = 'policy-grid';
    policies.forEach((policy) => {
      const card = createPolicyCard(policy);
      grid.appendChild(card);
    });
    policiesTab.appendChild(grid);
    updatePolicyCards();
  }

  function updatePolicyCard(def: PolicyDefinition): void {
    const elements = policyElements.get(def.id);
    if (!elements) {
      return;
    }

    const applied = state.hasPolicy(def.id);
    const missing = def.prerequisites.filter((req) => !req.isSatisfied(state));
    const affordable = state.canAfford(def.cost, def.resource);

    elements.action.disabled = applied || missing.length > 0 || !affordable;
    elements.action.textContent = applied ? 'Enacted' : 'Enact Policy';

    let status = 'ready';
    let badgeText = 'Ready';
    let statusLine = def.spotlight ?? 'All signals point to go.';

    elements.requirements.innerHTML = '';
    elements.requirements.hidden = true;

    if (applied) {
      status = 'applied';
      badgeText = 'Enacted';
      statusLine = def.visuals.flair ?? 'Policy active.';
    } else if (missing.length > 0) {
      status = 'locked';
      badgeText = 'Locked';
      statusLine = 'Awaiting requirements:';
      elements.requirements.hidden = false;
      missing.forEach((req) => {
        const item = document.createElement('li');
        item.textContent = req.description;
        elements.requirements.appendChild(item);
      });
    } else if (!affordable) {
      status = 'budget';
      badgeText = 'Needs Resources';
      statusLine = `Earn ${numberFormatter.format(def.cost)} ${resourceLabel[def.resource]} to enact this edict.`;
    }

    elements.card.dataset.status = status;
    elements.stateBadge.textContent = badgeText;
    elements.statusCopy.textContent = statusLine;
    const emphasizeCost = !applied && missing.length === 0 && !affordable;
    elements.costChip.classList.toggle('policy-card__cost--warning', emphasizeCost);
  }

  function updatePolicyCards(): void {
    policies.forEach((policy) => updatePolicyCard(policy));
  }

  renderPolicies();

  const handleResourceChanged = (_payload: unknown): void => updatePolicyCards();
  const handlePolicyApplied = (_event: PolicyAppliedEvent): void => updatePolicyCards();
  const handlePolicyRejected = (_event: PolicyRejectedEvent): void => updatePolicyCards();

  eventBus.on('resourceChanged', handleResourceChanged);
  eventBus.on(POLICY_EVENTS.APPLIED, handlePolicyApplied);
  eventBus.on(POLICY_EVENTS.REJECTED, handlePolicyRejected);
  disposers.push(() => {
    eventBus.off('resourceChanged', handleResourceChanged);
    eventBus.off(POLICY_EVENTS.APPLIED, handlePolicyApplied);
    eventBus.off(POLICY_EVENTS.REJECTED, handlePolicyRejected);
  });

  // --- Events ---
  function createChoiceButton(event: ActiveSchedulerEvent, choice: SchedulerEventContent['choices'][number]): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.add('event-card__choice');
    if (choice.accent) {
      button.classList.add(`event-card__choice--${choice.accent}`);
    }
    button.dataset.choiceId = choice.id;

    const label = document.createElement('span');
    label.className = 'event-card__choice-label';
    label.textContent = choice.label;
    button.appendChild(label);

    if (choice.description) {
      const detail = document.createElement('span');
      detail.className = 'event-card__choice-detail';
      detail.textContent = choice.description;
      button.appendChild(detail);
    }

    button.addEventListener('click', () => {
      if (!button.isConnected) {
        return;
      }
      button.disabled = true;
      const resolved = eventScheduler.resolve(event.id, choice.id);
      if (!resolved) {
        button.disabled = false;
      }
    });

    return button;
  }

  function renderEvents(activeEvents: ActiveSchedulerEvent[]): void {
    eventsTab.innerHTML = '';
    if (activeEvents.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'event-card event-card--empty';
      const emptyCopy = document.createElement('p');
      emptyCopy.className = 'event-card__empty';
      emptyCopy.textContent = 'All clear. Command will notify you when new briefings arrive.';
      empty.appendChild(emptyCopy);
      eventsTab.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const ev of activeEvents) {
      const card = document.createElement('article');
      card.className = 'event-card';
      card.dataset.eventId = ev.id;
      card.style.setProperty('--event-accent', ev.accentColor ?? 'var(--color-accent)');

      const typography = (ev.typography ?? 'sans').toLowerCase();
      card.classList.add(`event-card--${['serif', 'mono'].includes(typography) ? typography : 'sans'}`);

      const animation = (ev.animation ?? '').toLowerCase();
      if (['aurora', 'pulse', 'tilt'].includes(animation)) {
        card.classList.add(`event-card--${animation}`);
      }

      const frame = document.createElement('div');
      frame.className = 'event-card__frame';

      if (ev.art) {
        const media = document.createElement('div');
        media.className = 'event-card__media';
        media.style.backgroundImage = `url(${ev.art})`;
        frame.appendChild(media);
      }

      const body = document.createElement('div');
      body.className = 'event-card__body';

      const badge = document.createElement('span');
      badge.className = 'event-card__badge';
      badge.textContent = 'Priority Dispatch';
      body.appendChild(badge);

      const headline = document.createElement('h4');
      headline.className = 'event-card__headline';
      headline.textContent = ev.headline;
      body.appendChild(headline);

      const copy = document.createElement('p');
      copy.className = 'event-card__copy';
      copy.textContent = ev.body;
      body.appendChild(copy);

      const choicesContainer = document.createElement('div');
      choicesContainer.className = 'event-card__choices';
      const choices = ev.choices && ev.choices.length > 0
        ? ev.choices
        : [
            {
              id: 'acknowledge',
              label: ev.acknowledgeText ?? 'Acknowledge'
            }
          ];
      for (const choice of choices) {
        const button = createChoiceButton(ev, {
          id: choice.id,
          label: choice.label,
          description: choice.description,
          event: choice.event,
          payload: choice.payload,
          accent: choice.accent
        });
        choicesContainer.appendChild(button);
      }

      body.appendChild(choicesContainer);
      frame.appendChild(body);

      const shimmer = document.createElement('span');
      shimmer.className = 'event-card__shimmer';
      card.append(frame, shimmer);
      fragment.appendChild(card);
    }

    eventsTab.appendChild(fragment);
  }

  const unsubscribeScheduler = eventScheduler.subscribe(renderEvents);
  disposers.push(unsubscribeScheduler);

  const handleSchedulerTriggered = ({ event }: SchedulerTriggeredPayload): void => {
    logEvent({
      type: 'event',
      message: `Event • ${event.headline}`,
      metadata: {
        eventId: (event as ActiveSchedulerEvent)?.id ?? event.headline,
        headline: event.headline
      }
    });
  };
  eventBus.on(SCHEDULER_EVENTS.TRIGGERED, handleSchedulerTriggered);
  disposers.push(() => {
    eventBus.off(SCHEDULER_EVENTS.TRIGGERED, handleSchedulerTriggered);
  });

  function addEvent(ev: GameEvent): void {
    eventScheduler.publish(ev);
  }

  // --- Log ---
  type LogEntryNodeState = {
    element: HTMLElement;
    type: LogEventType;
    occurrences: number;
    badge: HTMLSpanElement;
    message: HTMLParagraphElement;
    tokens: HTMLDivElement | null;
    setBadge: (value: number) => void;
  };

  const entryStates = new Map<string, LogEntryNodeState>();
  const typeCounts = new Map<LogEventType, number>();
  const typeBadges = new Map<LogEventType, HTMLSpanElement>();
  const mutedTypes = new Set(readLogPreferences().mutedTypes ?? []);
  const activeTypes = new Set<LogEventType>();

  for (const type of LOG_EVENT_ORDER) {
    if (!mutedTypes.has(type)) {
      activeTypes.add(type);
    }
    typeCounts.set(type, 0);
  }

  let totalOccurrences = 0;
  let stickToBottom = true;

  const scheduleFrame =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb: FrameRequestCallback) => setTimeout(cb, 16);

  const formatCount = (value: number): string => numberFormatter.format(Math.max(0, value));

  const updateTotalBadge = (): void => {
    const label = totalOccurrences === 1 ? 'entry' : 'entries';
    logTotal.textContent = `${formatCount(totalOccurrences)} ${label}`;
  };

  const updateTypeBadge = (type: LogEventType): void => {
    const badge = typeBadges.get(type);
    if (!badge) {
      return;
    }
    badge.textContent = formatCount(typeCounts.get(type) ?? 0);
  };

  const adjustCounts = (type: LogEventType, delta: number): void => {
    if (delta === 0) {
      return;
    }
    const currentTypeTotal = typeCounts.get(type) ?? 0;
    typeCounts.set(type, Math.max(0, currentTypeTotal + delta));
    totalOccurrences = Math.max(0, totalOccurrences + delta);
    updateTypeBadge(type);
    updateTotalBadge();
  };

  const isNearBottom = (): boolean => {
    return logFeed.scrollHeight - (logFeed.scrollTop + logFeed.clientHeight) < 48;
  };

  const scrollToBottom = (): void => {
    scheduleFrame(() => {
      logFeed.scrollTop = logFeed.scrollHeight;
      stickToBottom = true;
    });
  };

  const ensureVisibility = (state: LogEntryNodeState): void => {
    const visible = activeTypes.has(state.type);
    state.element.hidden = !visible;
    state.element.classList.toggle('panel-log-entry--muted', !visible);
  };

  const extractSpawnNames = (entry: LogEntry): string[] => {
    const meta = entry.metadata ?? {};
    const base = Array.isArray(meta.unitNames)
      ? meta.unitNames
      : typeof meta.unitName === 'string'
        ? [meta.unitName]
        : [];
    return base
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value): value is string => value.length > 0);
  };

  const renderSpawnTokens = (container: HTMLDivElement, entry: LogEntry): void => {
    if (entry.type !== 'spawn') {
      container.replaceChildren();
      container.hidden = true;
      return;
    }
    const names = extractSpawnNames(entry);
    const fragments: HTMLElement[] = names.map((name) => {
      const chip = document.createElement('span');
      chip.className = 'panel-log-entry__token';
      chip.textContent = name;
      return chip;
    });
    const remainder = entry.occurrences - names.length;
    if (remainder > 0) {
      const chip = document.createElement('span');
      chip.className = 'panel-log-entry__token panel-log-entry__token--more';
      chip.textContent = `+${remainder}`;
      fragments.push(chip);
    }
    if (fragments.length === 0) {
      container.replaceChildren();
      container.hidden = true;
    } else {
      container.replaceChildren(...fragments);
      container.hidden = false;
    }
  };

  const renderLogEntry = (entry: LogEntry): LogEntryNodeState => {
    const element = document.createElement('article');
    element.className = 'panel-log-entry';
    element.dataset.logType = entry.type;
    element.style.setProperty(
      '--log-entry-accent',
      LOG_EVENT_META[entry.type]?.accent ?? 'var(--color-accent)'
    );

    const headerRow = document.createElement('div');
    headerRow.className = 'panel-log-entry__header';

    const typeChip = document.createElement('span');
    typeChip.className = 'panel-log-entry__type';
    typeChip.textContent = LOG_EVENT_META[entry.type]?.label ?? entry.type;

    const badge = document.createElement('span');
    badge.className = 'panel-log-entry__badge';

    const message = document.createElement('p');
    message.className = 'panel-log-entry__message';
    message.textContent = entry.message;

    const tokens = document.createElement('div');
    tokens.className = 'panel-log-entry__tokens';
    tokens.hidden = true;

    headerRow.append(typeChip, badge);
    element.append(headerRow, message, tokens);

    const setBadge = (value: number): void => {
      if (value <= 1) {
        badge.textContent = '';
        badge.hidden = true;
      } else {
        badge.hidden = false;
        badge.textContent = `×${value}`;
      }
    };

    const state: LogEntryNodeState = {
      element,
      type: entry.type,
      occurrences: entry.occurrences,
      badge,
      message,
      tokens,
      setBadge
    };

    setBadge(entry.occurrences);
    renderSpawnTokens(tokens, entry);

    return state;
  };

  const appendEntry = (entry: LogEntry, hydrate = false): void => {
    const stick = hydrate ? true : isNearBottom() || stickToBottom;
    const state = renderLogEntry(entry);
    entryStates.set(entry.id, state);
    logFeed.appendChild(state.element);
    adjustCounts(state.type, state.occurrences);
    ensureVisibility(state);
    if (stick) {
      scrollToBottom();
    }
  };

  const updateEntry = (entry: LogEntry): void => {
    const state = entryStates.get(entry.id);
    if (!state) {
      return;
    }
    const delta = entry.occurrences - state.occurrences;
    if (delta !== 0) {
      state.occurrences = entry.occurrences;
      adjustCounts(state.type, delta);
    }
    state.message.textContent = entry.message;
    state.setBadge(entry.occurrences);
    if (state.tokens) {
      renderSpawnTokens(state.tokens, entry);
    }
    ensureVisibility(state);
    if (stickToBottom) {
      scrollToBottom();
    }
  };

  const removeEntry = (entry: LogEntry): void => {
    const state = entryStates.get(entry.id);
    if (!state) {
      return;
    }
    entryStates.delete(entry.id);
    adjustCounts(state.type, -state.occurrences);
    if (state.element.parentElement === logFeed) {
      logFeed.removeChild(state.element);
    }
  };

  const refreshEntryVisibility = (): void => {
    for (const state of entryStates.values()) {
      ensureVisibility(state);
    }
  };

  for (const type of LOG_EVENT_ORDER) {
    const meta = LOG_EVENT_META[type];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'log-chip';
    button.dataset.logFilter = type;
    button.style.setProperty('--log-chip-accent', meta?.accent ?? 'var(--color-accent)');
    button.setAttribute('aria-pressed', activeTypes.has(type) ? 'true' : 'false');
    button.setAttribute('aria-label', `${meta?.label ?? type} log filter`);

    const label = document.createElement('span');
    label.className = 'log-chip__label';
    label.textContent = meta?.label ?? type;

    const badge = document.createElement('span');
    badge.className = 'log-chip__count';
    badge.textContent = '0';
    typeBadges.set(type, badge);

    if (!activeTypes.has(type)) {
      button.classList.add('is-muted');
    }

    button.append(label, badge);
    logFilters.appendChild(button);

    button.addEventListener('click', () => {
      const isActive = activeTypes.has(type);
      if (isActive) {
        activeTypes.delete(type);
        mutedTypes.add(type);
      } else {
        activeTypes.add(type);
        mutedTypes.delete(type);
      }
      button.classList.toggle('is-muted', !activeTypes.has(type));
      button.setAttribute('aria-pressed', activeTypes.has(type) ? 'true' : 'false');
      writeLogPreferences({ mutedTypes: Array.from(mutedTypes) });
      refreshEntryVisibility();
    });
  }

  updateTotalBadge();

  const handleLogScroll = (): void => {
    stickToBottom = isNearBottom();
  };
  logFeed.addEventListener('scroll', handleLogScroll, { passive: true });
  disposers.push(() => logFeed.removeEventListener('scroll', handleLogScroll));

  const seedHistory = getLogHistory();
  if (seedHistory.length > 0) {
    for (const entry of seedHistory) {
      appendEntry(entry, true);
    }
    scrollToBottom();
  }

  const unsubscribeLogs = subscribeToLogs((change: LogChange) => {
    if (change.kind === 'append') {
      appendEntry(change.entry);
    } else if (change.kind === 'update') {
      updateEntry(change.entry);
    } else if (change.kind === 'remove') {
      for (const entry of change.entries) {
        removeEntry(entry);
      }
    }
  });
  disposers.push(unsubscribeLogs);

  refreshEntryVisibility();

  show('Roster');
  const dispose = (): void => {
    for (const cleanup of disposers.splice(0)) {
      try {
        cleanup();
      } catch (error) {
        console.warn('Failed to dispose HUD listener', error);
      }
    }
    unbindMobileKeydown();
    resetDrag();
    document.body.classList.remove(scrollLockClass);
    slideOver.remove();
    toggle.remove();
    panel.remove();
  };

  return {
    log: (event: LogEventPayload) => {
      logEvent(event);
    },
    addEvent,
    renderRoster,
    dispose
  };
}

