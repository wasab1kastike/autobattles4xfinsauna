import { ensureHudLayout } from '../ui/layout.ts';

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
  hint.className = 'm-0 text-sm leading-relaxed text-slate-200/75';
  hint.textContent = 'Toggle the experimental HUD off from the quartermaster settings to return to the classic layout.';
  card.appendChild(hint);

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
      if (resourceDock.contains(resourceBar)) {
        overlay.prepend(resourceBar);
      }
      root.remove();
    }
  } satisfies UiV2Handle;
}
