import type { PixelCoord } from '../../hex/HexUtils.ts';
import type { SaunaStatusPayload, UnitStatusPayload, UnitStatusBuff } from './types.ts';

interface UnitStatusLayerOptions {
  /** Root element that hosts the floating FX overlay. */
  root: HTMLElement;
  /** Projection helper translating world pixel coordinates into screen space. */
  project: (point: PixelCoord, offsetY?: number) => PixelCoord | null;
  /** Accessor returning the active camera zoom for sizing. */
  getZoom: () => number;
}

interface UnitStatusFrame {
  units: readonly UnitStatusPayload[];
  sauna: SaunaStatusPayload | null;
}

interface UnitStatusElements {
  host: HTMLElement;
  hpFill: HTMLElement;
  shield: HTMLElement;
  buffs: HTMLElement;
}

let styleElement: HTMLStyleElement | null = null;

const HEX_CLIP =
  'polygon(50% 0%, 91.5% 24%, 91.5% 76%, 50% 100%, 8.5% 76%, 8.5% 24%)';

function ensureStyles(): void {
  if (styleElement || typeof document === 'undefined') {
    return;
  }

  styleElement = document.createElement('style');
  styleElement.id = 'unit-status-layer-styles';
  styleElement.textContent = `
    .ui-unit-status-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      contain: layout style;
      z-index: 8;
    }

    .ui-unit-status {
      position: absolute;
      transform: translate3d(0, 0, 0);
      will-change: transform;
      pointer-events: none;
      font-family: "Inter", "Manrope", "Segoe UI", sans-serif;
      color: #e2e8f0;
      text-shadow: 0 4px 12px rgba(2, 6, 23, 0.45);
    }

    .ui-unit-status__anchor {
      position: relative;
      transform: translate(-50%, -50%);
    }

    .ui-unit-status__hp {
      position: relative;
      width: calc(var(--radius) * 2);
      height: calc(var(--radius) * 2);
      filter: drop-shadow(0 4px 12px rgba(8, 25, 53, 0.55));
    }

    .ui-unit-status__hp-track,
    .ui-unit-status__hp-fill,
    .ui-unit-status__hp-border,
    .ui-unit-status__hp-shield {
      position: absolute;
      inset: 0;
      clip-path: ${HEX_CLIP};
      border-radius: 12px;
    }

    .ui-unit-status__hp-track {
      background: rgba(7, 11, 18, 0.72);
      backdrop-filter: blur(0.6px);
    }

    .ui-unit-status__hp-fill {
      transform-origin: 50% 100%;
      transform: scaleY(var(--hp-ratio, 0));
      background: linear-gradient(
        180deg,
        rgba(218, 255, 239, 0.95) 0%,
        rgba(46, 160, 98, 0.35) 100%
      );
    }

    .ui-unit-status__hp-border {
      box-shadow: 0 0 0 max(1.5px, var(--radius) * 0.12) rgba(255, 255, 255, 0.28);
      mix-blend-mode: screen;
    }

    .ui-unit-status__hp-shield {
      background: radial-gradient(
        circle at 50% 45%,
        rgba(96, 165, 250, 0.68),
        rgba(30, 64, 175, 0.2) 55%,
        rgba(30, 58, 138, 0) 75%
      );
      opacity: calc(var(--shield-ratio, 0) * 0.9);
      transition: opacity 120ms ease-out;
      mix-blend-mode: screen;
    }

    .ui-unit-status.is-selected .ui-unit-status__hp-border {
      box-shadow: 0 0 0 max(1.5px, var(--radius) * 0.14) rgba(148, 197, 255, 0.92);
    }

    .ui-unit-status__buffs {
      position: absolute;
      left: 50%;
      top: calc(50% + var(--radius) + 6px);
      transform: translateX(-50%);
      display: flex;
      gap: 4px;
    }

    .ui-unit-status__pip {
      width: clamp(6px, var(--radius) * 0.42, 11px);
      height: clamp(6px, var(--radius) * 0.42, 11px);
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.78);
      box-shadow: 0 2px 6px rgba(8, 25, 53, 0.55);
      position: relative;
      overflow: hidden;
      font-size: clamp(8px, var(--radius) * 0.35, 11px);
      line-height: 1;
      font-weight: 600;
      text-align: center;
      color: rgba(226, 232, 240, 0.92);
    }

    .ui-unit-status__pip::after {
      content: '';
      position: absolute;
      inset: 1px;
      border-radius: inherit;
      background: linear-gradient(
        90deg,
        rgba(56, 189, 248, 0.9) 0%,
        rgba(236, 72, 153, 0.9) 100%
      );
      transform-origin: left center;
      transform: scaleX(var(--pip-progress, 0));
      opacity: 0.92;
    }

    .ui-unit-status__pip[data-infinite='true']::after {
      transform: scaleX(1);
      background: linear-gradient(
        90deg,
        rgba(249, 115, 22, 0.85) 0%,
        rgba(244, 63, 94, 0.95) 100%
      );
    }

    .ui-unit-status__pip span {
      position: relative;
      z-index: 1;
    }

    .ui-unit-status__sauna {
      position: absolute;
      transform: translate3d(0, 0, 0);
      will-change: transform;
      pointer-events: none;
      font-family: "Inter", "Manrope", "Segoe UI", sans-serif;
      color: #e2e8f0;
      text-shadow: 0 6px 16px rgba(2, 6, 23, 0.55);
    }

    .ui-unit-status__sauna-anchor {
      position: relative;
      transform: translate(-50%, -50%);
    }

    .ui-unit-status__sauna-gauge {
      position: relative;
      width: calc(var(--radius) * 2.4);
      height: calc(var(--radius) * 2.4);
      padding: calc(var(--radius) * 0.28);
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.92);
      box-shadow: 0 14px 40px rgba(8, 25, 53, 0.58);
    }

    .ui-unit-status__sauna-ring {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.18);
      box-shadow: inset 0 0 0 max(1.5px, var(--radius) * 0.08) rgba(148, 163, 184, 0.42);
      overflow: hidden;
    }

    .ui-unit-status__sauna-progress {
      position: absolute;
      inset: 0;
      border-radius: 999px;
      background: conic-gradient(
        from -90deg,
        rgba(56, 189, 248, 0.12) 0deg,
        rgba(56, 189, 248, 0.12) calc(var(--progress, 0) * 360deg),
        rgba(56, 189, 248, 0) calc(var(--progress, 0) * 360deg),
        rgba(56, 189, 248, 0) 360deg
      );
      mix-blend-mode: screen;
    }

    .ui-unit-status__sauna-progress::after {
      content: '';
      position: absolute;
      inset: 6%;
      border-radius: inherit;
      background: conic-gradient(
        from -90deg,
        rgba(56, 189, 248, 0.92) 0deg,
        rgba(14, 165, 233, 0.95) calc(var(--progress, 0) * 360deg),
        rgba(244, 114, 182, 0.85) calc(var(--progress, 0) * 360deg)
      );
      filter: blur(1px);
      opacity: 0.94;
      mask: radial-gradient(circle, rgba(0, 0, 0, 1) 60%, rgba(0, 0, 0, 0) 70%);
    }

    .ui-unit-status__sauna-countdown {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
    }

    .ui-unit-status__sauna-countdown strong {
      font-weight: 600;
      font-size: clamp(14px, var(--radius) * 0.9, 24px);
      letter-spacing: 0.02em;
    }

    .ui-unit-status__sauna-countdown span {
      font-size: clamp(10px, var(--radius) * 0.45, 13px);
      color: rgba(148, 163, 184, 0.78);
    }

    .ui-unit-status__sauna-label {
      margin-top: calc(var(--radius) * 0.6);
      padding: 6px 14px;
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(30, 41, 59, 0.88));
      box-shadow: 0 8px 20px rgba(8, 25, 53, 0.45);
      border: 1px solid rgba(148, 197, 255, 0.28);
      font-weight: 600;
      font-size: clamp(12px, var(--radius) * 0.65, 18px);
    }
  `;

  document.head.appendChild(styleElement);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface UnitStatusViewBuff {
  id: string;
  ratio: number;
  stacks?: number;
  infinite: boolean;
}

function convertBuff(buff: UnitStatusBuff): UnitStatusViewBuff {
  const remaining = Number.isFinite(buff.remaining) ? (buff.remaining as number) : Infinity;
  const duration = Number.isFinite(buff.duration) ? (buff.duration as number) : Infinity;
  const ratio = duration === Infinity ? 1 : duration <= 0 ? 0 : clamp(remaining / duration, 0, 1);
  return {
    id: buff.id,
    ratio,
    stacks: buff.stacks,
    infinite: !Number.isFinite(buff.duration) || buff.duration === Infinity
  } satisfies UnitStatusViewBuff;
}

export interface UnitStatusLayer {
  render(frame: UnitStatusFrame): void;
  destroy(): void;
}

export function createUnitStatusLayer(options: UnitStatusLayerOptions): UnitStatusLayer {
  const { root, project, getZoom } = options;
  if (!root) {
    throw new Error('createUnitStatusLayer requires a valid overlay root element.');
  }

  ensureStyles();

  const host = document.createElement('div');
  host.className = 'ui-unit-status-layer';
  root.appendChild(host);

  const unitElements = new Map<string, UnitStatusElements>();
  let saunaElement: {
    host: HTMLElement;
    progress: HTMLElement;
    label: HTMLElement;
    countdown: HTMLElement;
  } | null = null;

  const renderUnit = (status: UnitStatusPayload): void => {
    const center = project(status.world);
    if (!center) {
      return;
    }
    const zoom = getZoom();
    const radiusPx = Math.max(2, status.radius * zoom);
    const hpRatio = status.maxHp > 0 ? clamp(status.hp / status.maxHp, 0, 1) : 0;
    const shieldRatio = status.maxHp > 0 ? clamp((status.shield ?? 0) / status.maxHp, 0, 1) : 0;
    const buffs = (status.buffs ?? []).slice(0, 4).map(convertBuff);

    let elements = unitElements.get(status.id);
    if (!elements) {
      const element = document.createElement('div');
      element.className = 'ui-unit-status';
      element.dataset.unitId = status.id;

      const anchor = document.createElement('div');
      anchor.className = 'ui-unit-status__anchor';

      const hp = document.createElement('div');
      hp.className = 'ui-unit-status__hp';

      const track = document.createElement('div');
      track.className = 'ui-unit-status__hp-track';
      const fill = document.createElement('div');
      fill.className = 'ui-unit-status__hp-fill';
      const shield = document.createElement('div');
      shield.className = 'ui-unit-status__hp-shield';
      const border = document.createElement('div');
      border.className = 'ui-unit-status__hp-border';

      hp.append(track, fill, shield, border);

      const buffsContainer = document.createElement('div');
      buffsContainer.className = 'ui-unit-status__buffs';

      anchor.append(hp, buffsContainer);
      element.append(anchor);
      host.appendChild(element);

      elements = { host: element, hpFill: fill, shield, buffs: buffsContainer };
      unitElements.set(status.id, elements);
    }

    elements.host.style.transform = `translate3d(${center.x}px, ${center.y}px, 0)`;
    elements.host.style.setProperty('--radius', `${radiusPx}px`);
    elements.host.style.setProperty('--hp-ratio', hpRatio.toFixed(4));
    elements.host.style.setProperty('--shield-ratio', shieldRatio.toFixed(4));
    elements.host.dataset.faction = status.faction ?? 'neutral';
    if (status.selected) {
      elements.host.classList.add('is-selected');
    } else {
      elements.host.classList.remove('is-selected');
    }

    const container = elements.buffs;
    container.textContent = '';
    for (const buff of buffs) {
      const pip = document.createElement('span');
      pip.className = 'ui-unit-status__pip';
      pip.style.setProperty('--pip-progress', buff.infinite ? '1' : buff.ratio.toFixed(3));
      pip.dataset.buffId = buff.id;
      if (buff.infinite) {
        pip.dataset.infinite = 'true';
      } else {
        pip.dataset.infinite = 'false';
      }
      if (buff.stacks && buff.stacks > 1) {
        const label = document.createElement('span');
        label.textContent = String(buff.stacks);
        pip.append(label);
      }
      container.appendChild(pip);
    }
  };

  const renderSauna = (status: SaunaStatusPayload | null): void => {
    if (!status || status.visible === false) {
      if (saunaElement) {
        saunaElement.host.remove();
        saunaElement = null;
      }
      return;
    }

    const center = project(status.world);
    if (!center) {
      return;
    }
    const zoom = getZoom();
    const radiusPx = Math.max(4, status.radius * zoom);
    const progress = clamp(status.progress ?? 0, 0, 1);

    if (!saunaElement) {
      const hostEl = document.createElement('div');
      hostEl.className = 'ui-unit-status__sauna';

      const anchor = document.createElement('div');
      anchor.className = 'ui-unit-status__sauna-anchor';

      const gauge = document.createElement('div');
      gauge.className = 'ui-unit-status__sauna-gauge';

      const ring = document.createElement('div');
      ring.className = 'ui-unit-status__sauna-ring';

      const progressEl = document.createElement('div');
      progressEl.className = 'ui-unit-status__sauna-progress';
      ring.appendChild(progressEl);

      const countdown = document.createElement('div');
      countdown.className = 'ui-unit-status__sauna-countdown';

      const labelStrong = document.createElement('strong');
      countdown.appendChild(labelStrong);
      const unitLabel = document.createElement('span');
      unitLabel.textContent = status.unitLabel ?? 'sec';
      countdown.appendChild(unitLabel);

      gauge.append(ring, countdown);

      const label = document.createElement('div');
      label.className = 'ui-unit-status__sauna-label';
      label.textContent = status.label ?? 'Sauna ♨️';

      anchor.append(gauge, label);
      hostEl.appendChild(anchor);
      host.appendChild(hostEl);

      saunaElement = { host: hostEl, progress: progressEl, label, countdown: labelStrong };
    }

    saunaElement.host.style.transform = `translate3d(${center.x}px, ${center.y}px, 0)`;
    saunaElement.host.style.setProperty('--radius', `${radiusPx}px`);
    saunaElement.progress.style.setProperty('--progress', progress.toFixed(4));
    saunaElement.countdown.textContent = String(Math.max(0, Math.ceil(status.countdown ?? 0)));
    if (status.label) {
      saunaElement.label.textContent = status.label;
    }
  };

  const render = (frame: UnitStatusFrame): void => {
    const seen = new Set<string>();
    for (const status of frame.units) {
      if (status.visible === false) {
        continue;
      }
      renderUnit(status);
      seen.add(status.id);
    }

    for (const [id, entry] of unitElements.entries()) {
      if (!seen.has(id)) {
        entry.host.remove();
        unitElements.delete(id);
      }
    }

    renderSauna(frame.sauna);
  };

  const destroy = () => {
    for (const entry of unitElements.values()) {
      entry.host.remove();
    }
    unitElements.clear();
    if (saunaElement) {
      saunaElement.host.remove();
      saunaElement = null;
    }
    host.remove();
  };

  return { render, destroy } satisfies UnitStatusLayer;
}
