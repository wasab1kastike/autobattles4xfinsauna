import { beforeEach, describe, expect, it, vi } from 'vitest';
const artocoinListeners: Array<(event: { balance: number; delta: number; reason: string }) => void> = [];
let mockArtocoinBalance = 120;

vi.mock('../progression/artocoin.ts', () => ({
  loadArtocoinBalance: vi.fn(() => mockArtocoinBalance),
  onArtocoinChange: vi.fn((listener: (event: { balance: number; delta: number; reason: string }) => void) => {
    artocoinListeners.push(listener);
    return () => {
      const index = artocoinListeners.indexOf(listener);
      if (index !== -1) {
        artocoinListeners.splice(index, 1);
      }
    };
  })
}));
import { setupTopbar } from './topbar.ts';
import { Resource, type GameState } from '../core/GameState.ts';

describe('topbar resource badges', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    artocoinListeners.length = 0;
    mockArtocoinBalance = 120;
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

  it('renders artocoin balance and updates on change', () => {
    const overlay = document.createElement('div');
    overlay.id = 'ui-overlay';
    document.body.appendChild(overlay);

    const state = {
      getResource: () => 0
    } as unknown as GameState;

    const controls = setupTopbar(state, { artocoin: 'icon.svg' });

    try {
      const artBadge = overlay.querySelector<HTMLDivElement>('.badge-artocoin');
      expect(artBadge).toBeTruthy();
      expect(artBadge?.querySelector('.badge-value')?.textContent).toBe('120');
      artocoinListeners.forEach((listener) =>
        listener({ balance: 175, delta: 55, reason: 'payout' })
      );
      expect(artBadge?.querySelector('.badge-value')?.textContent).toBe('175');
      expect(artBadge?.querySelector('.badge-delta')?.textContent).toBe('+55 Ⓐ');
    } finally {
      controls.dispose();
      overlay.remove();
    }
  });
});
