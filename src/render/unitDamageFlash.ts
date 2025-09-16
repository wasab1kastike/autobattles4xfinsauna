import { eventBus } from '../events/index.ts';
import { pathHex } from '../hex/index.ts';

interface UnitDamagedPayload {
  targetId?: string;
}

const FLASH_DURATION_MS = 220;

const flashStartByUnit = new Map<string, number>();

let teardown: (() => void) | null = null;

function getTimestamp(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function onUnitDamaged(payload: UnitDamagedPayload): void {
  if (!payload || typeof payload.targetId !== 'string' || payload.targetId.length === 0) {
    return;
  }
  flashStartByUnit.set(payload.targetId, getTimestamp());
}

export function activateUnitDamageFlashTracking(): void {
  if (teardown) {
    return;
  }
  const listener = (payload: UnitDamagedPayload): void => {
    onUnitDamaged(payload);
  };
  eventBus.on('unitDamaged', listener);
  teardown = () => {
    eventBus.off('unitDamaged', listener);
    flashStartByUnit.clear();
  };
}

export function deactivateUnitDamageFlashTracking(): void {
  if (!teardown) {
    return;
  }
  teardown();
  teardown = null;
}

function getFlashStrength(unitId: string, now = getTimestamp()): number {
  const start = flashStartByUnit.get(unitId);
  if (start == null) {
    return 0;
  }
  const elapsed = now - start;
  if (elapsed >= FLASH_DURATION_MS) {
    flashStartByUnit.delete(unitId);
    return 0;
  }
  const t = 1 - elapsed / FLASH_DURATION_MS;
  // Ease-out cubic curve for a sharp pop that fades smoothly.
  const eased = 1 - Math.pow(1 - t, 3);
  return Math.max(0, Math.min(1, eased));
}

export function drawUnitDamageFlash(
  ctx: CanvasRenderingContext2D,
  unitId: string,
  centerX: number,
  centerY: number,
  radius: number,
  now = getTimestamp()
): void {
  const intensity = getFlashStrength(unitId, now);
  if (intensity <= 0) {
    return;
  }

  const outerRadius = radius * 0.98;
  const innerRadius = outerRadius * 0.35;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = intensity;
  pathHex(ctx, centerX, centerY, outerRadius);
  const gradient = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.55)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.lineWidth = Math.max(1, radius * 0.1);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
  ctx.shadowBlur = radius * 0.6;
  ctx.stroke();
  ctx.restore();
}

export function resetUnitDamageFlashTracking(): void {
  flashStartByUnit.clear();
}
