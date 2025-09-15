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
  mount?: HTMLElement
): { log: (msg: string) => void; addEvent: (ev: GameEvent) => void } {
  const container = mount ?? document.getElementById('right-panel');
  if (!container) {
    return { log: () => {}, addEvent: () => {} };
  }

  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.background = 'rgba(0,0,0,0.5)';
  container.style.color = '#fff';
  container.style.height = '100%';

  const tablist = document.createElement('div');
  tablist.setAttribute('role', 'tablist');
  container.appendChild(tablist);

  const content = document.createElement('div');
  content.style.flex = '1';
  content.style.overflowY = 'auto';
  container.appendChild(content);

  const panels: Record<string, HTMLDivElement> = {
    Policies: document.createElement('div'),
    Events: document.createElement('div'),
    Log: document.createElement('div')
  };

  panels.Log.id = 'event-log';
  panels.Log.style.display = 'flex';
  panels.Log.style.flexDirection = 'column';

  const tabs: Record<string, HTMLButtonElement> = {};
  const order = Object.keys(panels);

  function show(name: string): void {
    for (const key of order) {
      const selected = key === name;
      panels[key].hidden = !selected;
      panels[key].setAttribute('role', 'tabpanel');
      panels[key].setAttribute('aria-selected', selected ? 'true' : 'false');
      tabs[key].setAttribute('aria-selected', selected ? 'true' : 'false');
    }
  }

  for (const name of order) {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.setAttribute('role', 'tab');
    btn.addEventListener('click', () => show(name));
    tablist.appendChild(btn);
    tabs[name] = btn;
    content.appendChild(panels[name]);
  }

  tablist.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const current = order.findIndex((n) => tabs[n] === document.activeElement);
    let next = current;
    if (e.key === 'ArrowRight') {
      next = (current + 1) % order.length;
    } else if (e.key === 'ArrowLeft') {
      next = (current - 1 + order.length) % order.length;
    }
    const nextName = order[next];
    tabs[nextName].focus();
    show(nextName);
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
    const root = panels.Policies;
    root.innerHTML = '';
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
      root.appendChild(btn);
      root.appendChild(document.createElement('br'));
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
    const root = panels.Events;
    root.innerHTML = '';
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
      root.appendChild(wrapper);
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
      panels.Log.appendChild(div);
    }
    while (panels.Log.childElementCount > MAX_LOG_MESSAGES) {
      panels.Log.removeChild(panels.Log.firstChild!);
    }
    panels.Log.scrollTop = panels.Log.scrollHeight;
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
