export type HudLayoutRegions = {
  top: HTMLDivElement;
  left: HTMLDivElement;
  content: HTMLDivElement;
  right: HTMLDivElement;
  bottom: HTMLDivElement;
};

export type HudLayoutAnchors = {
  topLeftCluster: HTMLDivElement;
  topRightCluster: HTMLDivElement;
  commandDock: HTMLDivElement;
};

export type HudLayoutDock = {
  root: HTMLDivElement;
  tabs: HTMLDivElement;
  actions: HTMLDivElement;
};

export type HudLayout = {
  root: HTMLDivElement;
  regions: HudLayoutRegions;
  anchors: HudLayoutAnchors;
  dock: HudLayoutDock;
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

const OVERLAY_GRID_CLASSES = {
  base: [
    'hud-grid',
    'grid',
    'grid-rows-[auto_1fr_auto]',
    'grid-cols-[minmax(clamp(200px,22vw,280px),1fr)_minmax(420px,1.6fr)_minmax(clamp(200px,24vw,340px),1fr)]',
    'gap-[clamp(16px,3vw,28px)]',
  ],
  collapsed: 'hud-grid--right-collapsed',
} as const;

export const HUD_OVERLAY_COLLAPSED_CLASS = OVERLAY_GRID_CLASSES.collapsed;

const REGION_GRID_CLASSES: Record<keyof HudLayoutRegions, string[]> = {
  top: ['col-span-3', 'row-span-1', 'row-start-1'],
  left: ['col-start-1', 'row-start-2', 'row-span-1'],
  content: ['col-start-2', 'row-start-2', 'row-span-1'],
  right: ['col-start-3', 'row-start-2', 'row-span-1'],
  bottom: ['col-span-3', 'row-start-3', 'row-span-1'],
};

const ANCHOR_DATASET_NAMES: Record<keyof HudLayoutAnchors, string> = {
  topLeftCluster: 'top-left-cluster',
  topRightCluster: 'top-right-cluster',
  commandDock: 'command-dock',
};

type CommandDockSection = 'tabs' | 'actions';

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

function ensureAnchor(
  region: HTMLDivElement,
  doc: Document,
  name: keyof HudLayoutAnchors,
  classNames: string[]
): HTMLDivElement {
  const datasetName = ANCHOR_DATASET_NAMES[name];
  let anchor = region.querySelector<HTMLDivElement>(`[data-hud-anchor="${datasetName}"]`);
  if (!anchor) {
    anchor = doc.createElement('div');
    anchor.dataset.hudAnchor = datasetName;
    region.appendChild(anchor);
  }
  anchor.className = ['hud-anchor', ...classNames].join(' ');
  if (anchor.parentElement !== region) {
    region.appendChild(anchor);
  }
  return anchor;
}

function ensureCommandDockSection(
  anchor: HTMLDivElement,
  doc: Document,
  section: CommandDockSection,
): HTMLDivElement {
  const selector = `[data-hud-command-dock-section="${section}"]`;
  let element = anchor.querySelector<HTMLDivElement>(selector);
  if (!element) {
    element = doc.createElement('div');
    element.dataset.hudCommandDockSection = section;
    anchor.appendChild(element);
  }
  element.dataset.hudCommandDockSection = section;
  const baseClass =
    section === 'tabs' ? 'hud-command-dock__tabs' : 'hud-command-dock__actions';
  element.classList.add('hud-command-dock__section', baseClass);
  if (element.parentElement !== anchor) {
    anchor.appendChild(element);
  }
  return element;
}

function applyVariantClasses(
  overlay: HTMLElement,
  regions: HudLayoutRegions,
  isUiV2: boolean
): void {
  if (isUiV2) {
    overlay.classList.add(...OVERLAY_GRID_CLASSES.base);
    for (const [name, classes] of Object.entries(REGION_GRID_CLASSES) as Array<[
      keyof HudLayoutRegions,
      string[]
    ]>) {
      regions[name].classList.add(...classes);
    }
  } else {
    overlay.classList.remove(...OVERLAY_GRID_CLASSES.base);
    overlay.classList.remove(OVERLAY_GRID_CLASSES.collapsed);
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

  const anchors = {
    topLeftCluster: ensureAnchor(regions.top, doc, 'topLeftCluster', [
      'hud-anchor--top-left',
    ]),
    topRightCluster: ensureAnchor(regions.top, doc, 'topRightCluster', [
      'hud-anchor--top-right',
    ]),
    commandDock: ensureAnchor(regions.bottom, doc, 'commandDock', [
      'hud-anchor--command-dock',
      'hud-command-dock',
    ]),
  } satisfies HudLayoutAnchors;

  const commandDockTabs = ensureCommandDockSection(anchors.commandDock, doc, 'tabs');
  const commandDockActions = ensureCommandDockSection(
    anchors.commandDock,
    doc,
    'actions',
  );

  regions.top.append(anchors.topLeftCluster, anchors.topRightCluster);
  regions.bottom.appendChild(anchors.commandDock);
  anchors.commandDock.append(commandDockTabs, commandDockActions);

  for (const child of Array.from(anchors.commandDock.children)) {
    if (child === commandDockTabs || child === commandDockActions) {
      continue;
    }
    if (
      child instanceof HTMLElement &&
      child.dataset?.hudBottomTabs === 'true'
    ) {
      child.remove();
      continue;
    }
    commandDockActions.appendChild(child);
  }

  const isUiV2 = overlay.dataset.hudVariant === 'v2';
  applyVariantClasses(overlay, regions, isUiV2);

  const topbar = overlay.querySelector<HTMLElement>('#topbar');
  if (topbar && topbar.parentElement !== anchors.topLeftCluster) {
    anchors.topLeftCluster.appendChild(topbar);
  }

  const buildMenu = overlay.querySelector<HTMLElement>('#build-menu');
  if (buildMenu && buildMenu.parentElement !== regions.left) {
    regions.left.appendChild(buildMenu);
  }

  const buildId = overlay.querySelector<HTMLElement>('#build-id');
  if (buildId && buildId.parentElement !== regions.bottom) {
    regions.bottom.appendChild(buildId);
  }

  const actionBarMounts = overlay.querySelectorAll<HTMLElement>(
    '[data-component="action-bar"]',
  );
  for (const mount of actionBarMounts) {
    if (mount.parentElement !== commandDockActions) {
      commandDockActions.appendChild(mount);
    }
  }

  const commandToggle = overlay.querySelector<HTMLElement>('#right-panel-toggle');
  if (commandToggle && commandToggle.parentElement !== commandDockActions) {
    commandDockActions.prepend(commandToggle);
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

  if (mobileWrapper.parentElement !== commandDockActions) {
    commandDockActions.appendChild(mobileWrapper);
  }

  return {
    root,
    regions,
    anchors,
    dock: {
      root: anchors.commandDock,
      tabs: commandDockTabs,
      actions: commandDockActions,
    },
    actions: regions.left,
    side: regions.right,
    mobileBar,
  } satisfies HudLayout;
}
