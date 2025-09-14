import type { GameState } from '../core/GameState';
import { eventBus } from '../events';
import { Resource as ResEnum } from '../core/GameState';

// Event representation
interface GameEvent {
  id: number;
  headline: string;
  body: string;
  button: string;
}

export function setupRightPanel(state: GameState) {
  const overlay = document.getElementById('ui-overlay');
  const existingLog = document.getElementById('event-log');

  let eventLog: HTMLElement;
  let panel: HTMLElement | null = null;

  if (overlay) {
    panel = document.createElement('div');
    panel.id = 'right-panel';
    overlay.appendChild(panel);

    const tabs = document.createElement('div');
    tabs.className = 'tabs';
    panel.appendChild(tabs);

    const content = document.createElement('div');
    content.className = 'tab-content';
    panel.appendChild(content);

    const logTab = document.createElement('button');
    logTab.textContent = 'Log';
    const eventsTabBtn = document.createElement('button');
    eventsTabBtn.textContent = 'Events';
    const policiesTabBtn = document.createElement('button');
    policiesTabBtn.textContent = 'Policies';

    tabs.appendChild(policiesTabBtn);
    tabs.appendChild(eventsTabBtn);
    tabs.appendChild(logTab);

    // containers
    const policiesContainer = document.createElement('div');
    const eventsContainer = document.createElement('div');
    const logContainer = document.createElement('div');
    logContainer.id = 'event-log';
    content.appendChild(policiesContainer);
    content.appendChild(eventsContainer);
    content.appendChild(logContainer);

    const switchTab = (tab: HTMLElement) => {
      policiesContainer.style.display = 'none';
      eventsContainer.style.display = 'none';
      logContainer.style.display = 'none';
      tab.style.display = 'block';
    };
    policiesTabBtn.addEventListener('click', () => switchTab(policiesContainer));
    eventsTabBtn.addEventListener('click', () => switchTab(eventsContainer));
    logTab.addEventListener('click', () => switchTab(logContainer));
    switchTab(policiesContainer);

    eventLog = logContainer;

    // Policies
    const policies = [
      {
        id: 'eco',
        name: 'Eco Policy',
        desc: '+1 gold generation',
        cost: 15,
        prereq: () => !state.hasPolicy('eco'),
        apply: () => state.applyPolicy('eco', 15)
      },
      {
        id: 'temperance',
        name: 'Temperance',
        desc: '+5% work speed at night',
        cost: 20,
        prereq: () => state.hasPolicy('eco') && !state.hasPolicy('temperance'),
        apply: () => state.applyPolicy('temperance', 20)
      }
    ];

    const policyButtons: Record<string, HTMLButtonElement> = {};

    const updatePolicies = () => {
      policies.forEach((p) => {
        const btn = policyButtons[p.id];
        btn.disabled = !p.prereq() || state.getResource(ResEnum.GOLD) < p.cost;
      });
    };

    policies.forEach((p) => {
      const btn = document.createElement('button');
      btn.textContent = `${p.name} (${p.desc})`;
      btn.addEventListener('click', () => {
        if (p.apply()) updatePolicies();
      });
      policiesContainer.appendChild(btn);
      policyButtons[p.id] = btn;
    });

    updatePolicies();
    eventBus.on('resourceChanged', updatePolicies);
    eventBus.on('policyApplied', updatePolicies);

    // Events
    const events: GameEvent[] = [];
    let nextId = 1;

    const renderEvents = () => {
      eventsContainer.innerHTML = '';
      events.forEach((ev) => {
        const card = document.createElement('div');
        const h = document.createElement('h4');
        h.textContent = ev.headline;
        const b = document.createElement('p');
        b.textContent = ev.body;
        const btn = document.createElement('button');
        btn.textContent = ev.button;
        btn.addEventListener('click', () => {
          const idx = events.findIndex((e) => e.id === ev.id);
          if (idx !== -1) {
            events.splice(idx, 1);
            renderEvents();
          }
        });
        card.appendChild(h);
        card.appendChild(b);
        card.appendChild(btn);
        eventsContainer.appendChild(card);
      });
    };

    const addEvent = (headline: string, body: string, button = 'Acknowledge') => {
      events.push({ id: nextId++, headline, body, button });
      renderEvents();
    };

    return { log: createLogger(logContainer), addEvent };
  }

  // Fallback for tests or missing overlay
  eventLog = existingLog || document.createElement('div');
  if (!existingLog) {
    document.body.appendChild(eventLog);
  }
  return { log: createLogger(eventLog), addEvent: () => {} };
}

// Logging with batching and auto-scroll
function createLogger(container: HTMLElement) {
  const buffer: string[] = [];
  let flushing = false;
  const flush = () => {
    buffer.forEach((msg) => {
      const div = document.createElement('div');
      div.textContent = msg;
      container.appendChild(div);
      while (container.childElementCount > 100) {
        container.removeChild(container.firstChild!);
      }
    });
    container.scrollTop = container.scrollHeight;
    buffer.length = 0;
    flushing = false;
  };
  const schedule = () => {
    if (flushing) return;
    flushing = true;
    (typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb: FrameRequestCallback) => setTimeout(cb, 16))(flush);
  };
  const log = (msg: string) => {
    buffer.push(msg);
    schedule();
  };
  (log as any).flush = flush;
  return log as typeof log & { flush: () => void };
}
