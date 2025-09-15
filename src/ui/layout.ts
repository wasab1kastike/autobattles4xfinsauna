export function initLayout(): void {
  const root = document.getElementById('game-container');
  if (!root) return;

  root.innerHTML = '';

  const hud = document.createElement('div');
  hud.className = 'hud';
  root.appendChild(hud);

  const topbar = document.createElement('div');
  topbar.id = 'topbar';
  hud.appendChild(topbar);

  const left = document.createElement('div');
  left.id = 'left-actions';
  hud.appendChild(left);

  const board = document.createElement('div');
  board.id = 'board';
  const canvas = document.createElement('canvas');
  canvas.id = 'game-canvas';
  canvas.width = 800;
  canvas.height = 600;
  board.appendChild(canvas);
  hud.appendChild(board);

  const right = document.createElement('div');
  right.id = 'right-panel';
  hud.appendChild(right);

  const resourceBar = document.createElement('div');
  resourceBar.id = 'resource-bar';
  left.appendChild(resourceBar);
}
