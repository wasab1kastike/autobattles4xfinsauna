export type HudLayoutRegions = {
  top: HTMLDivElement;
  left: HTMLDivElement;
  content: HTMLDivElement;
  right: HTMLDivElement;
  bottom: HTMLDivElement;
};

const HUD_ROOT_ID = 'hud-root';
const HUD_OVERLAY_ID = 'ui-overlay';
const DEFAULT_RESOURCE_BAR_TEXT = 'Saunoja Roster: 0';

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

export type HudBottomTabId = 'roster' | 'policies';

export type HudBottomTabs = {
  container: HTMLDivElement;
  tabList: HTMLDivElement;
  panels: Record<HudBottomTabId, HTMLDivElement>;
  getActive(): HudBottomTabId;
  setActive(id: HudBottomTabId): void;
  setBadge(id: HudBottomTabId, value: number | string | null): void;
  onChange(handler: (id: HudBottomTabId) => void): () => void;
};

export type HudLayout = {
  root: HTMLDivElement;
  regions: HudLayoutRegions;
  anchors: HudLayoutAnchors;
  dock: HudLayoutDock;
  tabs: HudBottomTabs;
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

export type HudOverlayContext = {
  overlay: HTMLElement;
  layout: HudLayout;
  resourceBar: HTMLDivElement;
  buildId: HTMLElement;
};

const OVERLAY_GRID_CLASSES = {
  base: [
    'hud-grid',
    'grid',
    'grid-rows-[auto_1fr_auto]',
    'grid-cols-[minmax(clamp(210px,23vw,320px),1fr)_minmax(432px,1.65fr)_minmax(clamp(210px,23vw,320px),1fr)]',
    'gap-[clamp(18px,2.5vw,30px)]',
  ],
  collapsed: 'hud-grid--right-collapsed',
} as const;

export const HUD_OVERLAY_COLLAPSED_CLASS = OVERLAY_GRID_CLASSES.collapsed;
export const ROSTER_HUD_OPEN_CLASS = 'roster-hud-open';

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

const BOTTOM_TAB_ORDER: HudBottomTabId[] = ['roster', 'policies'];

const BOTTOM_TAB_LABELS: Record<HudBottomTabId, string> = {
  roster: 'Roster',
  policies: 'Policies',
};

type BottomTabState = {
  container: HTMLDivElement;
  tabList: HTMLDivElement;
  panelWrapper: HTMLDivElement;
  buttons: Record<HudBottomTabId, HTMLButtonElement>;
  badges: Record<HudBottomTabId, HTMLSpanElement>;
  panels: Record<HudBottomTabId, HTMLDivElement>;
  listeners: Set<(id: HudBottomTabId) => void>;
  active: HudBottomTabId;
  keydownHandler: ((event: KeyboardEvent) => void) | null;
};

const bottomTabStates = new WeakMap<HTMLDivElement, BottomTabState>();

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

function applyVariantClasses(overlay: HTMLElement, regions: HudLayoutRegions): void {
  const { base, collapsed } = OVERLAY_GRID_CLASSES;

  const overlayVariantClasses = Array.from(overlay.classList).filter(
    (className) => className.startsWith('hud-grid--') && className !== collapsed,
  );
  if (overlayVariantClasses.length > 0) {
    overlay.classList.remove(...overlayVariantClasses);
  }

  overlay.classList.add(...base);
  if (overlay.classList.contains(collapsed)) {
    overlay.classList.add(collapsed);
  }

  for (const [name, classes] of Object.entries(REGION_GRID_CLASSES) as Array<[
    keyof HudLayoutRegions,
    string[]
  ]>) {
    const region = regions[name];
    const regionVariantClasses = Array.from(region.classList).filter((className) =>
      className.startsWith('hud-region--'),
    );
    if (regionVariantClasses.length > 0) {
      region.classList.remove(...regionVariantClasses);
    }
    region.classList.add(...classes);
  }
}

function ensureBuildBadge(layout: HudLayout, doc: Document): HTMLElement {
  const region = layout.regions.bottom;
  let buildId = region.querySelector<HTMLElement>('#build-id');
  if (!buildId) {
    buildId = doc.createElement('footer');
    buildId.id = 'build-id';
    buildId.setAttribute('aria-live', 'polite');
    buildId.setAttribute('aria-label', 'Development build');
    buildId.dataset.buildState = buildId.dataset.buildState ?? 'development';
    buildId.title = buildId.title || 'Unversioned development build';
    const label = doc.createElement('span');
    label.className = 'build-id__label';
    label.textContent = 'Build';
    const value = doc.createElement('span');
    value.className = 'build-id__value';
    value.dataset.buildCommit = value.dataset.buildCommit ?? '';
    value.dataset.state = value.dataset.state ?? 'dev';
    value.textContent = value.textContent?.trim() || '—';
    buildId.append(label, value);
    region.appendChild(buildId);
  } else {
    if (!buildId.querySelector('.build-id__label')) {
      const label = doc.createElement('span');
      label.className = 'build-id__label';
      label.textContent = 'Build';
      buildId.prepend(label);
    }
    const value =
      buildId.querySelector<HTMLSpanElement>('[data-build-commit]') ??
      (() => {
        const span = doc.createElement('span');
        span.className = 'build-id__value';
        span.dataset.buildCommit = '';
        span.dataset.state = 'dev';
        span.textContent = '—';
        buildId.appendChild(span);
        return span;
      })();
    value.classList.add('build-id__value');
    if (!value.dataset.state) {
      value.dataset.state = 'dev';
    }
    if (!value.textContent || value.textContent.trim().length === 0) {
      value.textContent = '—';
    }
    if (!buildId.dataset.buildState) {
      buildId.dataset.buildState = 'development';
    }
    if (!buildId.hasAttribute('aria-live')) {
      buildId.setAttribute('aria-live', 'polite');
    }
    if (!buildId.hasAttribute('aria-label')) {
      buildId.setAttribute('aria-label', 'Development build');
    }
    if (!buildId.title) {
      buildId.title = 'Unversioned development build';
    }
  }
  return buildId;
}

function ensureBottomTabs(
  region: HTMLDivElement,
  doc: Document,
  overlay: HTMLElement
): HudBottomTabs {
  let container = region.querySelector<HTMLDivElement>('[data-hud-bottom-tabs]');
  if (!container) {
    container = doc.createElement('div');
    container.dataset.hudBottomTabs = 'true';
    region.appendChild(container);
  }
  container.classList.add('hud-bottom-tabs');

  let chrome = container.querySelector<HTMLDivElement>('[data-hud-bottom-tabs-chrome]');
  if (!chrome) {
    chrome = doc.createElement('div');
    chrome.dataset.hudBottomTabsChrome = 'true';
    container.appendChild(chrome);
  }
  chrome.classList.add('hud-bottom-tabs__chrome');

  let tabList = chrome.querySelector<HTMLDivElement>('[data-hud-bottom-tablist]');
  if (!tabList) {
    tabList = doc.createElement('div');
    tabList.dataset.hudBottomTablist = 'true';
    chrome.appendChild(tabList);
  }
  tabList.classList.add('hud-bottom-tabs__list');
  tabList.setAttribute('role', 'tablist');

  let panelWrapper = chrome.querySelector<HTMLDivElement>('[data-hud-bottom-panels]');
  if (!panelWrapper) {
    panelWrapper = doc.createElement('div');
    panelWrapper.dataset.hudBottomPanels = 'true';
    chrome.appendChild(panelWrapper);
  }
  panelWrapper.classList.add('hud-bottom-tabs__panels');

  const buttons = {} as Record<HudBottomTabId, HTMLButtonElement>;
  const badges = {} as Record<HudBottomTabId, HTMLSpanElement>;
  const panels = {} as Record<HudBottomTabId, HTMLDivElement>;

  for (const tabId of BOTTOM_TAB_ORDER) {
    const labelText = BOTTOM_TAB_LABELS[tabId];

    let button = tabList.querySelector<HTMLButtonElement>(`[data-hud-tab="${tabId}"]`);
    let labelEl: HTMLSpanElement;
    let badgeEl: HTMLSpanElement;
    if (!button) {
      button = doc.createElement('button');
      button.type = 'button';
      button.dataset.hudTab = tabId;
      button.className = 'hud-bottom-tabs__tab';
      labelEl = doc.createElement('span');
      labelEl.className = 'hud-bottom-tabs__label';
      button.appendChild(labelEl);
      badgeEl = doc.createElement('span');
      badgeEl.className = 'hud-bottom-tabs__badge';
      badgeEl.hidden = true;
      button.appendChild(badgeEl);
      tabList.appendChild(button);
    } else {
      button.classList.add('hud-bottom-tabs__tab');
      labelEl =
        button.querySelector<HTMLSpanElement>('.hud-bottom-tabs__label') ??
        (() => {
          const span = doc.createElement('span');
          span.className = 'hud-bottom-tabs__label';
          button.prepend(span);
          return span;
        })();
      badgeEl =
        button.querySelector<HTMLSpanElement>('.hud-bottom-tabs__badge') ??
        (() => {
          const span = doc.createElement('span');
          span.className = 'hud-bottom-tabs__badge';
          span.hidden = true;
          button.appendChild(span);
          return span;
        })();
    }
    labelEl.textContent = labelText;

    const buttonId = `hud-bottom-tab-${tabId}`;
    button.id = buttonId;
    button.setAttribute('role', 'tab');
    button.tabIndex = -1;

    buttons[tabId] = button;
    badges[tabId] = badgeEl;

    let panel = panelWrapper.querySelector<HTMLDivElement>(
      `[data-hud-tab-panel="${tabId}"]`
    );
    if (!panel) {
      if (tabId === 'roster') {
        panel =
          overlay.querySelector<HTMLDivElement>('#resource-bar') ?? doc.createElement('div');
      } else {
        panel = doc.createElement('div');
      }
    }

    panel.dataset.hudTabPanel = tabId;
    panel.classList.add('hud-bottom-tabs__panel');
    if (tabId === 'roster') {
      panel.id = 'resource-bar';
      panel.classList.add('hud-bottom-tabs__panel--roster');
    } else if (!panel.id) {
      panel.id = `hud-bottom-panel-${tabId}`;
    }

    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', buttonId);
    if (panel.parentElement !== panelWrapper) {
      panelWrapper.appendChild(panel);
    }

    button.setAttribute('aria-controls', panel.id);

    panels[tabId] = panel;
  }

  let state = bottomTabStates.get(container);
  if (!state) {
    const initial = container.dataset.hudTabActive as HudBottomTabId | undefined;
    const active = initial && BOTTOM_TAB_ORDER.includes(initial) ? initial : 'roster';
    state = {
      container,
      tabList,
      panelWrapper,
      buttons,
      badges,
      panels,
      listeners: new Set(),
      active,
      keydownHandler: null,
    } satisfies BottomTabState;
    bottomTabStates.set(container, state);
  } else {
    const previousList = state.tabList;
    state.tabList = tabList;
    state.panelWrapper = panelWrapper;
    state.buttons = buttons;
    state.badges = badges;
    state.panels = panels;
    if (state.keydownHandler && previousList !== tabList) {
      previousList.removeEventListener('keydown', state.keydownHandler);
      tabList.addEventListener('keydown', state.keydownHandler);
    }
  }

  const updateDom = (): void => {
    const active = state!.active;
    container.dataset.hudTabActive = active;
    for (const tabId of BOTTOM_TAB_ORDER) {
      const button = state!.buttons[tabId];
      const panel = state!.panels[tabId];
      const isActive = tabId === active;
      if (button) {
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        button.tabIndex = isActive ? 0 : -1;
        button.dataset.active = isActive ? 'true' : 'false';
      }
      if (panel) {
        const rosterOpen = overlay.classList.contains(ROSTER_HUD_OPEN_CLASS);
        const shouldShow = isActive && (tabId !== 'roster' || rosterOpen);
        panel.hidden = !shouldShow;
        panel.dataset.active = shouldShow ? 'true' : 'false';
        panel.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
      }
    }
  };

  const setActive = (nextId: HudBottomTabId): void => {
    const safeId = BOTTOM_TAB_ORDER.includes(nextId) ? nextId : 'roster';
    const prev = state!.active;
    state!.active = safeId;
    updateDom();
    if (prev !== safeId) {
      for (const listener of state!.listeners) {
        listener(safeId);
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) {
      return;
    }
    const key = event.key;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const direction = key === 'ArrowLeft' ? -1 : 1;
      const currentIndex = BOTTOM_TAB_ORDER.indexOf(state!.active);
      const nextIndex = (currentIndex + direction + BOTTOM_TAB_ORDER.length) % BOTTOM_TAB_ORDER.length;
      const nextId = BOTTOM_TAB_ORDER[nextIndex];
      setActive(nextId);
      state!.buttons[nextId]?.focus({ preventScroll: true });
      event.preventDefault();
      return;
    }
    if (key === 'Home') {
      const first = BOTTOM_TAB_ORDER[0];
      setActive(first);
      state!.buttons[first]?.focus({ preventScroll: true });
      event.preventDefault();
      return;
    }
    if (key === 'End') {
      const last = BOTTOM_TAB_ORDER[BOTTOM_TAB_ORDER.length - 1];
      setActive(last);
      state!.buttons[last]?.focus({ preventScroll: true });
      event.preventDefault();
    }
  };

  if (!state.keydownHandler) {
    state.keydownHandler = handleKeyDown;
    tabList.addEventListener('keydown', handleKeyDown);
  }

  for (const tabId of BOTTOM_TAB_ORDER) {
    const button = state.buttons[tabId];
    if (!button.dataset.hudTabBound) {
      button.addEventListener('click', () => {
        setActive(tabId);
      });
      button.dataset.hudTabBound = 'true';
    }
  }

  updateDom();

  const setBadge = (id: HudBottomTabId, value: number | string | null): void => {
    const badge = state!.badges[id];
    const button = state!.buttons[id];
    if (!badge || !button) {
      return;
    }
    if (value === null || value === '' || (typeof value === 'number' && !Number.isFinite(value))) {
      badge.textContent = '';
      badge.hidden = true;
      button.removeAttribute('data-badge');
      return;
    }
    const text = String(value);
    const numeric = Number(text);
    if (text.length === 0 || (!Number.isNaN(numeric) && numeric <= 0)) {
      badge.textContent = '';
      badge.hidden = true;
      button.removeAttribute('data-badge');
      return;
    }
    badge.textContent = text;
    badge.hidden = false;
    button.setAttribute('data-badge', text);
  };

  const onChange = (handler: (id: HudBottomTabId) => void): (() => void) => {
    state!.listeners.add(handler);
    return () => {
      state!.listeners.delete(handler);
    };
  };

  return {
    container,
    tabList,
    panels,
    getActive: () => state!.active,
    setActive,
    setBadge,
    onChange,
  } satisfies HudBottomTabs;
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

  const tabs = ensureBottomTabs(regions.bottom, doc, overlay);

  regions.top.append(anchors.topLeftCluster, anchors.topRightCluster);
  regions.bottom.appendChild(anchors.commandDock);
  anchors.commandDock.append(commandDockTabs, commandDockActions);

  if (tabs.container.parentElement !== commandDockTabs) {
    commandDockTabs.appendChild(tabs.container);
  }

  for (const child of Array.from(anchors.commandDock.children)) {
    if (child === commandDockTabs || child === commandDockActions) {
      continue;
    }
    if (
      child instanceof HTMLElement &&
      child.dataset?.hudBottomTabs === 'true'
    ) {
      commandDockTabs.appendChild(child);
      continue;
    }
    commandDockActions.appendChild(child);
  }

  applyVariantClasses(overlay, regions);

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
    tabs,
    actions: regions.left,
    side: regions.right,
    mobileBar,
  } satisfies HudLayout;
}

