let reloadInProgress = false;

export function setReloadInProgress(value: boolean): void {
  reloadInProgress = Boolean(value);
}

export function isReloadInProgress(): boolean {
  return reloadInProgress;
}
