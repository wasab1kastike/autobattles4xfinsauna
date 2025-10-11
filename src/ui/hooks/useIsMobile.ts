const MOBILE_QUERY = '(max-width: 959px)';
const MOBILE_CLASS = 'is-mobile';
const DESKTOP_CLASS = 'is-desktop';

type IsMobileListener = (isMobile: boolean) => void;

type UseIsMobileOptions = {
  root?: HTMLElement | null;
  onChange?: IsMobileListener;
  immediate?: boolean;
};

type IsMobileHandle = {
  matches(): boolean;
  dispose(): void;
};

let mediaQuery: MediaQueryList | null = null;
let detachMediaQuery: (() => void) | null = null;
let currentState = false;
let activeHandles = 0;
const listeners = new Set<IsMobileListener>();
const rootElements = new Set<HTMLElement>();

const applyViewportClass = (isMobile: boolean) => {
  for (const root of rootElements) {
    root.classList.toggle(MOBILE_CLASS, isMobile);
    root.classList.toggle(DESKTOP_CLASS, !isMobile);
    root.dataset.viewport = isMobile ? 'mobile' : 'desktop';
  }
};

const updateState = (matches: boolean) => {
  if (currentState === matches) {
    return;
  }
  currentState = matches;
  applyViewportClass(currentState);
  for (const listener of Array.from(listeners)) {
    try {
      listener(currentState);
    } catch (error) {
      console.error('Failed to notify mobile listener', error);
    }
  }
};

const ensureMediaQuery = () => {
  if (mediaQuery || typeof window === 'undefined') {
    return;
  }
  mediaQuery = window.matchMedia(MOBILE_QUERY);
  currentState = mediaQuery.matches;
  applyViewportClass(currentState);
  const handleChange = (event: MediaQueryListEvent) => {
    updateState(event.matches);
  };
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleChange);
    detachMediaQuery = () => mediaQuery?.removeEventListener('change', handleChange);
  } else {
    mediaQuery.addListener(handleChange);
    detachMediaQuery = () => mediaQuery?.removeListener(handleChange);
  }
};

const releaseMediaQuery = () => {
  if (!mediaQuery) {
    return;
  }
  detachMediaQuery?.();
  detachMediaQuery = null;
  mediaQuery = null;
};

export const getIsMobile = (): boolean => {
  if (!mediaQuery && typeof window !== 'undefined') {
    ensureMediaQuery();
  }
  return currentState;
};

export const subscribeToIsMobile = (
  listener: IsMobileListener,
  { immediate = true }: { immediate?: boolean } = {},
): (() => void) => {
  ensureMediaQuery();
  listeners.add(listener);
  if (immediate) {
    listener(currentState);
  }
  return () => {
    listeners.delete(listener);
  };
};

export const useIsMobile = ({
  root,
  onChange,
  immediate = true,
}: UseIsMobileOptions = {}): IsMobileHandle => {
  ensureMediaQuery();
  const defaultRoot =
    root ?? (typeof document !== 'undefined' ? document.documentElement : null);
  if (defaultRoot) {
    rootElements.add(defaultRoot);
    applyViewportClass(currentState);
  }

  activeHandles += 1;

  let unsubscribe: (() => void) | null = null;
  if (onChange) {
    unsubscribe = subscribeToIsMobile(onChange, { immediate });
  } else if (immediate && mediaQuery) {
    // Ensure classes stay in sync even without explicit subscriber.
    applyViewportClass(currentState);
  }

  return {
    matches: () => currentState,
    dispose: () => {
      if (defaultRoot) {
        rootElements.delete(defaultRoot);
        defaultRoot.classList.remove(MOBILE_CLASS, DESKTOP_CLASS);
        if (defaultRoot.dataset.viewport === 'mobile' || defaultRoot.dataset.viewport === 'desktop') {
          delete defaultRoot.dataset.viewport;
        }
      }
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      activeHandles = Math.max(0, activeHandles - 1);
      if (activeHandles === 0 && listeners.size === 0) {
        releaseMediaQuery();
      }
    },
  };
};
