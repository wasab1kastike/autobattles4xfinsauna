import type { Sauna } from '../sim/sauna.ts';
import type { SaunaTierContext, SaunaTierId } from '../sauna/tiers.ts';
import type { SaunaUIController } from '../ui/sauna.tsx';

export interface UiV2SaunaController {
  mount(container: HTMLElement): void;
  unmount(container: HTMLElement): void;
  dispose(): void;
}

export interface UiV2SaunaControllerOptions {
  getSauna(): Sauna;
  setupSaunaUi(
    sauna: Sauna,
    options: {
      getActiveTierId: () => SaunaTierId;
      setActiveTierId: (tierId: SaunaTierId, options?: { persist?: boolean }) => boolean;
      getTierContext: () => SaunaTierContext;
    }
  ): SaunaUIController;
  setExternalController(controller: SaunaUIController | null): void;
  getActiveTierId(): SaunaTierId;
  setActiveTierId(tierId: SaunaTierId, options?: { persist?: boolean }): boolean;
  getTierContext(): SaunaTierContext;
}

export function createUiV2SaunaController(
  options: UiV2SaunaControllerOptions
): UiV2SaunaController {
  let controller: SaunaUIController | null = null;
  let host: HTMLElement | null = null;

  const cleanup = () => {
    if (controller) {
      try {
        controller.dispose();
      } catch (error) {
        console.warn('Failed to dispose UI v2 sauna controller cleanly', error);
      }
    }
    controller = null;
    if (host) {
      host.innerHTML = '';
    }
    host = null;
    options.setExternalController(null);
  };

  const mount = (container: HTMLElement) => {
    cleanup();
    host = container;
    const ui = options.setupSaunaUi(options.getSauna(), {
      getActiveTierId: () => options.getActiveTierId(),
      setActiveTierId: (tierId, opts) => options.setActiveTierId(tierId, opts),
      getTierContext: () => options.getTierContext()
    });
    controller = ui;
    options.setExternalController(ui);
    ui.update();
  };

  return {
    mount(container) {
      mount(container);
    },
    unmount(container) {
      if (container === host) {
        cleanup();
      }
    },
    dispose() {
      cleanup();
    }
  } satisfies UiV2SaunaController;
}
