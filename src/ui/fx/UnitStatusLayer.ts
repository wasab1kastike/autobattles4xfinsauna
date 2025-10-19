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
  buffElements: Map<string, HTMLElement>;
  buffOrder: string[];
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
      text-shadow: 0 8px 22px rgba(2, 6, 23, 0.55);
      contain: layout style;
    }

    .ui-unit-status__sauna-anchor {
      position: relative;
      transform: translate(-50%, -50%);
    }

    .ui-unit-status__sauna-ring {
      position: relative;
      width: calc(var(--ring-radius, var(--radius)) * 2);
      height: calc(var(--ring-radius, var(--radius)) * 2);
      border-radius: 999px;
      filter: drop-shadow(0 18px 44px rgba(8, 25, 53, 0.55));
    }

    .ui-unit-status__sauna-ring::before,
    .ui-unit-status__sauna-ring::after,
    .ui-unit-status__sauna-progress,
    .ui-unit-status__sauna-ring-glow {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      mask: radial-gradient(
        farthest-side,
        transparent calc(100% - var(--ring-thickness, 14px)),
        rgba(0, 0, 0, 0.9) calc(100% - var(--ring-thickness, 14px))
      );
      -webkit-mask: radial-gradient(
        farthest-side,
        transparent calc(100% - var(--ring-thickness, 14px)),
        rgba(0, 0, 0, 0.9) calc(100% - var(--ring-thickness, 14px))
      );
    }

    .ui-unit-status__sauna-ring::before {
      background: conic-gradient(
        from var(--ring-start, -90deg),
        rgba(30, 41, 59, 0.88) 0deg,
        rgba(30, 41, 59, 0.88) 360deg
      );
      box-shadow: inset 0 0 0 max(1px, var(--ring-thickness, 14px) * 0.12) rgba(148, 197, 255, 0.32);
      opacity: 0.92;
    }

    .ui-unit-status__sauna-ring::after {
      background: conic-gradient(
        from var(--ring-start, -90deg),
        rgba(56, 189, 248, 0.16) 0deg,
        rgba(56, 189, 248, 0.5) calc(var(--progress, 0) * 360deg),
        rgba(56, 189, 248, 0) calc(var(--progress, 0) * 360deg)
      );
      filter: blur(calc(var(--ring-thickness, 14px) * 0.9));
      opacity: 0.55;
      mix-blend-mode: screen;
    }

    .ui-unit-status__sauna-progress {
      background: conic-gradient(
        from var(--ring-start, -90deg),
        rgba(56, 189, 248, 0.2) 0deg,
        rgba(56, 189, 248, 0.96) calc(var(--progress, 0) * 360deg),
        rgba(56, 189, 248, 0) calc(var(--progress, 0) * 360deg)
      );
      mix-blend-mode: screen;
      filter: drop-shadow(0 0 calc(var(--ring-thickness, 14px) * 1.15) rgba(56, 189, 248, 0.68));
    }

    .ui-unit-status__sauna-ring-glow {
      inset: calc(var(--ring-thickness, 14px) * 0.65);
      background: radial-gradient(
        circle,
        rgba(56, 189, 248, 0.26),
        rgba(56, 189, 248, 0.05) 55%,
        rgba(15, 23, 42, 0) 70%
      );
      mix-blend-mode: screen;
    }

    .ui-unit-status__sauna-marker {
      position: absolute;
      top: 50%;
      left: 50%;
      width: calc(var(--ring-thickness, 14px) * 0.7);
      height: calc(var(--ring-thickness, 14px) * 0.7);
      border-radius: 999px;
      background: radial-gradient(circle, rgba(226, 232, 240, 0.98), rgba(56, 189, 248, 0.25));
      box-shadow: 0 0 calc(var(--ring-thickness, 14px)) rgba(56, 189, 248, 0.65);
      transform: rotate(calc(var(--ring-start, -90deg) + var(--progress, 0) * 360deg))
        translateX(var(--marker-radius, var(--ring-radius, var(--radius))))
        translate(-50%, -50%);
      mix-blend-mode: screen;
      opacity: clamp(0, calc(var(--progress, 0) * 4), 1);
      transition: opacity 120ms ease-out;
    }

    .ui-unit-status__sauna-badge {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: rotate(var(--badge-angle, 0deg))
        translateX(var(--badge-radius, calc(var(--ring-radius, var(--radius)) * 1.4)))
        rotate(calc(-1 * var(--badge-angle, 0deg)));
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      min-width: clamp(76px, var(--ring-radius, var(--radius)) * 1.22, 140px);
      padding: clamp(6px, var(--ring-thickness, 14px) * 0.45, 10px)
        clamp(12px, var(--ring-thickness, 14px) * 0.9, 18px);
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.88));
      border: 1px solid rgba(148, 197, 255, 0.35);
      box-shadow: 0 12px 34px rgba(8, 25, 53, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(8px);
    }

    .ui-unit-status__sauna-countdown {
      display: flex;
      align-items: baseline;
      gap: clamp(4px, var(--ring-thickness, 14px) * 0.28, 8px);
      font-feature-settings: 'tnum' 1;
    }

    .ui-unit-status__sauna-countdown strong {
      font-weight: 600;
      font-size: clamp(18px, var(--ring-thickness, 14px) * 1.2, 30px);
      letter-spacing: 0.04em;
    }

    .ui-unit-status__sauna-countdown span {
      font-size: clamp(11px, var(--ring-thickness, 14px) * 0.6, 14px);
      color: rgba(148, 163, 184, 0.82);
      text-transform: uppercase;
      letter-spacing: 0.16em;
    }

    .ui-unit-status__sauna-label {
      font-weight: 600;
      font-size: clamp(12px, var(--ring-thickness, 14px) * 0.72, 16px);
      letter-spacing: 0.06em;
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
    countdown: HTMLElement;
    unit: HTMLElement;
    label: HTMLElement;
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

      elements = {
        host: element,
        hpFill: fill,
        shield,
        buffs: buffsContainer,
        buffElements: new Map(),
        buffOrder: []
      } satisfies UnitStatusElements;
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
    const { buffElements } = elements;
    const nextOrder: string[] = [];
    let nextSibling: ChildNode | null = container.firstChild;

    for (const buff of buffs) {
      nextOrder.push(buff.id);

      let pip = buffElements.get(buff.id);
      if (!pip) {
        pip = document.createElement('span');
        pip.className = 'ui-unit-status__pip';
        pip.dataset.buffId = buff.id;
        buffElements.set(buff.id, pip);
      }

      const progressValue = buff.infinite ? '1' : buff.ratio.toFixed(3);
      if (pip.style.getPropertyValue('--pip-progress') !== progressValue) {
        pip.style.setProperty('--pip-progress', progressValue);
      }
      pip.dataset.infinite = buff.infinite ? 'true' : 'false';

      if (buff.stacks && buff.stacks > 1) {
        let label = pip.querySelector('span');
        if (!label) {
          label = document.createElement('span');
          pip.append(label);
        }
        if (label.textContent !== String(buff.stacks)) {
          label.textContent = String(buff.stacks);
        }
      } else {
        const label = pip.querySelector('span');
        if (label) {
          label.remove();
        }
      }

      if (pip.parentElement !== container) {
        container.insertBefore(pip, nextSibling);
      } else if (pip !== nextSibling) {
        container.insertBefore(pip, nextSibling);
      }
      nextSibling = pip.nextSibling;
    }

    if (nextSibling) {
      while (nextSibling) {
        const current = nextSibling;
        nextSibling = current.nextSibling;
        if (current instanceof HTMLElement && current.dataset.buffId) {
          buffElements.delete(current.dataset.buffId);
        }
        current.remove();
      }
    }

    const nextOrderSet = new Set(nextOrder);
    for (const buffId of Array.from(buffElements.keys())) {
      if (!nextOrderSet.has(buffId)) {
        const pip = buffElements.get(buffId);
        if (pip) {
          pip.remove();
        }
        buffElements.delete(buffId);
      }
    }

    elements.buffOrder = nextOrder;
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
    const geometry = status.geometry;
    const ringRadiusWorld = geometry?.ringRadius ?? status.radius;
    const ringThicknessWorld = geometry?.ringThickness ?? ringRadiusWorld * 0.3;
    const badgeRadiusWorld = geometry?.badgeRadius ?? ringRadiusWorld + ringThicknessWorld * 0.9;
    const markerRadiusWorld = geometry?.markerRadius ?? Math.max(ringRadiusWorld - ringThicknessWorld * 0.45, ringThicknessWorld);
    const startAngleRad = geometry?.startAngle ?? -Math.PI / 2;
    const badgeAngleRad = geometry?.badgeAngle ?? startAngleRad;
    const ringRadiusPx = Math.max(4, ringRadiusWorld * zoom);
    const ringThicknessPx = Math.max(3, ringThicknessWorld * zoom);
    const badgeRadiusPx = Math.max(ringRadiusPx, badgeRadiusWorld * zoom);
    const markerRadiusPx = Math.max(0, markerRadiusWorld * zoom);
    const progress = clamp(status.progress ?? 0, 0, 1);
    const progressValue = progress.toFixed(4);

    if (!saunaElement) {
      const hostEl = document.createElement('div');
      hostEl.className = 'ui-unit-status__sauna';

      const anchor = document.createElement('div');
      anchor.className = 'ui-unit-status__sauna-anchor';

      const ring = document.createElement('div');
      ring.className = 'ui-unit-status__sauna-ring';

      const progressEl = document.createElement('div');
      progressEl.className = 'ui-unit-status__sauna-progress';
      const glow = document.createElement('div');
      glow.className = 'ui-unit-status__sauna-ring-glow';
      const marker = document.createElement('div');
      marker.className = 'ui-unit-status__sauna-marker';
      ring.append(progressEl, glow, marker);

      const badge = document.createElement('div');
      badge.className = 'ui-unit-status__sauna-badge';

      const countdown = document.createElement('div');
      countdown.className = 'ui-unit-status__sauna-countdown';

      const countdownValue = document.createElement('strong');
      countdown.appendChild(countdownValue);
      const unitLabel = document.createElement('span');
      countdown.appendChild(unitLabel);

      const label = document.createElement('div');
      label.className = 'ui-unit-status__sauna-label';

      badge.append(countdown, label);
      anchor.append(ring, badge);
      hostEl.appendChild(anchor);
      host.appendChild(hostEl);

      saunaElement = {
        host: hostEl,
        progress: progressEl,
        countdown: countdownValue,
        unit: unitLabel,
        label
      };
    }

    saunaElement.host.style.transform = `translate3d(${center.x}px, ${center.y}px, 0)`;
    saunaElement.host.style.setProperty('--radius', `${ringRadiusPx + ringThicknessPx}px`);
    saunaElement.host.style.setProperty('--ring-radius', `${ringRadiusPx}px`);
    saunaElement.host.style.setProperty('--ring-thickness', `${ringThicknessPx}px`);
    saunaElement.host.style.setProperty('--badge-radius', `${badgeRadiusPx}px`);
    saunaElement.host.style.setProperty('--marker-radius', `${markerRadiusPx}px`);
    saunaElement.host.style.setProperty('--ring-start', `${(startAngleRad * 180) / Math.PI}deg`);
    saunaElement.host.style.setProperty('--badge-angle', `${(badgeAngleRad * 180) / Math.PI}deg`);
    saunaElement.host.style.setProperty('--progress', progressValue);
    saunaElement.progress.style.setProperty('--progress', progressValue);
    saunaElement.countdown.textContent = String(Math.max(0, Math.ceil(status.countdown ?? 0)));
    saunaElement.unit.textContent = status.unitLabel ?? 'sec';
    saunaElement.label.textContent = status.label ?? 'Sauna ♨️';
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
