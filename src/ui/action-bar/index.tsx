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
  container.className = 'hud-command-tray';

  const commandDock = layout.anchors.commandDock;
  commandDock.appendChild(container);

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
