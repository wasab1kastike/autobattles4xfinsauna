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
    return { setActive: () => {}, dispose: () => {} } satisfies HudNavigationController;
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

  const items = doc.createElement('div');
  items.className = 'hud-nav-toolbar__items';
  toolbar.appendChild(items);

  const buttons = new Map<HudNavigationView, HTMLButtonElement>();

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
    }
    if (emit && changed) {
      options.onNavigate?.(next);
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

  topLeftCluster.appendChild(toolbar);

  applyActive(activeView);

  return {
    setActive(view) {
      if (!buttons.has(view)) {
        return;
      }
      applyActive(view);
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

