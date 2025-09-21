import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { ensureHudLayout } from '../ui/layout.ts';
import { UiV2App } from './UiV2App.tsx';

export interface UiV2Handle {
  destroy(): void;
}

export interface UiV2BootstrapOptions {
  overlay: HTMLElement;
  resourceBar: HTMLElement;
  canvas: HTMLCanvasElement;
  onReturnToClassic: () => void;
}

export function bootstrapUiV2(options: UiV2BootstrapOptions): UiV2Handle {
  const { overlay, resourceBar, onReturnToClassic } = options;
  const layout = ensureHudLayout(overlay);
  const { regions } = layout;

  const host = document.createElement('div');
  host.className = 'pointer-events-none absolute inset-0 z-overlay';
  regions.content.appendChild(host);

  let root: Root | null = null;
  try {
    root = createRoot(host);
    flushSync(() => {
      root?.render(<UiV2App resourceBar={resourceBar} onReturnToClassic={onReturnToClassic} />);
    });
  } catch (error) {
    console.error('Failed to bootstrap UI v2 React tree', error);
  }

  return {
    destroy() {
      try {
        root?.unmount();
      } catch (error) {
        console.warn('Failed to unmount UI v2 React root cleanly', error);
      }
      if (resourceBar && resourceBar.parentElement !== overlay) {
        overlay.prepend(resourceBar);
      }
      host.remove();
    }
  } satisfies UiV2Handle;
}
