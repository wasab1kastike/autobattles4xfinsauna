export type HudLayout = {
  container: HTMLDivElement;
  actions: HTMLDivElement;
  side: HTMLDivElement;
};

export function ensureHudLayout(overlay: HTMLElement): HudLayout {
  let container = overlay.querySelector<HTMLDivElement>('.hud-top-row');
  if (!container) {
    container = document.createElement('div');
    container.className = 'hud-top-row';
    overlay.prepend(container);
  }

  let actions = container.querySelector<HTMLDivElement>('.hud-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'hud-actions';
    container.appendChild(actions);
  }

  let side = container.querySelector<HTMLDivElement>('.hud-right-column');
  if (!side) {
    side = document.createElement('div');
    side.className = 'hud-right-column';
    container.appendChild(side);

    const resourceBar = overlay.querySelector<HTMLElement>('#resource-bar');
    if (resourceBar) {
      side.prepend(resourceBar);
    }
  }

  const buildMenu = overlay.querySelector<HTMLElement>('#build-menu');
  if (buildMenu && buildMenu.parentElement !== actions) {
    actions.appendChild(buildMenu);
  }

  return { container, actions, side };
}
