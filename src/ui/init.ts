import '../style.css';
import { setupGame, start, handleCanvasClick, draw, cleanup } from '../game.ts';

export function init(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  const resourceBar = document.getElementById('resource-bar');
  if (!canvas || !resourceBar) {
    return;
  }

  setupGame(canvas, resourceBar);

  function resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    draw();
  }

  window.addEventListener('resize', resizeCanvas);
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    handleCanvasClick(e.clientX - rect.left, e.clientY - rect.top);
  });
  window.addEventListener('beforeunload', cleanup);

  resizeCanvas();
  if (!import.meta.vitest) {
    start();
  }
}
