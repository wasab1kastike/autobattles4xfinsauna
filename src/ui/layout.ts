export function initLayout(): {
  canvas: HTMLCanvasElement;
  topbar: HTMLDivElement;
  left: HTMLDivElement;
  right: HTMLDivElement;
} {
  const hud = document.createElement('div');
  hud.className = 'hud';
  document.body.appendChild(hud);

  const topbar = document.createElement('div');
  topbar.style.gridColumn = '1 / 4';
  topbar.style.gridRow = '1';
  hud.appendChild(topbar);

  const left = document.createElement('div');
  left.style.gridColumn = '1';
  left.style.gridRow = '2';
  hud.appendChild(left);

  const board = document.createElement('div');
  board.style.gridColumn = '2';
  board.style.gridRow = '2';
  hud.appendChild(board);

  const right = document.createElement('div');
  right.style.gridColumn = '3';
  right.style.gridRow = '2';
  hud.appendChild(right);

  const canvas = document.createElement('canvas');
  canvas.id = 'game-canvas';
  canvas.width = 800;
  canvas.height = 600;
  board.appendChild(canvas);

  return { canvas, topbar, left, right };
}
