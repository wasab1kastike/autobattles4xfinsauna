import { beforeEach, describe, expect, it } from 'vitest';

import { HUD_OVERLAY_COLLAPSED_CLASS, ensureHudLayout } from '../../src/ui/layout.ts';

describe('ensureHudLayout', () => {
  let overlay: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="ui-overlay">
        <div id="topbar"></div>
        <div id="build-menu"></div>
        <div id="build-id"></div>
        <button id="right-panel-toggle" type="button"></button>
        <div data-component="action-bar" id="action-bar-mount"></div>
        <div class="hud-mobile-bar">
          <div class="hud-mobile-bar__tray"></div>
        </div>
      </div>
    `;

    overlay = document.querySelector<HTMLElement>('#ui-overlay')!;
  });

  it('preserves the collapsed grid variant and keeps anchors wired', () => {
    const layout = ensureHudLayout(overlay);

    expect(layout.root.classList.contains('hud-layout-root')).toBe(true);

    const topbar = document.querySelector<HTMLElement>('#topbar');
    expect(topbar?.parentElement).toBe(layout.anchors.topLeftCluster);

    const buildMenu = document.querySelector<HTMLElement>('#build-menu');
    expect(buildMenu?.parentElement).toBe(layout.regions.left);

    const buildId = document.querySelector<HTMLElement>('#build-id');
    expect(buildId?.parentElement).toBe(layout.regions.bottom);

    const actionBarMount = document.querySelector<HTMLElement>('[data-component="action-bar"]');
    expect(actionBarMount?.parentElement).toBe(layout.anchors.topLeftCluster);

    const commandToggle = document.querySelector<HTMLElement>('#right-panel-toggle');
    expect(commandToggle?.parentElement).toBe(layout.dock.actions);

    const mobileBar = document.querySelector<HTMLElement>('.hud-mobile-bar');
    expect(mobileBar?.parentElement).toBe(layout.dock.actions);

    expect(layout.tabs.container.parentElement).toBe(layout.dock.tabs);

    overlay.classList.add(HUD_OVERLAY_COLLAPSED_CLASS);

    const layoutAgain = ensureHudLayout(overlay);

    expect(layoutAgain.root).toBe(layout.root);
    expect(overlay.classList.contains(HUD_OVERLAY_COLLAPSED_CLASS)).toBe(true);
    expect(overlay.classList.contains('hud-grid')).toBe(true);
    expect(overlay.classList.contains('grid')).toBe(true);
  });
});
