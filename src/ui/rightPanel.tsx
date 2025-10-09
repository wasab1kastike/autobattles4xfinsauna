import { GameState } from '../core/GameState.ts';
import {
  eventBus,
  eventScheduler,
  SCHEDULER_EVENTS,
  type ActiveSchedulerEvent,
  type SchedulerEventContent,
  type SchedulerTriggeredPayload
} from '../events';
import {
  ensureHudLayout,
  HUD_OVERLAY_COLLAPSED_CLASS,
  type HudBottomTabId,
} from './layout.ts';
import { subscribeToIsMobile } from './hooks/useIsMobile.ts';
import { createRosterPanel } from './panels/RosterPanel.tsx';
import type { RosterEntry } from './panels/RosterPanel.tsx';
import type { EquipmentSlotId } from '../items/types.ts';
import type { UnitBehavior } from '../unit/types.ts';
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
import { createPolicyPanel } from './policies/PolicyPanel.ts';
import type { HudNavigationView } from './hudNavigation.tsx';

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
  onRosterBehaviorChange?: (unitId: string, behavior: UnitBehavior) => void;
  getRosterCap?: () => number;
  getRosterCapLimit?: () => number;
  updateMaxRosterSize?: (value: number, options?: { persist?: boolean }) => number;
};

type RightPanelView = HudNavigationView;

