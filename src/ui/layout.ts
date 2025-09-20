export type HudLayoutRegions = {
  top: HTMLDivElement;
  left: HTMLDivElement;
  content: HTMLDivElement;
  right: HTMLDivElement;
  bottom: HTMLDivElement;
};

export type HudLayout = {
  root: HTMLDivElement;
  regions: HudLayoutRegions;
  /**
   * @deprecated Prefer {@link regions.left}. Maintained for backwards compatibility.
   */
  actions: HTMLDivElement;
  /**
   * @deprecated Prefer {@link regions.right}. Maintained for backwards compatibility.
   */
  side: HTMLDivElement;
  mobileBar: HTMLDivElement;
};

const OVERLAY_GRID_CLASSES = [
  'hud-grid',
  'grid',
  'grid-rows-[64px_1fr_80px]',
  'grid-cols-[280px_1fr_340px]',
  'gap-[clamp(16px,3vw,28px)]',
];

const REGION_GRID_CLASSES: Record<keyof HudLayoutRegions, string[]> = {
  top: ['col-span-3', 'row-span-1', 'row-start-1'],
  left: ['col-start-1', 'row-start-2', 'row-span-1'],
  content: ['col-start-2', 'row-start-2', 'row-span-1'],
  right: ['col-start-3', 'row-start-2', 'row-span-1'],
  bottom: ['col-span-3', 'row-start-3', 'row-span-1'],
};

function ensureRoot(overlay: HTMLElement, doc: Document): HTMLDivElement {
  let root = overlay.querySelector<HTMLDivElement>('[data-hud-root]');
  if (!root) {
    root = doc.createElement('div');
    root.dataset.hudRoot = 'true';
    root.className = 'hud-layout-root';
    overlay.prepend(root);
  }
  return root;
}

function ensureRegion(
  root: HTMLDivElement,
  doc: Document,
  name: keyof HudLayoutRegions,
  classNames: string[]
): HTMLDivElement {
  let region = root.querySelector<HTMLDivElement>(`[data-hud-region="${name}"]`);
  if (!region) {
    region = doc.createElement('div');
    region.dataset.hudRegion = name;
    root.appendChild(region);
  }
  region.classList.add('hud-region', ...classNames);
  if (region.parentElement !== root) {
    root.appendChild(region);
  }
  return region;
}

function applyVariantClasses(
  overlay: HTMLElement,
  regions: HudLayoutRegions,
  isUiV2: boolean
): void {
  if (isUiV2) {
    overlay.classList.add(...OVERLAY_GRID_CLASSES);
    for (const [name, classes] of Object.entries(REGION_GRID_CLASSES) as Array<[
      keyof HudLayoutRegions,
      string[]
    ]>) {
      regions[name].classList.add(...classes);
    }
  } else {
    overlay.classList.remove(...OVERLAY_GRID_CLASSES);
    for (const [name, classes] of Object.entries(REGION_GRID_CLASSES) as Array<[
      keyof HudLayoutRegions,
      string[]
    ]>) {
      regions[name].classList.remove(...classes);
    }
  }
}

export function ensureHudLayout(overlay: HTMLElement): HudLayout {
  const doc = overlay.ownerDocument ?? document;
  const root = ensureRoot(overlay, doc);

  const regions = {
    top: ensureRegion(root, doc, 'top', ['hud-top-row']),
    left: ensureRegion(root, doc, 'left', ['hud-actions']),
    content: ensureRegion(root, doc, 'content', ['hud-content']),
    right: ensureRegion(root, doc, 'right', ['hud-right-column']),
    bottom: ensureRegion(root, doc, 'bottom', ['hud-bottom-row']),
  } satisfies HudLayoutRegions;

  // Guarantee consistent DOM order for the layout regions.
  root.append(regions.top, regions.left, regions.content, regions.right, regions.bottom);

  const isUiV2 = overlay.dataset.hudVariant === 'v2';
  applyVariantClasses(overlay, regions, isUiV2);

  if (!isUiV2) {
    const resourceBar = overlay.querySelector<HTMLElement>('#resource-bar');
    if (resourceBar && resourceBar.parentElement !== regions.right) {
      regions.right.prepend(resourceBar);
    }
  }

  const buildMenu = overlay.querySelector<HTMLElement>('#build-menu');
  if (buildMenu && buildMenu.parentElement !== regions.left) {
    regions.left.appendChild(buildMenu);
  }

  const buildId = overlay.querySelector<HTMLElement>('#build-id');
  if (buildId && buildId.parentElement !== regions.bottom) {
    regions.bottom.appendChild(buildId);
  }

  let mobileBar = overlay.querySelector<HTMLDivElement>('.hud-mobile-bar__tray');
  let mobileWrapper = mobileBar?.closest<HTMLDivElement>('.hud-mobile-bar') ?? null;
  if (!mobileBar || !mobileWrapper) {
    mobileWrapper = doc.createElement('div');
    mobileWrapper.className = 'hud-mobile-bar';
    mobileBar = doc.createElement('div');
    mobileBar.className = 'hud-mobile-bar__tray';
    mobileWrapper.appendChild(mobileBar);
  }

  if (mobileWrapper.parentElement !== regions.bottom) {
    regions.bottom.appendChild(mobileWrapper);
  }

  return {
    root,
    regions,
    actions: regions.left,
    side: regions.right,
    mobileBar,
  } satisfies HudLayout;
}
