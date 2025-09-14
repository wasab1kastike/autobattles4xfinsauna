import { setupRightPanel } from './rightPanel.tsx';
import { setupSaunaUI } from './sauna.tsx';
import type { GameState } from '../core/GameState.ts';
import type { Sauna } from '../sim/sauna.ts';

export function initLayout(state: GameState, sauna: Sauna) {
  const container = document.getElementById('game-container');
  if (!container) {
    throw new Error('game-container not found');
  }

  const hud = document.createElement('div');
  hud.className = 'hud';

  const topbarMount = document.createElement('div');
  topbarMount.style.gridColumn = '1 / 4';
  topbarMount.style.gridRow = '1';
  topbarMount.style.pointerEvents = 'auto';
  hud.appendChild(topbarMount);

  const actionsMount = document.createElement('div');
  actionsMount.style.gridColumn = '1';
  actionsMount.style.gridRow = '2';
  actionsMount.style.pointerEvents = 'auto';
  hud.appendChild(actionsMount);

  const boardWrapper = document.createElement('div');
  boardWrapper.style.gridColumn = '2';
  boardWrapper.style.gridRow = '2';
  boardWrapper.style.pointerEvents = 'auto';
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  boardWrapper.appendChild(canvas);
  hud.appendChild(boardWrapper);

  const rightMount = document.createElement('div');
  rightMount.style.gridColumn = '3';
  rightMount.style.gridRow = '2';
  rightMount.style.pointerEvents = 'auto';
  hud.appendChild(rightMount);

  container.appendChild(hud);

  const updateSaunaUI = setupSaunaUI(sauna, actionsMount);
  const { log, addEvent } = setupRightPanel(state, rightMount);

  return { canvas, topbarMount, updateSaunaUI, log, addEvent };
}
