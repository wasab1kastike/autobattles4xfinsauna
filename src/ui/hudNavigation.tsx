import rosterIconUrl from '../../assets/ui/hud-roster.svg';
import policiesIconUrl from '../../assets/ui/hud-policies.svg';
import eventsIconUrl from '../../assets/ui/hud-events.svg';
import { ensureHudLayout } from './layout.ts';

export type HudNavigationView = 'roster' | 'policies' | 'events';

type HudNavigationOptions = {
  onNavigate?: (view: HudNavigationView) => void;
  initialView?: HudNavigationView;
};

type HudNavigationController = {
  setActive(view: HudNavigationView): void;
  getActive(): HudNavigationView;
  focus(view: HudNavigationView): void;
  dispose(): void;
};

const NAVIGATION_ITEMS: Array<{
  id: HudNavigationView;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    id: 'roster',
    label: 'Roster',
    description: 'Command your attendants',
    icon: rosterIconUrl
  },
  {
    id: 'policies',
    label: 'Policies',
    description: 'Shape sauna doctrine',
    icon: policiesIconUrl
  },
  {
    id: 'events',
    label: 'Events',
    description: 'Review incoming briefings',
    icon: eventsIconUrl
  }
];

export function setupHudNavigation(
  overlay: HTMLElement | null,
  options: HudNavigationOptions = {}
): HudNavigationController {
  if (!overlay) {
    return {
      setActive: () => {},
      getActive: () => 'roster',
      focus: () => {},
      dispose: () => {}
    } satisfies HudNavigationController;
  }

  const layout = ensureHudLayout(overlay);
  const { topLeftCluster } = layout.anchors;
  const doc = overlay.ownerDocument ?? document;

  const existingNav = overlay.querySelector<HTMLElement>('[data-hud-navigation]');
  existingNav?.remove();

  const toolbar = doc.createElement('nav');
  toolbar.dataset.hudNavigation = 'true';
  toolbar.className = 'hud-nav-toolbar';
  toolbar.setAttribute('aria-label', 'Command console views');
  toolbar.setAttribute('role', 'toolbar');

  const items = doc.createElement('div');
  items.className = 'hud-nav-toolbar__items';
  toolbar.appendChild(items);

  const buttons = new Map<HudNavigationView, HTMLButtonElement>();
  const order = NAVIGATION_ITEMS.map((item) => item.id);

  const listeners: Array<() => void> = [];

  let activeView: HudNavigationView = options.initialView ?? 'roster';

  const applyActive = (next: HudNavigationView, { emit } = { emit: false }) => {
    const changed = activeView !== next;
    activeView = next;
    toolbar.dataset.activeView = next;
    for (const [view, button] of buttons.entries()) {
      const isActive = view === next;
      button.dataset.active = isActive ? 'true' : 'false';
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      button.tabIndex = isActive ? 0 : -1;
    }
    if (emit && changed) {
      options.onNavigate?.(next);
    }
  };

  const focusView = (view: HudNavigationView) => {
    const button = buttons.get(view);
    if (button) {
      button.focus({ preventScroll: true });
    }
  };

  for (const item of NAVIGATION_ITEMS) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'hud-nav-toolbar__button';
    button.dataset.hudNavItem = item.id;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `${item.label} – ${item.description}`);
    button.title = `${item.label} view`;
    button.tabIndex = -1;

    const badge = doc.createElement('span');
    badge.className = 'hud-nav-toolbar__badge';
    badge.setAttribute('aria-hidden', 'true');

    const icon = doc.createElement('img');
    icon.src = item.icon;
    icon.alt = '';
    icon.decoding = 'async';
    icon.loading = 'lazy';
    icon.draggable = false;
    icon.className = 'hud-nav-toolbar__icon';
    badge.appendChild(icon);

    const label = doc.createElement('span');
    label.className = 'sr-only';
    label.textContent = `${item.label} – ${item.description}`;

    button.append(badge, label);

    const handleClick = () => {
      applyActive(item.id, { emit: true });
    };
    button.addEventListener('click', handleClick);
    listeners.push(() => button.removeEventListener('click', handleClick));

    buttons.set(item.id, button);
    items.appendChild(button);
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target || !target.hasAttribute('data-hud-nav-item')) {
      return;
    }

    const view = target.getAttribute('data-hud-nav-item') as HudNavigationView | null;
    if (!view) {
      return;
    }

    const currentIndex = order.indexOf(view);
    if (currentIndex === -1) {
      return;
    }

    let nextIndex: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % order.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + order.length) % order.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = order.length - 1;
        break;
      default:
        break;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();

    const nextView = order[nextIndex];
    applyActive(nextView, { emit: true });
    focusView(nextView);
  };

  toolbar.addEventListener('keydown', handleKeyDown);
  listeners.push(() => toolbar.removeEventListener('keydown', handleKeyDown));

  const findCommandAnchor = (): HTMLElement | null => {
    const selectors = [
      '[data-ui="inventory-shop-toggle"]',
      '[data-ui="inventory-toggle"]',
      '[data-component="action-bar"]',
    ];
    for (const selector of selectors) {
      const candidate = topLeftCluster.querySelector<HTMLElement>(selector);
      if (candidate && candidate.parentElement === topLeftCluster) {
        return candidate;
      }
    }
    return null;
  };

  const commandAnchor = findCommandAnchor();
  if (commandAnchor) {
    // Position the navigation above the stacked command controls so the tray cascades naturally.
    topLeftCluster.insertBefore(toolbar, commandAnchor);
  } else {
    topLeftCluster.appendChild(toolbar);
  }

  applyActive(activeView);

  return {
    setActive(view) {
      if (!buttons.has(view)) {
        return;
      }
      applyActive(view);
    },
    getActive() {
      return activeView;
    },
    focus(view) {
      focusView(view);
    },
    dispose() {
      for (const cleanup of listeners) {
        cleanup();
      }
      toolbar.remove();
      buttons.clear();
    }
  } satisfies HudNavigationController;
}

