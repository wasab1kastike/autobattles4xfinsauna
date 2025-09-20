import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupInventoryHud } from './inventoryHud.ts';
import type { InventoryEvent, InventoryState } from '../inventory/state.ts';
import type { StashPanelController } from './stash/StashPanel.tsx';

const focusMock = vi.fn();
const setOpenMock = vi.fn();
const renderMock = vi.fn();
const destroyMock = vi.fn();

let stashPanel: StashPanelController;

vi.mock('./stash/StashPanel.tsx', () => {
  return {
    createStashPanel: vi.fn(() => stashPanel)
  };
});

describe('setupInventoryHud', () => {
  let overlay: HTMLElement;

  beforeEach(() => {
    overlay = document.createElement('div');
    overlay.id = 'ui-overlay';
    document.body.appendChild(overlay);

    focusMock.mockReset();
    setOpenMock.mockReset();
    renderMock.mockReset();
    destroyMock.mockReset();

    stashPanel = {
      element: document.createElement('div'),
      render: renderMock,
      setOpen: setOpenMock,
      focus: focusMock,
      destroy: destroyMock
    } satisfies StashPanelController;
  });

  afterEach(() => {
    overlay.remove();
  });

  it('keeps the overlay interactive when focusing the panel throws', () => {
    focusMock.mockImplementation(() => {
      throw new Error('focus failed');
    });

    const listeners = new Set<(event: InventoryEvent) => void>();

    const inventory = {
      isAutoEquipEnabled: () => false,
      getStash: () => [],
      getInventory: () => [],
      equipFromStash: vi.fn(),
      equipFromInventory: vi.fn(),
      moveToInventory: vi.fn(),
      moveToStash: vi.fn(),
      discardFromStash: vi.fn(),
      discardFromInventory: vi.fn(),
      on: (listener: (event: InventoryEvent) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    } as unknown as InventoryState;

    const hud = setupInventoryHud(inventory);

    const badge = overlay.querySelector<HTMLButtonElement>('.inventory-badge');
    expect(badge).not.toBeNull();

    badge!.click();

    expect(setOpenMock).toHaveBeenCalledWith(true);
    expect(overlay.classList.contains('inventory-panel-open')).toBe(true);

    badge!.click();

    expect(setOpenMock).toHaveBeenCalledWith(false);
    expect(overlay.classList.contains('inventory-panel-open')).toBe(false);

    hud.destroy();
  });
});
