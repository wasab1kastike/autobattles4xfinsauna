import { beforeEach, describe, expect, it } from 'vitest';
import { setupActionBar } from '../../src/ui/action-bar/index.tsx';
import { GameState } from '../../src/core/GameState.ts';

function renderOverlay(): HTMLElement {
  document.body.innerHTML = `
    <div id="ui-overlay">
      <div class="hud-layout-root" data-hud-root>
        <div class="hud-region hud-top-row" data-hud-region="top"></div>
        <div class="hud-region hud-actions" data-hud-region="left"></div>
        <div class="hud-region hud-content" data-hud-region="content"></div>
        <div class="hud-region hud-right-column" data-hud-region="right">
          <div id="resource-bar"></div>
        </div>
        <div class="hud-region hud-bottom-row" data-hud-region="bottom"></div>
      </div>
    </div>
  `;

  const overlay = document.querySelector<HTMLElement>('#ui-overlay');
  if (!overlay) {
    throw new Error('Failed to render UI overlay shell for the action bar test.');
  }
  return overlay;
}

describe('action bar tutorial anchor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('exposes the combat tutorial target so onboarding can anchor correctly', () => {
    const overlay = renderOverlay();
    const state = new GameState(1000);
    const controller = setupActionBar(state, overlay);

    const tray = overlay.querySelector('[data-component="action-bar"]');
    expect(tray).toBeTruthy();
    expect(tray?.dataset.tutorialTarget).toBe('combat');

    controller.destroy();
  });
});
