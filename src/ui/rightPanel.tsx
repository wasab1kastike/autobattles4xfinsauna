import { GameState } from '../core/GameState.ts';
import { eventBus } from '../events';
import { ensureHudLayout } from './layout.ts';

export type GameEvent = {
  id: string;
  headline: string;
  body: string;
  buttonText?: string;
};

export function setupRightPanel(state: GameState): {
  log: (msg: string) => void;
  addEvent: (ev: GameEvent) => void;
} {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) {
    return { log: () => {}, addEvent: () => {} };
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
  panel.setAttribute('aria-label', 'Policies and events');

  const tabBar = document.createElement('div');
  tabBar.classList.add('panel-tabs');
  panel.appendChild(tabBar);

  const content = document.createElement('div');
  content.classList.add('panel-content');
  panel.appendChild(content);

  const policiesTab = document.createElement('div');
  policiesTab.id = 'right-panel-policies';
  const eventsTab = document.createElement('div');
  eventsTab.id = 'right-panel-events';
  const logTab = document.createElement('div');
  logTab.id = 'event-log';
  logTab.setAttribute('role', 'log');
  logTab.setAttribute('aria-live', 'polite');

  const tabs: Record<string, HTMLDivElement> = {
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

  // --- Policies ---
  type PolicyDef = {
    id: string;
    name: string;
    description: string;
    cost: number;
    prerequisite: (s: GameState) => boolean;
  };

  const policyDefs: PolicyDef[] = [
    {
      id: 'eco',
      name: 'Eco Policy',
      description: 'Increase gold income by 1',
      cost: 15,
      prerequisite: () => true
    },
    {
      id: 'temperance',
      name: 'Temperance',
      description: '+5% work speed at night',
      cost: 25,
      prerequisite: () => true
    }
  ];

  const policyButtons: Record<string, HTMLButtonElement> = {};

  function renderPolicies(): void {
    policiesTab.innerHTML = '';
    for (const def of policyDefs) {
      const btn = document.createElement('button');
      btn.textContent = `${def.name} (${def.cost}g)`;
      btn.title = def.description;
      btn.classList.add('panel-action');
      btn.disabled = !def.prerequisite(state) || state.hasPolicy(def.id);
      btn.addEventListener('click', () => {
        if (state.applyPolicy(def.id, def.cost)) {
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
        btn.disabled = !def.prerequisite(state) || state.hasPolicy(def.id);
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

  show('Policies');
  return { log, addEvent };
}