export function ensureHudOverlayContext({
  mount,
  doc,
}: {
  mount?: HTMLElement | null;
  doc?: Document;
} = {}): HudOverlayContext | null {
  const activeDoc = doc ?? (typeof document !== 'undefined' ? document : undefined);
  if (!activeDoc) {
    return null;
  }

  const mountPoint =
    mount ??
    activeDoc.getElementById(HUD_ROOT_ID) ??
    undefined;

  let overlay =
    activeDoc.getElementById(HUD_OVERLAY_ID) ??
    mountPoint?.querySelector<HTMLElement>(`#${HUD_OVERLAY_ID}`) ??
    null;

  if (!overlay && mountPoint) {
    overlay = activeDoc.createElement('div');
    overlay.id = HUD_OVERLAY_ID;
    mountPoint.appendChild(overlay);
  }

  if (!overlay) {
    return null;
  }

  if (mountPoint && overlay.parentElement !== mountPoint) {
    mountPoint.appendChild(overlay);
  }

  const layout = ensureHudLayout(overlay);
  const resourceBar = layout.tabs.panels.roster;
  if (
    resourceBar &&
    resourceBar.childElementCount === 0 &&
    (!resourceBar.textContent || resourceBar.textContent.trim().length === 0)
  ) {
    resourceBar.textContent = DEFAULT_RESOURCE_BAR_TEXT;
  }
  const buildId = ensureBuildBadge(layout, activeDoc);

  return {
    overlay,
    layout,
    resourceBar,
    buildId,
  } satisfies HudOverlayContext;
}

export function getHudOverlayElement({
  mount,
  doc,
}: {
  mount?: HTMLElement | null;
  doc?: Document;
} = {}): HTMLElement | null {
  return ensureHudOverlayContext({ mount, doc })?.overlay ?? null;
}

export function getHudResourceBar({
  mount,
  doc,
}: {
  mount?: HTMLElement | null;
  doc?: Document;
} = {}): HTMLDivElement | null {
  return ensureHudOverlayContext({ mount, doc })?.resourceBar ?? null;
}
