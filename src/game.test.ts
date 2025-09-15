import { describe, it, expect } from 'vitest';

describe('log function', () => {
  it('caps event log at 100 messages', async () => {
    document.body.innerHTML = `<div id="game-container"></div>`;

    const { log } = await import('./game.ts');

    for (let i = 1; i <= 150; i++) {
      log(`msg ${i}`);
    }

    await new Promise((r) => requestAnimationFrame(r));

    const eventLog = document.getElementById('event-log')!;
    expect(eventLog.childElementCount).toBe(100);
    expect(eventLog.firstChild?.textContent).toBe('msg 51');
  });
});