export function setupRightPanel(
  state: GameState,
  options: RightPanelOptions = {}
): {
  log: (event: LogEventPayload) => void;
  addEvent: (ev: GameEvent) => void;
  renderRoster: (entries: RosterEntry[]) => void;
  showView: (view: RightPanelView) => void;
  openRosterView: () => void;
  closeRosterView: () => void;
  onRosterVisibilityChange: (listener: (isOpen: boolean) => void) => () => void;
  onViewChange: (listener: (view: RightPanelView) => void) => () => void;
  dispose: () => void;
} {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) {
    return {
      log: () => {},
      addEvent: () => {},
      renderRoster: () => {},
      showView: () => {},
      openRosterView: () => {},
      closeRosterView: () => {},
      onRosterVisibilityChange: () => () => {},
      onViewChange: () => () => {},
      dispose: () => {}
    };
  }

  const { regions, anchors, dock, mobileBar, tabs: bottomTabs } = ensureHudLayout(overlay);
  const doc = overlay.ownerDocument ?? document;
  const rightRegion = regions.right;
  const commandDock = dock.actions;
  const policyHudPanel = bottomTabs.panels.policies;

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

  const smallViewportQuery = window.matchMedia('(max-width: 960px)');
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
    if (toggle.parentElement !== commandDock) {
      commandDock.prepend(toggle);
    } else if (commandDock.firstElementChild !== toggle) {
      commandDock.insertBefore(toggle, commandDock.firstElementChild);
    }
  };

  let isCollapsed = false;
  let narrowLayoutCollapsed = false;
  let isMobileViewport = false;
  let isMobilePanelOpen = false;

  const viewListeners = new Set<(view: RightPanelView) => void>();
  let activeView: RightPanelView = 'roster';
  let syncingBottomTabs = false;
  let skipInitialRosterExpand = true;

  const rosterVisibilityListeners = new Set<(isOpen: boolean) => void>();

  const isPanelOpen = (): boolean => {
    if (isMobileViewport) {
      return isMobilePanelOpen;
    }
    if (!smallViewportQuery.matches) {
      return true;
    }
    return !isCollapsed;
  };

  const emitRosterVisibility = (): void => {
    const visible = activeView === 'roster' && isPanelOpen();
    for (const listener of rosterVisibilityListeners) {
      try {
        listener(visible);
      } catch (error) {
        console.warn('Failed to notify roster visibility listener', error);
      }
    }
  };

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
    overlay.classList.toggle(HUD_OVERLAY_COLLAPSED_CLASS, shouldCollapse);
    panel.setAttribute('aria-hidden', shouldCollapse ? 'true' : 'false');
    refreshTogglePresentation();
    emitRosterVisibility();
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
    emitRosterVisibility();
  };

  const closeMobilePanel = ({ skipFocus = false }: { skipFocus?: boolean } = {}) => {
    const wasOpen = isMobilePanelOpen;
    resetDrag();
    isMobilePanelOpen = false;
    slideOver.classList.remove('right-panel-slide--open');
    slideOver.setAttribute('aria-hidden', 'true');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove(scrollLockClass);
    slideOver.style.setProperty('--panel-drag-progress', '0');
    refreshTogglePresentation();
    unbindMobileKeydown();
    emitRosterVisibility();
    if (wasOpen && !skipFocus) {
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
      overlay.classList.remove(HUD_OVERLAY_COLLAPSED_CLASS);
      if (!isMobilePanelOpen) {
        panel.setAttribute('aria-hidden', 'true');
        slideOver.setAttribute('aria-hidden', 'true');
        slideOver.style.setProperty('--panel-drag-progress', '0');
      }
    } else {
      closeMobilePanel({ skipFocus: true });
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

  const content = doc.createElement('div');
  content.classList.add('panel-content');
  panel.appendChild(content);

  const viewRoot = doc.createElement('div');
  viewRoot.className = 'panel-views';
  content.appendChild(viewRoot);

  const rosterView = doc.createElement('section');
  rosterView.id = 'right-panel-roster';
  rosterView.classList.add('panel-view', 'panel-view--roster');
  rosterView.setAttribute('role', 'region');
  rosterView.setAttribute('aria-live', 'polite');
  rosterView.setAttribute('aria-label', 'Battalion roster');

  const rosterContainer = doc.createElement('div');
  rosterContainer.className = 'panel-section panel-section--scroll';
  rosterContainer.dataset.hudTabPanel = 'roster';
  rosterView.appendChild(rosterContainer);

  const policiesView = doc.createElement('section');
  policiesView.id = 'right-panel-policies';
  policiesView.classList.add('panel-view', 'panel-view--policies');
  policiesView.setAttribute('role', 'region');
  policiesView.setAttribute('aria-live', 'polite');
  policiesView.setAttribute('aria-label', 'Sauna policies');

  const policiesContainer = policyHudPanel ?? doc.createElement('div');
  if (policiesContainer.parentElement) {
    policiesContainer.parentElement.removeChild(policiesContainer);
  }
  policiesContainer.innerHTML = '';
  policiesContainer.className = 'panel-section panel-section--scroll panel-section--policies';
  policiesContainer.dataset.hudTabPanel = 'policies';
  policiesView.appendChild(policiesContainer);
  bottomTabs.panels.policies = policiesContainer;

  const eventsView = doc.createElement('section');
  eventsView.id = 'right-panel-events';
  eventsView.classList.add('panel-view', 'panel-view--events');
  eventsView.setAttribute('role', 'region');
  eventsView.setAttribute('aria-live', 'polite');
  eventsView.setAttribute('aria-label', 'Events feed');

  const eventsContainer = doc.createElement('div');
  eventsContainer.className = 'panel-section panel-section--scroll panel-section--events';
  eventsContainer.dataset.hudTabPanel = 'events';
  eventsView.appendChild(eventsContainer);

  viewRoot.append(rosterView, policiesView, eventsView);

  const logPreferences = readLogPreferences();

  const logSection = doc.createElement('section');
  logSection.id = 'right-panel-log';
  logSection.setAttribute('role', 'region');
  logSection.setAttribute('aria-label', 'Combat log');
  logSection.className = 'panel-log';

  const logHeader = doc.createElement('header');
  logHeader.className = 'panel-log__header';

  const logHeadline = doc.createElement('div');
  logHeadline.className = 'panel-log__headline';

  const logTitle = doc.createElement('h3');
  logTitle.className = 'panel-log__title';
  logTitle.textContent = 'Combat Log';

  const logTotal = doc.createElement('span');
  logTotal.className = 'panel-log__total';
  logTotal.textContent = '0 entries';
  logHeadline.append(logTitle, logTotal);

  const logToggle = doc.createElement('button');
  logToggle.type = 'button';
  logToggle.className = 'panel-log__toggle';
  logToggle.setAttribute('aria-controls', 'panel-log-body');

  const logToggleLabel = doc.createElement('span');
  logToggleLabel.className = 'panel-log__toggle-label';
  logToggleLabel.textContent = 'Collapse';

  const logToggleIcon = doc.createElement('span');
  logToggleIcon.className = 'panel-log__chevron';
  logToggleIcon.setAttribute('aria-hidden', 'true');

  logToggle.append(logToggleLabel, logToggleIcon);

  logHeader.append(logHeadline, logToggle);

  const logBody = doc.createElement('div');
  logBody.className = 'panel-log__body';
  logBody.id = 'panel-log-body';

  const logFilters = doc.createElement('div');
  logFilters.className = 'panel-log__filters';

  const logFeed = doc.createElement('div');
  logFeed.id = 'event-log';
  logFeed.className = 'panel-log__feed';
  logFeed.setAttribute('role', 'log');
  logFeed.setAttribute('aria-live', 'polite');

  logBody.append(logFilters, logFeed);
  logSection.append(logHeader, logBody);
  content.appendChild(logSection);

  const viewContainers: Record<RightPanelView, HTMLElement> = {
    roster: rosterView,
    policies: policiesView,
    events: eventsView
  };

  const syncRosterState = (view: RightPanelView) => {
    const shouldSkipExpand = skipInitialRosterExpand;
    skipInitialRosterExpand = false;
    if (view === 'roster') {
      if (!syncingBottomTabs) {
        syncingBottomTabs = true;
        bottomTabs.setActive('roster');
        syncingBottomTabs = false;
      }
      if (!shouldSkipExpand) {
        if (isMobileViewport) {
          openMobilePanel();
        } else {
          applyCollapsedState(false);
        }
      }
    }
    emitRosterVisibility();
  };

  const applyView = (view: RightPanelView) => {
    const next = view ?? 'roster';
    activeView = next;
    panel.dataset.activeView = next;
    viewRoot.dataset.activeView = next;
    (Object.entries(viewContainers) as Array<[RightPanelView, HTMLElement]>).forEach(([key, element]) => {
      const isActive = key === next;
      element.hidden = !isActive;
      element.dataset.active = isActive ? 'true' : 'false';
    });
    syncRosterState(next);
  };

  const showView = (view: RightPanelView) => {
    if (activeView === view) {
      syncRosterState(view);
      return;
    }
    applyView(view);
    for (const listener of viewListeners) {
      listener(view);
    }
  };

  const onViewChange = (listener: (view: RightPanelView) => void): (() => void) => {
    viewListeners.add(listener);
    return () => {
      viewListeners.delete(listener);
    };
  };

  applyView(activeView);

  const detachBottomTabListener = bottomTabs.onChange((tabId) => {
    if (syncingBottomTabs) {
      return;
    }
    if (tabId === 'roster') {
      showView('roster');
    }
  });
  disposers.push(detachBottomTabListener);

  const { onRosterSelect, onRosterRendererReady, onRosterEquipSlot, onRosterUnequipSlot } = options;

  // --- Roster ---
  const rosterPanel = createRosterPanel(rosterContainer, {
    onSelect: onRosterSelect,
    onEquipSlot: onRosterEquipSlot,
    onUnequipSlot: onRosterUnequipSlot,
    onBehaviorChange: options.onRosterBehaviorChange,
    getRosterCap: options.getRosterCap,
    getRosterCapLimit: options.getRosterCapLimit,
    updateMaxRosterSize: options.updateMaxRosterSize
  });

  const renderRoster = (entries: RosterEntry[]): void => {
    rosterPanel.render(entries);
  };

  renderRoster([]);

  if (typeof onRosterRendererReady === 'function') {
    onRosterRendererReady(renderRoster);
  }

  // --- Policies ---
  const policyPanel = createPolicyPanel(policiesContainer, state);
  disposers.push(() => policyPanel.destroy());

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
    eventsContainer.innerHTML = '';
    if (activeEvents.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'event-card event-card--empty';
      const emptyCopy = document.createElement('p');
      emptyCopy.className = 'event-card__empty';
      emptyCopy.textContent = 'All clear. Command will notify you when new briefings arrive.';
      empty.appendChild(emptyCopy);
      eventsContainer.appendChild(empty);
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

    eventsContainer.appendChild(fragment);
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
  const mutedTypes = new Set(logPreferences.mutedTypes ?? []);
  let logCollapsed = Boolean(logPreferences.isCollapsed);
  const activeTypes = new Set<LogEventType>();

  const persistLogPreferences = (): void => {
    writeLogPreferences({
      mutedTypes: Array.from(mutedTypes),
      isCollapsed: logCollapsed
    });
  };

  const updateLogTogglePresentation = (): void => {
    logSection.classList.toggle('panel-log--collapsed', logCollapsed);
    logBody.hidden = logCollapsed;
    logBody.setAttribute('aria-hidden', logCollapsed ? 'true' : 'false');
    logFeed.setAttribute('aria-hidden', logCollapsed ? 'true' : 'false');
    logToggle.setAttribute('aria-expanded', logCollapsed ? 'false' : 'true');
    logToggleLabel.textContent = logCollapsed ? 'Expand' : 'Collapse';
    const toggleTitle = logCollapsed ? 'Expand the combat log' : 'Collapse the combat log';
    logToggle.setAttribute('aria-label', toggleTitle);
    logToggle.title = toggleTitle;
  };

  updateLogTogglePresentation();

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

  const setLogCollapsed = (collapsed: boolean): void => {
    if (logCollapsed === collapsed) {
      return;
    }
    logCollapsed = collapsed;
    if (logCollapsed) {
      stickToBottom = true;
    }
    updateLogTogglePresentation();
    persistLogPreferences();
    if (!logCollapsed) {
      scrollToBottom();
    }
  };

  const handleLogToggleClick = (): void => {
    setLogCollapsed(!logCollapsed);
  };
  logToggle.addEventListener('click', handleLogToggleClick);
  disposers.push(() => logToggle.removeEventListener('click', handleLogToggleClick));

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
    if (logCollapsed) {
      return false;
    }
    return logFeed.scrollHeight - (logFeed.scrollTop + logFeed.clientHeight) < 48;
  };

  const scrollToBottom = (): void => {
    if (logCollapsed) {
      stickToBottom = true;
      return;
    }
    scheduleFrame(() => {
      if (logCollapsed) {
        stickToBottom = true;
        return;
      }
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
    const stick = logCollapsed ? false : hydrate ? true : isNearBottom() || stickToBottom;
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
      persistLogPreferences();
      refreshEntryVisibility();
    });
  }

  updateTotalBadge();

  const handleLogScroll = (): void => {
    if (logCollapsed) {
      return;
    }
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
    overlay.classList.remove(HUD_OVERLAY_COLLAPSED_CLASS);
    viewListeners.clear();
    rosterVisibilityListeners.clear();
  };

  return {
    log: (event: LogEventPayload) => {
      logEvent(event);
    },
    addEvent,
    renderRoster,
    showView,
    openRosterView: () => {
      if (isMobileViewport) {
        openMobilePanel();
      } else {
        applyCollapsedState(false);
      }
      showView('roster');
    },
    closeRosterView: () => {
      if (isMobileViewport) {
        closeMobilePanel();
      } else {
        applyCollapsedState(true);
      }
    },
    onRosterVisibilityChange: (listener: (isOpen: boolean) => void) => {
      rosterVisibilityListeners.add(listener);
      try {
        listener(false);
      } catch (error) {
        console.warn('Failed to notify roster visibility listener', error);
      }
      return () => {
        rosterVisibilityListeners.delete(listener);
      };
    },
    onViewChange,
    dispose
  };
}

