import { radii, shadows, zIndex } from './theme/tokens.ts';

export function showError(messages: string[]): void {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) return;

  const blocker = document.createElement('div');
  blocker.id = 'error-overlay';
  blocker.className =
    'absolute inset-0 grid place-items-center bg-black/75 backdrop-blur-sm';
  blocker.style.pointerEvents = 'auto';
  blocker.style.zIndex = String(zIndex.scrim);

  const panel = document.createElement('div');
  panel.className =
    'w-full max-w-[80%] space-y-4 bg-slate-900/90 p-6 text-center text-white shadow-hud-lg';
  panel.style.borderRadius = radii.lg;
  panel.style.boxShadow = shadows.lg;

  const title = document.createElement('h2');
  title.className = 'text-2xl font-semibold tracking-wide';
  title.textContent = 'Asset load errors';
  panel.appendChild(title);

  const list = document.createElement('ul');
  list.className =
    'list-inside list-disc space-y-2 text-left text-sm text-slate-200/90';
  for (const msg of messages) {
    const li = document.createElement('li');
    li.textContent = msg;
    list.appendChild(li);
  }
  panel.appendChild(list);

  const button = document.createElement('button');
  button.textContent = 'Reload';
  button.className =
    'inline-flex items-center justify-center rounded-hud-md bg-accent px-5 py-2 font-semibold text-slate-900 shadow-hud-sm transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:shadow-hud-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:translate-y-0.5';
  button.addEventListener('click', () => {
    location.reload();
  });
  panel.appendChild(button);

  blocker.appendChild(panel);
  overlay.appendChild(blocker);
}
