import { GameState, Resource } from '../core/GameState.ts';
import { eventBus } from '../events';
import { ensureHudLayout } from './layout.ts';

export type GameEvent = {
  id: string;
  headline: string;
  body: string;
  buttonText?: string;
};

export type RosterEntry = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  upkeep: number;
  status: 'engaged' | 'reserve' | 'downed';
  selected: boolean;
  traits: string[];
};

type RightPanelOptions = {
  onRosterSelect?: (unitId: string) => void;
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

  const { side } = ensureHudLayout(overlay);

  const existingPanel = overlay.querySelector<HTMLDivElement>('#right-panel');
  if (existingPanel) {
    existingPanel.remove();
  }

  const panel = document.createElement('div');
  panel.id = 'right-panel';
  panel.classList.add('hud-card');
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'Sauna command console');

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

  const { onRosterSelect } = options;
  const numberFormatter = new Intl.NumberFormat('en-US');
  const rosterCountFormatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0
  });
  const rosterStatusLabels: Record<RosterEntry['status'], string> = {
    engaged: 'Engaged on the field',
    reserve: 'On reserve duty',
    downed: 'Recovering from battle'
  };

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
  const rosterTitleId = 'panel-roster-title';

  function buildMetric(label: string, value: number, status: RosterEntry['status']): HTMLSpanElement {
    const metric = document.createElement('span');
    metric.classList.add('panel-roster__metric');
    metric.dataset.status = status;
    metric.textContent = `${rosterCountFormatter.format(value)} ${label}`;
    metric.setAttribute('aria-label', `${rosterCountFormatter.format(value)} ${label}`);
    return metric;
  }

  function renderRoster(entries: RosterEntry[]): void {
    rosterTab.innerHTML = '';
    rosterTab.dataset.count = String(entries.length);
    rosterTab.classList.add('panel-roster');

    const header = document.createElement('div');
    header.classList.add('panel-roster__header');

    const heading = document.createElement('h4');
    heading.classList.add('panel-roster__title');
    heading.textContent = 'Battalion Roster';
    heading.id = rosterTitleId;
    header.appendChild(heading);

    rosterTab.setAttribute('aria-labelledby', rosterTitleId);

    const totalLabel = entries.length === 0
      ? 'No attendants mustered yet'
      : `${rosterCountFormatter.format(entries.length)} attendant${entries.length === 1 ? '' : 's'} enlisted`;
    const count = document.createElement('span');
    count.classList.add('panel-roster__count');
    count.textContent = totalLabel;
    header.appendChild(count);

    rosterTab.appendChild(header);

    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.classList.add('panel-roster__empty');
      empty.textContent = 'No attendants have rallied to the sauna yet.';
      rosterTab.appendChild(empty);
      return;
    }

    const engaged = entries.filter((entry) => entry.status === 'engaged').length;
    const reserve = entries.filter((entry) => entry.status === 'reserve').length;
    const downed = entries.filter((entry) => entry.status === 'downed').length;

    const metrics = document.createElement('div');
    metrics.classList.add('panel-roster__metrics');
    metrics.append(
      buildMetric('engaged', engaged, 'engaged'),
      buildMetric('reserve', reserve, 'reserve'),
      buildMetric('downed', downed, 'downed')
    );
    rosterTab.appendChild(metrics);

    const list = document.createElement('ul');
    list.classList.add('panel-roster__list');
    list.setAttribute('role', 'list');

    for (const entry of entries) {
      const item = document.createElement('li');
      item.classList.add('panel-roster__row');

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.classList.add('panel-roster__item');
      btn.dataset.unitId = entry.id;
      btn.dataset.status = entry.status;
      btn.setAttribute('aria-pressed', entry.selected ? 'true' : 'false');
      btn.setAttribute(
        'aria-label',
        `${entry.name}, ${rosterStatusLabels[entry.status]}, health ${entry.hp} of ${entry.maxHp}`
      );
      btn.title = `${entry.name} • ${rosterStatusLabels[entry.status]}`;
      if (entry.selected) {
        btn.classList.add('is-selected');
      }
      if (entry.status === 'downed') {
        btn.classList.add('is-downed');
      }
      if (typeof onRosterSelect === 'function') {
        btn.addEventListener('click', () => onRosterSelect(entry.id));
      }

      const nameRow = document.createElement('div');
      nameRow.classList.add('panel-roster__name-row');

      const nameSpan = document.createElement('span');
      nameSpan.classList.add('panel-roster__name');
      nameSpan.textContent = entry.name;
      nameSpan.title = entry.name;
      nameRow.appendChild(nameSpan);

      const statusBadge = document.createElement('span');
      statusBadge.classList.add('panel-roster__status');
      statusBadge.dataset.status = entry.status;
      statusBadge.textContent = rosterStatusLabels[entry.status];
      nameRow.appendChild(statusBadge);

      const meta = document.createElement('div');
      meta.classList.add('panel-roster__meta');
      meta.textContent = `HP ${entry.hp}/${entry.maxHp} • Upkeep ${entry.upkeep} beer`;
      meta.title = `Health ${entry.hp} of ${entry.maxHp}. Upkeep ${entry.upkeep} sauna beer.`;

      const healthBar = document.createElement('div');
      healthBar.classList.add('panel-roster__health');
      const healthFill = document.createElement('div');
      healthFill.classList.add('panel-roster__health-fill');
      const percent = entry.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((entry.hp / entry.maxHp) * 100))) : 0;
      healthFill.style.width = `${percent}%`;
      healthFill.dataset.percent = `${percent}`;
      healthBar.appendChild(healthFill);

      const traitsLine = document.createElement('div');
      traitsLine.classList.add('panel-roster__traits');
      const traitLabel = entry.traits.length > 0 ? entry.traits.join(' • ') : 'No defining traits yet';
      traitsLine.textContent = traitLabel;
      traitsLine.title = traitLabel;

      btn.append(nameRow, meta, healthBar, traitsLine);
      item.appendChild(btn);
      list.appendChild(item);
    }

    rosterTab.appendChild(list);
  }

  renderRoster([]);

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
  const MAX_LOG_MESSAGES = 100;
  const pending: string[] = [];
  let scheduled = false;

  function flush(): void {
    for (const msg of pending) {
      const div = document.createElement('div');
      div.textContent = msg;
      div.classList.add('panel-log-entry');
      logTab.appendChild(div);
    }
    while (logTab.childElementCount > MAX_LOG_MESSAGES) {
      logTab.removeChild(logTab.firstChild!);
    }
    logTab.scrollTop = logTab.scrollHeight;
    pending.length = 0;
    scheduled = false;
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

