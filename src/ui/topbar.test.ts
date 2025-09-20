import { beforeEach, describe, expect, it } from 'vitest';
import { setupTopbar } from './topbar.ts';
import { Resource, type GameState } from '../core/GameState.ts';

describe('topbar resource badges', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('shows sauna beer debt with accessible messaging', () => {
    const overlay = document.createElement('div');
    overlay.id = 'ui-overlay';
    document.body.appendChild(overlay);

    const state = {
      getResource: (resource: Resource) =>
        resource === Resource.SAUNA_BEER ? -7 : 0
    } as unknown as GameState;

    const controls = setupTopbar(state);

    try {
      const beerBadge = overlay.querySelector<HTMLDivElement>('.badge-sauna-beer');
      expect(beerBadge).toBeTruthy();
      expect(beerBadge?.querySelector('.badge-value')?.textContent).toBe('-7');
      expect(beerBadge?.classList.contains('topbar-badge--debt')).toBe(true);
      expect(beerBadge?.getAttribute('aria-label')).toBe(
        'Sauna beer reserves -7 — Debt of 7 bottles'
      );
    } finally {
      controls.dispose();
      overlay.remove();
    }
  });
});
