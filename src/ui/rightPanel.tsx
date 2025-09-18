import { GameState, Resource } from '../core/GameState.ts';
import { eventBus } from '../events';
import { ensureHudLayout } from './layout.ts';
import { createRosterPanel } from './panels/RosterPanel.tsx';
import type { RosterEntry } from './panels/RosterPanel.tsx';

export type { RosterEntry, RosterItem, RosterModifier, RosterStats } from './panels/RosterPanel.tsx';

export type GameEvent = {
  id: string;
  headline: string;
  body: string;
  buttonText?: string;
};

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

type RightPanelOptions = {
  onRosterSelect?: (unitId: string) => void;
  onRosterRendererReady?: (renderer: (entries: RosterEntry[]) => void) => void;
};

export function setupRightPanel(
  state: GameState,
  options: RightPanelOptions = {}
): {
  log: (msg: string) => void;
  addEvent: (ev: GameEvent) => void;
  renderRoster: (entries: RosterEntry[]) => void;
} {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) {
    return { log: () => {}, addEvent: () => {}, renderRoster: () => {} };
  }

  const { actions, side } = ensureHudLayout(overlay);

  const existingPanel = overlay.querySelector<HTMLDivElement>('#right-panel');
  if (existingPanel) {
    existingPanel.remove();
  }

  const existingToggle = actions.querySelector<HTMLButtonElement>('#right-panel-toggle');
  if (existingToggle) {
    existingToggle.remove();
  }

  const panel = document.createElement('div');
  panel.id = 'right-panel';
  panel.classList.add('hud-card');
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'Sauna command console');
  panel.tabIndex = -1;

  const smallViewportQuery = window.matchMedia('(max-width: 960px)');

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
    const topbar = actions.querySelector<HTMLElement>('#topbar');
    if (topbar && topbar.parentElement === actions) {
      topbar.insertAdjacentElement('afterend', toggle);
    } else {
      actions.prepend(toggle);
    }
  };
  insertToggle();

  let isCollapsed = false;
  let narrowLayoutCollapsed = false;

  const applyCollapsedState = (
    collapsed: boolean,
    matches = smallViewportQuery.matches
  ): void => {
    const wasCollapsed = isCollapsed;
    if (matches) {
      narrowLayoutCollapsed = collapsed;
    }
    const shouldCollapse = collapsed && matches;
    isCollapsed = shouldCollapse;
    panel.classList.toggle('right-panel--collapsed', shouldCollapse);
    panel.setAttribute('aria-hidden', shouldCollapse ? 'true' : 'false');
    toggle.setAttribute('aria-expanded', shouldCollapse ? 'false' : 'true');
    toggleState.textContent = shouldCollapse ? 'Open' : 'Close';
    const label = shouldCollapse ? 'Open command console panel' : 'Close command console panel';
    toggle.setAttribute('aria-label', label);
    toggle.title = shouldCollapse
      ? 'Open the sauna command console overlay'
      : 'Close the sauna command console overlay';
    if (wasCollapsed && !shouldCollapse && matches) {
      panel.focus({ preventScroll: true });
    }
  };

  applyCollapsedState(narrowLayoutCollapsed, smallViewportQuery.matches);
  toggle.hidden = !smallViewportQuery.matches;

  const handleViewportChange = (event: MediaQueryListEvent): void => {
    const matches = event.matches;
    toggle.hidden = !matches;
    const collapsed = matches ? narrowLayoutCollapsed : false;
    applyCollapsedState(collapsed, matches);
  };

  if (typeof smallViewportQuery.addEventListener === 'function') {
    smallViewportQuery.addEventListener('change', handleViewportChange);
  } else {
    smallViewportQuery.addListener(handleViewportChange);
  }

  toggle.addEventListener('click', () => {
    const next = !isCollapsed;
    applyCollapsedState(next);
  });

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
  const logTab = document.createElement('div');
  logTab.id = 'event-log';
  logTab.setAttribute('role', 'log');
  logTab.setAttribute('aria-live', 'polite');

  const tabs: Record<string, HTMLDivElement> = {
    Roster: rosterTab,
    Policies: policiesTab,
    Events: eventsTab,
    Log: logTab
  };

  const { onRosterSelect, onRosterRendererReady } = options;
  for (const [name, section] of Object.entries(tabs)) {
    section.classList.add('panel-section', 'panel-section--scroll');
    section.dataset.tab = name;
    section.hidden = true;
  }
  logTab.classList.add('panel-section--log');

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
    btn.addEventListener('click', () => show(name));
    tabBar.appendChild(btn);
    content.appendChild(tabs[name]);
  }

  side.appendChild(panel);

  // --- Roster ---
  const rosterPanel = createRosterPanel(rosterTab, { onSelect: onRosterSelect });

  const renderRoster = (entries: RosterEntry[]): void => {
    rosterPanel.render(entries);
  };

  renderRoster([]);

  if (typeof onRosterRendererReady === 'function') {
    onRosterRendererReady(renderRoster);
  }

  // --- Policies ---
  type PolicyDef = {
    id: string;
    name: string;
    description: string;
    cost: number;
    resource: Resource;
    prerequisite: (s: GameState) => boolean;
  };

  const resourceLabel: Record<Resource, string> = {
    [Resource.SAUNA_BEER]: 'Sauna Beer Bottles',
    [Resource.SAUNAKUNNIA]: 'Saunakunnia'
  };

  const policyDefs: PolicyDef[] = [
    {
      id: 'eco',
      name: 'Eco Policy',
      description: 'Increase passive sauna beer brewing by 1 bottle per tick',
      cost: 15,
      resource: Resource.SAUNAKUNNIA,
      prerequisite: () => true
    },
    {
      id: 'temperance',
      name: 'Temperance',
      description: '+5% work speed at night',
      cost: 25,
      resource: Resource.SAUNAKUNNIA,
      prerequisite: () => true
    },
    {
      id: 'steam-diplomats',
      name: 'Steam Diplomats',
      description: 'Import +2 sauna beer bottles per tick through diplomatic envoys',
      cost: 8,
      resource: Resource.SAUNAKUNNIA,
      prerequisite: () => true
    }
  ];

  const policyButtons: Record<string, HTMLButtonElement> = {};

  function renderPolicies(): void {
    policiesTab.innerHTML = '';
    for (const def of policyDefs) {
      const btn = document.createElement('button');
      const resource = def.resource;
      btn.textContent = `${def.name} (${numberFormatter.format(def.cost)} ${resourceLabel[resource]})`;
      btn.title = `${def.description}. Costs ${numberFormatter.format(def.cost)} ${resourceLabel[resource]}.`;
      btn.classList.add('panel-action');
      btn.disabled =
        !def.prerequisite(state) ||
        state.hasPolicy(def.id) ||
        !state.canAfford(def.cost, resource);
      btn.addEventListener('click', () => {
        if (state.applyPolicy(def.id, def.cost, resource)) {
          updatePolicyButtons();
        }
      });
      policiesTab.appendChild(btn);
      policyButtons[def.id] = btn;
    }
  }

  function updatePolicyButtons(): void {
    for (const def of policyDefs) {
      const btn = policyButtons[def.id];
      if (btn) {
        const resource = def.resource;
        btn.disabled =
          !def.prerequisite(state) ||
          state.hasPolicy(def.id) ||
          !state.canAfford(def.cost, resource);
      }
    }
  }

  renderPolicies();
  eventBus.on('resourceChanged', updatePolicyButtons);
  eventBus.on('policyApplied', updatePolicyButtons);

  // --- Events ---
  const events: GameEvent[] = [];

  function renderEvents(): void {
    eventsTab.innerHTML = '';
    for (const ev of events) {
      const wrapper = document.createElement('div');
      wrapper.classList.add('panel-event');
      const h = document.createElement('h4');
      h.textContent = ev.headline;
      const p = document.createElement('p');
      p.textContent = ev.body;
      const btn = document.createElement('button');
      btn.textContent = ev.buttonText ?? 'Acknowledge';
      btn.classList.add('panel-action');
      btn.addEventListener('click', () => {
        const idx = events.findIndex((e) => e.id === ev.id);
        if (idx !== -1) {
          events.splice(idx, 1);
          renderEvents();
        }
      });
      wrapper.appendChild(h);
      wrapper.appendChild(p);
      wrapper.appendChild(btn);
      eventsTab.appendChild(wrapper);
    }
  }

  function addEvent(ev: GameEvent): void {
    events.push(ev);
    renderEvents();
    log(`Event • ${ev.headline}`);
  }

  // --- Log ---
  const LOG_STORAGE_KEY = 'autobattles:panel-log';
  const MAX_LOG_MESSAGES = 100;
  const pending: string[] = [];
  let scheduled = false;
  const logHistory: string[] = [];

  const readStoredLogs = (): string[] => {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return [];
    }
    try {
      const serialized = window.localStorage.getItem(LOG_STORAGE_KEY);
      if (!serialized) {
        return [];
      }
      const parsed = JSON.parse(serialized);
      if (!Array.isArray(parsed)) {
        return [];
      }
      const sanitized = parsed.filter((msg) => typeof msg === 'string');
      if (sanitized.length > MAX_LOG_MESSAGES) {
        return sanitized.slice(-MAX_LOG_MESSAGES);
      }
      return sanitized;
    } catch {
      return [];
    }
  };

  const persistLogs = (messages: string[]): void => {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return;
    }
    try {
      const bounded = messages.length > MAX_LOG_MESSAGES
        ? messages.slice(-MAX_LOG_MESSAGES)
        : messages;
      window.localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(bounded));
    } catch {
      // Best effort persistence; ignore storage errors.
    }
  };

  const appendLogEntry = (msg: string): void => {
    const div = document.createElement('div');
    div.textContent = msg;
    div.classList.add('panel-log-entry');
    logTab.appendChild(div);
  };

  const hydrateStoredLogs = (): void => {
    const stored = readStoredLogs();
    if (stored.length === 0) {
      return;
    }
    for (const msg of stored) {
      appendLogEntry(msg);
      logHistory.push(msg);
    }
    logTab.scrollTop = logTab.scrollHeight;
  };

  hydrateStoredLogs();

  function flush(): void {
    for (const msg of pending) {
      appendLogEntry(msg);
    }
    if (pending.length > 0) {
      logHistory.push(...pending);
      if (logHistory.length > MAX_LOG_MESSAGES) {
        const overflow = logHistory.length - MAX_LOG_MESSAGES;
        logHistory.splice(0, overflow);
        for (let i = 0; i < overflow; i += 1) {
          if (logTab.firstChild) {
            logTab.removeChild(logTab.firstChild);
          }
        }
      }
    }
    logTab.scrollTop = logTab.scrollHeight;
    pending.length = 0;
    scheduled = false;
    if (logHistory.length > 0) {
      persistLogs(logHistory);
    } else {
      persistLogs([]);
    }
  }

  function log(msg: string): void {
    pending.push(msg);
    if (!scheduled) {
      scheduled = true;
      (typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => setTimeout(cb, 16))(flush);
    }
  }

  show('Roster');
  return { log, addEvent, renderRoster };
}

