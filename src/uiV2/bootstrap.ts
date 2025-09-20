import '../ui/style/atoms.css';

export interface UiV2Handle {
  destroy(): void;
}

export interface UiV2BootstrapOptions {
  overlay: HTMLElement;
  resourceBar: HTMLElement;
  canvas: HTMLCanvasElement;
}

export function bootstrapUiV2(options: UiV2BootstrapOptions): UiV2Handle {
  const { overlay, resourceBar } = options;
  const root = document.createElement('div');
  root.className = 'ui-v2-overlay';

  const card = document.createElement('section');
  card.className = 'ui-v2-card';
  card.setAttribute('aria-live', 'polite');
  card.setAttribute('role', 'status');

  const heading = document.createElement('h1');
  heading.className = 'ui-v2-card__title';
  heading.textContent = 'Experimental HUD Enabled';
  card.appendChild(heading);

  const copy = document.createElement('p');
  copy.className = 'ui-v2-card__body';
  copy.textContent =
    'The React/Tailwind interface is bootstrapped for this session. Gameplay systems continue to run, and classic HUD elements are paused while the new shell is under construction.';
  card.appendChild(copy);

  const hint = document.createElement('p');
  hint.className = 'ui-v2-card__hint';
  hint.textContent = 'Toggle the experimental HUD off from the quartermaster settings to return to the classic layout.';
  card.appendChild(hint);

  const accent = document.createElement('div');
  accent.className = 'ui-v2-card__accent';
  card.appendChild(accent);

  const resourceDock = document.createElement('div');
  resourceDock.className = 'ui-v2-card__resource';
  resourceDock.appendChild(resourceBar);
  card.appendChild(resourceDock);

  root.appendChild(card);
  overlay.appendChild(root);

  return {
    destroy() {
      if (resourceDock.contains(resourceBar)) {
        overlay.prepend(resourceBar);
      }
      root.remove();
    }
  } satisfies UiV2Handle;
}
