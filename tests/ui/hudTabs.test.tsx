import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureHudLayout, type HudBottomTabId } from '../../src/ui/layout.ts';

describe('HUD bottom tabs', () => {
  let overlay: HTMLDivElement;

  beforeEach(() => {
    overlay = document.createElement('div');
    overlay.id = 'ui-overlay';
    document.body.appendChild(overlay);
  });

  afterEach(() => {
    overlay.remove();
  });

  it('creates roster, stash, and policies panels with roster active by default', () => {
    const layout = ensureHudLayout(overlay);
    const { tabs } = layout;

    expect(tabs.panels.roster.dataset.hudTabPanel).toBe('roster');
    expect(tabs.panels.stash.dataset.hudTabPanel).toBe('stash');
    expect(tabs.panels.policies.dataset.hudTabPanel).toBe('policies');

    expect(tabs.panels.roster.hidden).toBe(false);
    expect(tabs.panels.stash.hidden).toBe(true);

    tabs.setActive('stash');

    expect(tabs.panels.stash.hidden).toBe(false);
    expect(tabs.panels.roster.hidden).toBe(true);
    expect(tabs.panels.policies.hidden).toBe(true);
  });

  it('sets badges and emits change notifications', () => {
    const { tabs } = ensureHudLayout(overlay);
    const stashTab = overlay.querySelector<HTMLButtonElement>('[data-hud-tab="stash"]');
    expect(stashTab).not.toBeNull();

    tabs.setBadge('stash', 12);
    expect(stashTab?.getAttribute('data-badge')).toBe('12');

    const received: HudBottomTabId[] = [];
    const unsubscribe = tabs.onChange((id) => {
      received.push(id);
    });

    tabs.setActive('policies');
    tabs.setActive('roster');

    unsubscribe();

    expect(received).toEqual(['policies', 'roster']);
  });
});
