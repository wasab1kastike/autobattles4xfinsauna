import { GameState } from '../core/GameState.ts';
import { eventBus } from '../events';

export type GameEvent = {
  id: string;
  headline: string;
  body: string;
  buttonText?: string;
};

export function setupRightPanel(
  state: GameState,
  parent: HTMLElement
): {
  log: (msg: string) => void;
  addEvent: (ev: GameEvent) => void;
} {
  const panel = document.createElement('div');
  panel.id = 'right-panel';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.background = 'rgba(0,0,0,0.5)';
  panel.style.color = '#fff';
  panel.style.height = '100%';
  parent.appendChild(panel);

  const tabBar = document.createElement('div');
  tabBar.setAttribute('role', 'tablist');
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
  const tabNames = Object.keys(tabs);
  let current = 0;

  function show(index: number): void {
    current = index;
    tabNames.forEach((name, i) => {
      const el = tabs[name];
      const selected = i === index;
      el.style.display = selected
        ? el === logTab
          ? 'flex'
          : 'block'
        : 'none';
      el.setAttribute('role', 'tabpanel');
      el.setAttribute('aria-selected', String(selected));
      const btn = tabBar.children[i] as HTMLButtonElement;
      btn.disabled = selected;
      btn.tabIndex = selected ? 0 : -1;
    });
  }

  tabNames.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.setAttribute('role', 'tab');
    btn.tabIndex = i === 0 ? 0 : -1;
    btn.addEventListener('click', () => show(i));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const next = (i + dir + tabNames.length) % tabNames.length;
        show(next);
        (tabBar.children[next] as HTMLButtonElement).focus();
      }
    });
    tabBar.appendChild(btn);
    const panelEl = tabs[name];
    panelEl.setAttribute('role', 'tabpanel');
    panelEl.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    content.appendChild(panelEl);
  });

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

  show(0);
  return { log, addEvent };
}

