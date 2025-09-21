import { ensureHudLayout } from '../ui/layout.ts';

export interface UiV2Handle {
  destroy(): void;
}

export interface UiV2BootstrapOptions {
  overlay: HTMLElement;
  resourceBar: HTMLElement;
  canvas: HTMLCanvasElement;
  onReturnToClassicHud?: () => void | Promise<void>;
}

export function bootstrapUiV2(options: UiV2BootstrapOptions): UiV2Handle {
  const { overlay, resourceBar } = options;
  const layout = ensureHudLayout(overlay);
  const { regions } = layout;

  const root = document.createElement('div');
  root.className =
    'pointer-events-none absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_top,rgba(18,28,45,0.92),rgba(6,10,18,0.94))] p-[clamp(1.5rem,4vw,3.25rem)] z-overlay';

  const card = document.createElement('section');
  card.className =
    'pointer-events-auto relative grid w-full max-w-[min(640px,90vw)] gap-4 overflow-hidden rounded-[28px] border border-[rgba(128,168,236,0.28)] bg-[linear-gradient(145deg,rgba(31,46,74,0.95),rgba(14,20,33,0.95))] p-[clamp(1.75rem,4vw,2.5rem)] text-slate-100 shadow-[0_40px_90px_rgba(10,14,28,0.6),_inset_0_1px_0_rgba(255,255,255,0.08)]';
  card.setAttribute('aria-live', 'polite');
  card.setAttribute('role', 'status');

  const heading = document.createElement('h1');
  heading.className = 'm-0 text-[clamp(1.6rem,3vw,2.1rem)] font-semibold uppercase tracking-[0.04em]';
  heading.textContent = 'Experimental HUD Enabled';
  card.appendChild(heading);

  const copy = document.createElement('p');
  copy.className = 'm-0 text-base leading-relaxed text-slate-100/90';
  copy.textContent =
    'The React/Tailwind interface is bootstrapped for this session. Gameplay systems continue to run, and classic HUD elements are paused while the new shell is under construction.';
  card.appendChild(copy);

  const hint = document.createElement('p');
  hint.id = 'ui-v2-return-hint';
  hint.className = 'm-0 text-sm leading-relaxed text-slate-200/75';
  hint.textContent = 'Prefer the original layout? Use the control below to return to the classic HUD instantly.';
  card.appendChild(hint);

  const controlTray = document.createElement('div');
  controlTray.className =
    'pointer-events-auto mt-3 flex flex-col gap-2 rounded-[20px] border border-[rgba(128,168,236,0.28)] bg-[linear-gradient(145deg,rgba(18,28,45,0.62),rgba(12,18,31,0.72))] p-4 shadow-[0_18px_40px_rgba(6,10,20,0.55),_inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[2px]';

  const controlLabel = document.createElement('span');
  controlLabel.id = 'ui-v2-return-label';
  controlLabel.className = 'text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-slate-100/75';
  controlLabel.textContent = 'Classic HUD';
  controlTray.appendChild(controlLabel);

  const returnButton = document.createElement('button');
  returnButton.type = 'button';
  returnButton.dataset.testid = 'return-to-classic-hud';
  returnButton.dataset.state = 'idle';
  returnButton.className =
    'inline-flex min-h-[2.75rem] items-center justify-center rounded-full border border-[rgba(132,172,236,0.45)] bg-[linear-gradient(135deg,rgba(66,121,206,0.92),rgba(40,78,142,0.92))] px-6 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-[0_16px_36px_rgba(7,12,22,0.65),_inset_0_1px_0_rgba(255,255,255,0.16)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300/90 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70';
  returnButton.textContent = 'Return to Classic HUD';
  returnButton.setAttribute('aria-describedby', `${hint.id} ${controlLabel.id}`);
  returnButton.setAttribute('aria-label', 'Return to the classic HUD');

  const handleReturnActivation = async (event: Event) => {
    event.preventDefault();
    if (!options.onReturnToClassicHud || returnButton.disabled) {
      return;
    }

    returnButton.disabled = true;
    returnButton.dataset.state = 'pending';
    returnButton.setAttribute('aria-disabled', 'true');

    try {
      const result = options.onReturnToClassicHud();
      if (result && typeof (result as Promise<void>).then === 'function') {
        await result;
      }
      returnButton.dataset.state = 'complete';
    } catch (error) {
      console.error('Failed to restore the classic HUD from the experimental overlay.', error);
      returnButton.disabled = false;
      returnButton.dataset.state = 'idle';
      returnButton.removeAttribute('aria-disabled');
    }
  };

  returnButton.addEventListener('click', handleReturnActivation);

  controlTray.appendChild(returnButton);
  card.appendChild(controlTray);

  const accent = document.createElement('div');
  accent.className =
    'pointer-events-none absolute -left-[30%] -top-[40%] h-[420px] w-[420px] bg-[radial-gradient(circle,rgba(90,164,255,0.35),rgba(90,164,255,0))] blur-[0.5px]';
  card.appendChild(accent);

  const resourceDock = document.createElement('div');
  resourceDock.className =
    'mt-2 rounded-[18px] border border-[rgba(128,168,236,0.2)] bg-[rgba(10,16,26,0.55)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';
  resourceDock.appendChild(resourceBar);
  card.appendChild(resourceDock);

  root.appendChild(card);
  regions.content.appendChild(root);

  return {
    destroy() {
      returnButton.removeEventListener('click', handleReturnActivation);
      if (resourceDock.contains(resourceBar)) {
        overlay.prepend(resourceBar);
      }
      root.remove();
    }
  } satisfies UiV2Handle;
}
