export const LOCAL_FLAGS_STORAGE_KEY = 'autobattles4x.flags';

export type LocalFlags = {
  tutorial_done?: boolean;
};

function safeGetStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    if ('localStorage' in window && window.localStorage) {
      return window.localStorage;
    }
  } catch (error) {
    console.warn('Unable to access localStorage for local flags', error);
  }
  return null;
}

function readFlags(): LocalFlags {
  const storage = safeGetStorage();
  if (!storage) {
    return {};
  }
  try {
    const raw = storage.getItem(LOCAL_FLAGS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as LocalFlags;
    }
  } catch (error) {
    console.warn('Failed to parse local flags, resetting.', error);
  }
  return {};
}

function writeFlags(flags: LocalFlags): void {
  const storage = safeGetStorage();
  if (!storage) {
    return;
  }
  try {
    const cleaned: LocalFlags = {};
    if (flags.tutorial_done) {
      cleaned.tutorial_done = true;
    }
    storage.setItem(LOCAL_FLAGS_STORAGE_KEY, JSON.stringify(cleaned));
  } catch (error) {
    console.warn('Failed to persist local flags', error);
  }
}

export function isTutorialDone(): boolean {
  return readFlags().tutorial_done === true;
}

export function setTutorialDone(done: boolean): void {
  const next: LocalFlags = { ...readFlags() };
  if (done) {
    next.tutorial_done = true;
  } else {
    delete next.tutorial_done;
  }
  writeFlags(next);
}

export function resetTutorialProgress(): void {
  setTutorialDone(false);
}
