import { GameState } from '../core/GameState.ts';
import { eventBus } from '../events';

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

  const panel = document.createElement('div');
  panel.id = 'right-panel';
  panel.style.position = 'absolute';
  panel.style.top = '0';
  panel.style.right = '0';
  panel.style.width = '240px';
  panel.style.height = '100%';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.background = 'rgba(0,0,0,0.5)';
  panel.style.color = '#fff';

  overlay.appendChild(panel);

  const tabBar = document.createElement('div');
  tabBar.style.display = 'flex';
  panel.appendChild(tabBar);

  const content = document.createElement('div');
  content.style.flex = '1';
  content.style.overflowY = 'auto';
  panel.appendChild(content);

  const policiesTab = document.createElement('div');
  const eventsTab = document.createElement('div');
  const logTab = document.createElement('div');
  logTab.id = 'event-log';
  logTab.style.display = 'flex';
  logTab.style.flexDirection = 'column';

  const tabs: Record<string, HTMLDivElement> = {
    Policies: policiesTab,
    Events: eventsTab,
    Log: logTab
  };

  function show(tab: string): void {
    for (const [name, el] of Object.entries(tabs)) {
      el.style.display = name === tab ? 'block' : 'none';
    }
    for (const btn of tabBar.children) {
      const b = btn as HTMLButtonElement;
      b.disabled = b.textContent === tab;
    }
  }

  for (const name of Object.keys(tabs)) {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.addEventListener('click', () => show(name));
    tabBar.appendChild(btn);
    content.appendChild(tabs[name]);
  }

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
      btn.disabled = !def.prerequisite(state) || state.hasPolicy(def.id);
      btn.addEventListener('click', () => {
        if (state.applyPolicy(def.id, def.cost)) {
          updatePolicyButtons();
        }
      });
      policiesTab.appendChild(btn);
      policiesTab.appendChild(document.createElement('br'));
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
      const h = document.createElement('h4');
      h.textContent = ev.headline;
      const p = document.createElement('p');
      p.textContent = ev.body;
      const btn = document.createElement('button');
      btn.textContent = ev.buttonText ?? 'Acknowledge';
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

