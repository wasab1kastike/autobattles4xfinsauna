import { GameState } from '../core/GameState.ts';
import type { Sauna } from '../sim/sauna.ts';
import { setupSaunaUI } from './sauna.tsx';
import { setupRightPanel, GameEvent } from './rightPanel.tsx';

export function initLayout(
  state: GameState,
  sauna: Sauna
): {
  canvas: HTMLCanvasElement;
  updateSaunaUI: (dt: number) => void;
  log: (msg: string) => void;
  addEvent: (ev: GameEvent) => void;
} {
  let overlay = document.getElementById('ui-overlay') as HTMLDivElement | null;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ui-overlay';
    document.body.appendChild(overlay);
  }

  overlay.classList.add('hud');
  overlay.style.display = 'grid';
  overlay.style.gridTemplateColumns = '300px 1fr 360px';
  overlay.style.gridTemplateRows = 'auto 1fr';
  overlay.style.gap = '12px';
  overlay.style.height = '100vh';

  const left = document.createElement('div');
  left.id = 'left-actions';
  left.style.gridColumn = '1';
  left.style.gridRow = '2';
  left.style.position = 'relative';
  overlay.appendChild(left);

  const board = document.createElement('div');
  board.id = 'board-wrapper';
  board.style.gridColumn = '2';
  board.style.gridRow = '2';
  overlay.appendChild(board);

  let canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'game-canvas';
    canvas.width = 800;
    canvas.height = 600;
  }
  board.appendChild(canvas);

  const right = document.createElement('div');
  right.id = 'right-panel';
  right.style.gridColumn = '3';
  right.style.gridRow = '2';
  overlay.appendChild(right);

  const updateSaunaUI = setupSaunaUI(sauna, left);
  const { log, addEvent } = setupRightPanel(state, right);

  return { canvas, updateSaunaUI, log, addEvent };
}
