export function initLayout(): HTMLCanvasElement {
  const root = document.getElementById('game-container');
  if (!root) {
    throw new Error('Missing #game-container');
  }
  root.innerHTML = '';

  const hud = document.createElement('div');
  hud.className = 'hud';
  Object.assign(hud.style, {
    display: 'grid',
    gridTemplateColumns: '300px 1fr 360px',
    gridTemplateRows: 'auto 1fr',
    gap: '12px',
    height: '100%',
  });
  root.appendChild(hud);

  const overlay = document.createElement('div');
  overlay.id = 'ui-overlay';
  Object.assign(overlay.style, {
    gridColumn: '1 / 4',
    gridRow: '1',
  });
  hud.appendChild(overlay);

  const left = document.createElement('div');
  left.id = 'left-actions';
  Object.assign(left.style, {
    gridColumn: '1',
    gridRow: '2',
  });
  hud.appendChild(left);

  const board = document.createElement('div');
  Object.assign(board.style, {
    gridColumn: '2',
    gridRow: '2',
  });
  const canvas = document.createElement('canvas');
  canvas.id = 'game-canvas';
  canvas.width = 800;
  canvas.height = 600;
  board.appendChild(canvas);
  hud.appendChild(board);

  const right = document.createElement('div');
  right.id = 'right-panel';
  Object.assign(right.style, {
    gridColumn: '3',
    gridRow: '2',
  });
  hud.appendChild(right);

  const resourceBar = document.createElement('div');
  resourceBar.id = 'resource-bar';
  resourceBar.textContent = 'Resources: 0';
  overlay.appendChild(resourceBar);

  return canvas;
}
