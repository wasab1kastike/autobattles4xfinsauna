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
}> = [
  {
    id: 'roster',
    label: 'Roster',
    description: 'Command your attendants'
  },
  {
    id: 'policies',
    label: 'Policies',
    description: 'Shape sauna doctrine'
  },
  {
    id: 'events',
    label: 'Events',
    description: 'Review incoming briefings'
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
  const { left } = layout.regions;
  const doc = overlay.ownerDocument ?? document;

  const existingNav = overlay.querySelector<HTMLElement>('[data-hud-navigation]');
  existingNav?.remove();

  const navCard = doc.createElement('nav');
  navCard.dataset.hudNavigation = 'true';
  navCard.className = 'hud-card hud-nav';
  navCard.setAttribute('aria-label', 'Command console views');

  const stack = doc.createElement('div');
  stack.className = 'hud-nav__stack';
  navCard.appendChild(stack);

  const buttons = new Map<HudNavigationView, HTMLButtonElement>();

  const listeners: Array<() => void> = [];

  let activeView: HudNavigationView = options.initialView ?? 'roster';

  const applyActive = (next: HudNavigationView, { emit } = { emit: false }) => {
    const changed = activeView !== next;
    activeView = next;
    navCard.dataset.activeView = next;
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
    button.className = 'hud-nav__button';
    button.dataset.hudNavItem = item.id;

    const label = doc.createElement('span');
    label.className = 'hud-nav__label';
    label.textContent = item.label;

    const copy = doc.createElement('span');
    copy.className = 'hud-nav__description';
    copy.textContent = item.description;

    button.append(label, copy);

    const handleClick = () => {
      applyActive(item.id, { emit: true });
    };
    button.addEventListener('click', handleClick);
    listeners.push(() => button.removeEventListener('click', handleClick));

    buttons.set(item.id, button);
    stack.appendChild(button);
  }

  left.appendChild(navCard);

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
      navCard.remove();
      buttons.clear();
    }
  } satisfies HudNavigationController;
}

