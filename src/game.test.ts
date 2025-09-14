import { describe, it, expect } from 'vitest';

describe('log function', () => {
  it('caps event log at 100 messages', async () => {
    document.body.innerHTML = `
      <canvas id="game-canvas"></canvas>
      <div id="resource-bar"></div>
      <div id="event-log"></div>
      <button id="build-farm"></button>
      <button id="build-barracks"></button>
      <button id="upgrade-farm"></button>
      <button id="policy-eco"></button>
    `;

    const { log } = await import('./game.ts');

    for (let i = 1; i <= 150; i++) {
      log(`msg ${i}`);
    }

    // flush batched logs
    (log as any).flush();
    const eventLog = document.getElementById('event-log')!;

    expect(eventLog.childElementCount).toBe(100);
    expect(eventLog.firstChild?.textContent).toBe('msg 51');
  });
});
