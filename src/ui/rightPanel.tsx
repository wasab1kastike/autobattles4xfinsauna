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
  status: string;
  hp: number;
  maxHp: number;
  vitalityPercent: number;
  upkeep: number;
  traits: string[];
  selected: boolean;
  active: boolean;
};

export type RightPanelControls = {
  log: (msg: string) => void;
  addEvent: (ev: GameEvent) => void;
  setRoster: (roster: RosterEntry[]) => void;
};

export function setupRightPanel(state: GameState): RightPanelControls {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) {
    return { log: () => {}, addEvent: () => {}, setRoster: () => {} };
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
  panel.setAttribute('aria-label', 'Command board with roster, policies, and events');

  const tabBar = document.createElement('div');
  tabBar.classList.add('panel-tabs');
  panel.appendChild(tabBar);

  const content = document.createElement('div');
  content.classList.add('panel-content');
  panel.appendChild(content);

  const rosterTab = document.createElement('div');
  rosterTab.id = 'right-panel-roster';
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

  for (const [name, section] of Object.entries(tabs)) {
    section.classList.add('panel-section', 'panel-section--scroll');
    section.dataset.tab = name;
    section.hidden = true;
  }
  logTab.classList.add('panel-section--log');

  const rosterList = document.createElement('div');
  rosterList.classList.add('panel-roster');
  rosterTab.appendChild(rosterList);

  let roster: RosterEntry[] = [];

  function renderRoster(): void {
    rosterList.replaceChildren();

    if (roster.length === 0) {
      const empty = document.createElement('p');
      empty.classList.add('panel-roster__empty');
      empty.textContent = 'No attendants are currently mustered.';
      rosterList.appendChild(empty);
      return;
    }

    for (const entry of roster) {
      const unit = document.createElement('article');
      unit.classList.add('panel-roster__unit');
      unit.setAttribute('data-unit-id', entry.id);
      unit.setAttribute('aria-label', `${entry.name}: ${entry.status}`);
      if (entry.active) {
        unit.classList.add('is-active');
      }
      if (entry.selected) {
        unit.classList.add('is-selected');
      }

      const header = document.createElement('header');
      header.classList.add('panel-roster__header');

      const title = document.createElement('h4');
      title.textContent = entry.name;
      title.classList.add('panel-roster__name');
      header.appendChild(title);

      const status = document.createElement('span');
      status.textContent = entry.status;
      status.classList.add('panel-roster__status');
      status.title = entry.status;
      header.appendChild(status);

      unit.appendChild(header);

      const meter = document.createElement('div');
      meter.classList.add('panel-roster__health');
      meter.setAttribute('role', 'progressbar');
      meter.setAttribute('aria-valuemin', '0');
      meter.setAttribute('aria-valuemax', String(entry.maxHp));
      meter.setAttribute('aria-valuenow', String(entry.hp));
      meter.setAttribute('aria-valuetext', `${entry.hp} of ${entry.maxHp} health`);

      const meterFill = document.createElement('div');
      meterFill.classList.add('panel-roster__health-fill');
      meterFill.style.width = `${Math.max(0, Math.min(100, entry.vitalityPercent))}%`;
      meter.appendChild(meterFill);
      unit.appendChild(meter);

      const metrics = document.createElement('div');
      metrics.classList.add('panel-roster__metrics');

      const hpLabel = document.createElement('span');
      hpLabel.classList.add('panel-roster__metric');
      hpLabel.textContent = `HP ${entry.hp}/${entry.maxHp}`;
      metrics.appendChild(hpLabel);

      const upkeep = document.createElement('span');
      upkeep.classList.add('panel-roster__metric');
      upkeep.textContent = `Upkeep ${entry.upkeep}`;
      metrics.appendChild(upkeep);

      unit.appendChild(metrics);

      const traitList = document.createElement('ul');
      traitList.classList.add('panel-roster__traits');

      if (entry.traits.length === 0) {
        const item = document.createElement('li');
        item.classList.add('panel-roster__trait', 'is-empty');
        item.textContent = 'No notable traits yet';
        traitList.appendChild(item);
      } else {
        for (const trait of entry.traits) {
          const item = document.createElement('li');
          item.classList.add('panel-roster__trait');
          item.textContent = trait;
          traitList.appendChild(item);
        }
      }

      unit.appendChild(traitList);
      rosterList.appendChild(unit);
    }
  }

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

  function setRoster(next: RosterEntry[]): void {
    roster = next;
    renderRoster();
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

  const numberFormatter = new Intl.NumberFormat('en-US');

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
  renderRoster();

  return { log, addEvent, setRoster };
}

