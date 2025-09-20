import { eventBus } from '../events';

export type GamePauseEvent = {
  paused: boolean;
};

let paused = false;

export function isGamePaused(): boolean {
  return paused;
}

export function setGamePaused(next: boolean): void {
  if (paused === next) {
    return;
  }
  paused = next;
  eventBus.emit('game:pause-changed', { paused } satisfies GamePauseEvent);
}

export function toggleGamePaused(): boolean {
  setGamePaused(!paused);
  return paused;
}

export function resetGamePause(): void {
  if (paused) {
    setGamePaused(false);
  }
}
