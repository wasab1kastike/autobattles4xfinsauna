import { createRoot, type Root } from 'react-dom/client';
import type { GameState } from '../../core/GameState.ts';
import { ensureHudLayout } from '../layout.ts';
import { ActionBar, type ActionBarAbilityHandlers } from './ActionBar.tsx';

export interface ActionBarController {
  destroy(): void;
}

export function setupActionBar(
  state: GameState,
  overlay: HTMLElement,
  abilities: ActionBarAbilityHandlers = {},
): ActionBarController {
  const layout = ensureHudLayout(overlay);
  const container = overlay.ownerDocument.createElement('div');
  container.dataset.component = 'action-bar';
  container.dataset.tutorialTarget = 'combat';
  container.className = 'flex w-full justify-center';

  const bottomRegion = layout.regions.bottom;
  const buildId = bottomRegion.querySelector<HTMLElement>('#build-id');
  if (buildId) {
    bottomRegion.insertBefore(container, buildId);
  } else {
    bottomRegion.appendChild(container);
  }

  const root: Root = createRoot(container);
  root.render(<ActionBar state={state} abilities={abilities} />);

  return {
    destroy() {
      root.unmount();
      container.remove();
    },
  } satisfies ActionBarController;
}

export type { ActionBarAbilityHandlers } from './ActionBar.tsx';
