import type { PixelCoord } from '../../hex/HexUtils.ts';
import { axialToPixel } from '../../hex/HexUtils.ts';
import { getFactionAccent } from '../../theme/factionPalette.ts';
import type {
  SelectionItemSlot,
  SelectionStatusChip,
  UnitSelectionPayload
} from './types.ts';
import type { UnitBehavior } from '../../unit/types.ts';

interface SelectionMiniHudOptions {
  root: HTMLElement;
  project: (point: PixelCoord, offsetY?: number) => PixelCoord | null;
  getVerticalLift: () => number;
  getHexSize: () => number;
  onBehaviorChange?: (unitId: string, behavior: UnitBehavior) => void;
  behaviorMeta?: {
    order: readonly UnitBehavior[];
    labels: Record<UnitBehavior, string>;
  };
}

interface SelectionMiniHudElements {
  host: HTMLElement;
  entry: HTMLElement;
  anchor: HTMLElement;
  card: HTMLElement;
  name: HTMLElement;
  subtitle: HTMLElement;
  faction: HTMLElement;
  behaviorRow: HTMLElement;
  behaviorValue: HTMLElement;
  behaviorOptions: HTMLElement;
  hpValue: HTMLElement;
  hpMeter: HTMLElement;
  hpFill: HTMLElement;
  shieldFill: HTMLElement;
  items: HTMLElement;
  statuses: HTMLElement;
}

interface SelectionMiniHudState {
  payload: UnitSelectionPayload | null;
  status: PixelCoord | null;
  hp: number;
  maxHp: number;
  shield: number;
  behavior: UnitBehavior | null;
  behaviorInteractive: boolean;
}

let styleElement: HTMLStyleElement | null = null;

const rarityAccents = new Map<string, { base: string; glow: string }>([
  ['common', { base: 'rgba(148, 163, 184, 0.38)', glow: 'rgba(226, 232, 240, 0.18)' }],
  ['uncommon', { base: 'rgba(16, 185, 129, 0.42)', glow: 'rgba(56, 189, 248, 0.18)' }],
  ['rare', { base: 'rgba(59, 130, 246, 0.48)', glow: 'rgba(147, 197, 253, 0.3)' }],
  ['epic', { base: 'rgba(147, 51, 234, 0.58)', glow: 'rgba(244, 114, 182, 0.3)' }],
  ['legendary', { base: 'rgba(234, 179, 8, 0.58)', glow: 'rgba(253, 224, 71, 0.35)' }],
  ['mythic', { base: 'rgba(236, 72, 153, 0.65)', glow: 'rgba(217, 70, 239, 0.38)' }]
]);

const neutralAccent = { tint: 'rgba(165, 180, 252, 0.85)', halo: 'rgba(129, 140, 248, 0.35)' } as const;

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function ensureStyles(): void {
  if (styleElement || typeof document === 'undefined') {
    return;
  }

  styleElement = document.createElement('style');
  styleElement.id = 'selection-mini-hud-styles';
  styleElement.textContent = `
    .ui-selection-mini-hud-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 12;
      contain: layout style;
    }

    .ui-selection-mini-hud {
      position: absolute;
      transform: translate3d(0, 0, 0);
      will-change: transform;
      opacity: 0;
      transition: opacity 120ms ease, transform 120ms ease;
      pointer-events: none;
    }

    .ui-selection-mini-hud[data-visible='true'] {
      opacity: 1;
    }

    .ui-selection-mini-hud__anchor {
      transform: translate(-50%, calc(-100% - 18px));
    }

    .ui-selection-mini-hud__card {
      min-width: 220px;
      max-width: 260px;
      padding: 14px 18px;
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.86), rgba(30, 41, 59, 0.72));
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow:
        0 18px 48px rgba(8, 25, 53, 0.45),
        0 0 24px rgba(14, 116, 144, 0.25);
      backdrop-filter: blur(20px);
      font-family: "Inter", "Manrope", "Segoe UI", sans-serif;
      color: rgba(241, 245, 249, 0.96);
      position: relative;
      overflow: hidden;
      pointer-events: auto;
    }

    .ui-selection-mini-hud__card::before {
      content: '';
      position: absolute;
      inset: -40%;
      background: radial-gradient(circle at 20% 20%, var(--hud-accent-halo, rgba(56, 189, 248, 0.25)), transparent 70%);
      opacity: 0.9;
      transform: rotate(8deg);
    }

    .ui-selection-mini-hud__card::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
      mix-blend-mode: screen;
      pointer-events: none;
    }

    .ui-selection-mini-hud__header {
      position: relative;
      z-index: 1;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
    }

    .ui-selection-mini-hud__title-block {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }

    .ui-selection-mini-hud__title {
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 0.01em;
      text-shadow: 0 8px 16px rgba(2, 6, 23, 0.45);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ui-selection-mini-hud__subtitle {
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(203, 213, 225, 0.78);
      text-shadow: 0 8px 18px rgba(15, 118, 175, 0.38);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 0.95;
    }

    .ui-selection-mini-hud__subtitle::before {
      content: '';
      display: block;
      width: 22px;
      height: 1px;
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(148, 163, 184, 0.08), rgba(148, 163, 184, 0.52));
    }

    .ui-selection-mini-hud__faction {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 600;
      color: rgba(226, 232, 240, 0.68);
      padding: 4px 8px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: linear-gradient(120deg, rgba(15, 23, 42, 0.6), rgba(30, 64, 175, 0.28));
    }

    .ui-selection-mini-hud__hp {
      position: relative;
      z-index: 1;
      margin-bottom: 16px;
      display: grid;
      gap: 6px;
    }

    .ui-selection-mini-hud__behavior {
      position: relative;
      z-index: 1;
      margin-bottom: 16px;
      display: grid;
      gap: 8px;
    }

    .ui-selection-mini-hud__behavior-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }

    .ui-selection-mini-hud__behavior-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: rgba(148, 163, 184, 0.85);
      font-weight: 600;
    }

    .ui-selection-mini-hud__behavior-value {
      font-size: 0.8rem;
      font-weight: 600;
      color: rgba(226, 232, 240, 0.92);
      text-shadow: 0 6px 16px rgba(15, 23, 42, 0.6);
    }

    .ui-selection-mini-hud__behavior-options {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }

    .ui-selection-mini-hud__behavior-options[aria-disabled='true'] {
      opacity: 0.6;
    }

    .ui-selection-mini-hud__behavior-option {
      position: relative;
      z-index: 1;
      padding: 6px 14px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.75), rgba(15, 23, 42, 0.78));
      color: rgba(226, 232, 240, 0.9);
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
      box-shadow: 0 12px 28px rgba(8, 25, 53, 0.32);
    }

    .ui-selection-mini-hud__behavior-option:is(:hover, :focus-visible) {
      transform: translateY(-2px);
      box-shadow: 0 16px 32px rgba(14, 116, 144, 0.32);
      background: linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(15, 23, 42, 0.82));
      outline: none;
    }

    .ui-selection-mini-hud__behavior-option.is-active {
      background: linear-gradient(135deg, rgba(56, 189, 248, 0.35), rgba(14, 116, 144, 0.42));
      border-color: rgba(125, 211, 252, 0.6);
      color: rgba(226, 232, 240, 0.98);
      box-shadow: 0 16px 36px rgba(14, 116, 144, 0.45);
    }

    .ui-selection-mini-hud__behavior-option:disabled {
      cursor: default;
      opacity: 0.5;
      transform: none;
      box-shadow: 0 10px 20px rgba(15, 23, 42, 0.28);
    }

    .ui-selection-mini-hud__hp-label {
      font-size: 0.7rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(148, 163, 184, 0.85);
      font-weight: 600;
    }

    .ui-selection-mini-hud__hp-meter {
      position: relative;
      height: 12px;
      border-radius: 999px;
      overflow: hidden;
      background: linear-gradient(90deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.6));
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: inset 0 2px 8px rgba(8, 25, 53, 0.55);
    }

    .ui-selection-mini-hud__hp-fill,
    .ui-selection-mini-hud__shield-fill {
      position: absolute;
      inset: 0;
      transition: width 180ms ease-out, opacity 180ms ease-out;
    }

    .ui-selection-mini-hud__hp-fill {
      background: linear-gradient(90deg, rgba(148, 255, 198, 0.95), rgba(56, 189, 248, 0.75));
      width: calc(var(--hp-ratio, 0) * 100%);
    }

    .ui-selection-mini-hud__shield-fill {
      background: linear-gradient(90deg, rgba(191, 219, 254, 0.9), rgba(129, 140, 248, 0.85));
      mix-blend-mode: screen;
      width: calc(var(--shield-ratio, 0) * 100%);
      opacity: clamp(var(--shield-opacity, 0), 0, 1);
    }

    .ui-selection-mini-hud__hp-value {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      color: rgba(226, 232, 240, 0.95);
      text-shadow: 0 4px 12px rgba(15, 23, 42, 0.65);
      font-size: 0.85rem;
    }

    .ui-selection-mini-hud__shield-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(125, 211, 252, 0.12);
      border: 1px solid rgba(125, 211, 252, 0.4);
      color: rgba(191, 219, 254, 0.92);
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.04em;
    }

    .ui-selection-mini-hud__items {
      position: relative;
      z-index: 1;
      display: flex;
      gap: 10px;
      margin-bottom: 14px;
    }

    .ui-selection-mini-hud__item {
      position: relative;
      width: 54px;
      height: 54px;
      border-radius: 16px;
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.82), rgba(15, 23, 42, 0.9));
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), 0 10px 24px rgba(8, 25, 53, 0.42);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      filter: drop-shadow(0 8px 20px rgba(14, 116, 144, 0.24));
    }

    .ui-selection-mini-hud__item::after {
      content: '';
      position: absolute;
      inset: 2px;
      border-radius: inherit;
      background: var(--slot-gradient, rgba(15, 23, 42, 0.6));
      opacity: 0.95;
    }

    .ui-selection-mini-hud__item[data-empty='true']::after {
      background: rgba(15, 23, 42, 0.4);
      opacity: 0.6;
    }

    .ui-selection-mini-hud__item-visual {
      position: relative;
      z-index: 1;
      width: 60%;
      height: 60%;
      background-size: cover;
      background-position: center;
      border-radius: 12px;
      box-shadow: 0 8px 18px rgba(8, 25, 53, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: rgba(226, 232, 240, 0.92);
    }

    .ui-selection-mini-hud__item-quantity {
      position: absolute;
      right: 4px;
      bottom: 4px;
      padding: 2px 6px;
      border-radius: 999px;
      font-size: 0.65rem;
      font-weight: 600;
      background: rgba(15, 23, 42, 0.82);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: rgba(226, 232, 240, 0.92);
      z-index: 2;
      letter-spacing: 0.04em;
    }

    .ui-selection-mini-hud__statuses {
      position: relative;
      z-index: 1;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .ui-selection-mini-hud__status {
      padding: 4px 10px;
      border-radius: 999px;
      background: linear-gradient(135deg, rgba(51, 65, 85, 0.7), rgba(15, 23, 42, 0.6));
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 12px 24px rgba(8, 25, 53, 0.32);
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: rgba(226, 232, 240, 0.92);
      text-transform: uppercase;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .ui-selection-mini-hud__status[data-variant='infinite'] {
      background: linear-gradient(135deg, rgba(244, 114, 182, 0.72), rgba(30, 64, 175, 0.58));
      border-color: rgba(244, 114, 182, 0.52);
    }

    .ui-selection-mini-hud__status-badge {
      font-weight: 700;
      font-size: 0.7rem;
      letter-spacing: 0.08em;
      color: rgba(15, 23, 42, 0.85);
      background: rgba(255, 255, 255, 0.82);
      border-radius: 999px;
      padding: 2px 6px;
    }
  `;

  document.head.appendChild(styleElement);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function resolveFactionAccent(faction: string): { tint: string; halo: string } {
  const normalized = faction?.toLowerCase?.() ?? '';
  if (normalized === 'player' || normalized === 'enemy') {
    return getFactionAccent(normalized);
  }
  if (normalized === 'neutral') {
    return neutralAccent;
  }
  return {
    tint: 'rgba(148, 163, 184, 0.82)',
    halo: 'rgba(148, 163, 184, 0.32)'
  };
}

function createElements(root: HTMLElement): SelectionMiniHudElements {
  ensureStyles();

  const host = document.createElement('div');
  host.className = 'ui-selection-mini-hud-layer';
  root.appendChild(host);

  const entry = document.createElement('div');
  entry.className = 'ui-selection-mini-hud';
  host.appendChild(entry);

  const anchor = document.createElement('div');
  anchor.className = 'ui-selection-mini-hud__anchor';
  entry.appendChild(anchor);

  const card = document.createElement('article');
  card.className = 'ui-selection-mini-hud__card';
  anchor.appendChild(card);

  const header = document.createElement('header');
  header.className = 'ui-selection-mini-hud__header';
  card.appendChild(header);

  const titleBlock = document.createElement('div');
  titleBlock.className = 'ui-selection-mini-hud__title-block';
  header.appendChild(titleBlock);

  const name = document.createElement('span');
  name.className = 'ui-selection-mini-hud__title';
  titleBlock.appendChild(name);

  const subtitle = document.createElement('span');
  subtitle.className = 'ui-selection-mini-hud__subtitle';
  subtitle.hidden = true;
  titleBlock.appendChild(subtitle);

  const faction = document.createElement('span');
  faction.className = 'ui-selection-mini-hud__faction';
  header.appendChild(faction);

  const behaviorRow = document.createElement('div');
  behaviorRow.className = 'ui-selection-mini-hud__behavior';
  behaviorRow.hidden = true;
  const behaviorHeader = document.createElement('div');
  behaviorHeader.className = 'ui-selection-mini-hud__behavior-header';
  const behaviorLabel = document.createElement('span');
  behaviorLabel.className = 'ui-selection-mini-hud__behavior-label';
  behaviorLabel.textContent = 'Behavior';
  const behaviorValue = document.createElement('span');
  behaviorValue.className = 'ui-selection-mini-hud__behavior-value';
  behaviorHeader.append(behaviorLabel, behaviorValue);
  behaviorRow.appendChild(behaviorHeader);
  const behaviorOptions = document.createElement('div');
  behaviorOptions.className = 'ui-selection-mini-hud__behavior-options';
  behaviorOptions.setAttribute('role', 'group');
  behaviorRow.appendChild(behaviorOptions);
  card.appendChild(behaviorRow);

  const hpBlock = document.createElement('div');
  hpBlock.className = 'ui-selection-mini-hud__hp';
  card.appendChild(hpBlock);

  const hpLabel = document.createElement('span');
  hpLabel.className = 'ui-selection-mini-hud__hp-label';
  hpLabel.textContent = 'Vitality';
  hpBlock.appendChild(hpLabel);

  const hpMeter = document.createElement('div');
  hpMeter.className = 'ui-selection-mini-hud__hp-meter';
  hpBlock.appendChild(hpMeter);

  const hpFill = document.createElement('span');
  hpFill.className = 'ui-selection-mini-hud__hp-fill';
  hpMeter.appendChild(hpFill);

  const shieldFill = document.createElement('span');
  shieldFill.className = 'ui-selection-mini-hud__shield-fill';
  hpMeter.appendChild(shieldFill);

  const hpValue = document.createElement('div');
  hpValue.className = 'ui-selection-mini-hud__hp-value';
  hpBlock.appendChild(hpValue);

  const items = document.createElement('div');
  items.className = 'ui-selection-mini-hud__items';
  card.appendChild(items);

  const statuses = document.createElement('div');
  statuses.className = 'ui-selection-mini-hud__statuses';
  card.appendChild(statuses);

  return {
    host,
    entry,
    anchor,
    card,
    name,
    faction,
    subtitle,
    behaviorRow,
    behaviorValue,
    behaviorOptions,
    hpValue,
    hpMeter,
    hpFill,
    shieldFill,
    items,
    statuses
  } satisfies SelectionMiniHudElements;
}

function renderItems(target: HTMLElement, items: readonly SelectionItemSlot[]): void {
  target.replaceChildren();
  const visible = items.slice(0, 3);
  const overflow = Math.max(0, items.length - visible.length);

  for (const item of visible) {
    const slot = document.createElement('div');
    slot.className = 'ui-selection-mini-hud__item';
    const rarity = typeof item.rarity === 'string' ? item.rarity.toLowerCase() : '';
    const accent = rarityAccents.get(rarity);
    if (accent) {
      slot.style.setProperty('--slot-gradient', `linear-gradient(135deg, ${accent.base}, ${accent.glow})`);
    } else {
      slot.style.setProperty('--slot-gradient', 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.6))');
    }

    const visual = document.createElement('div');
    visual.className = 'ui-selection-mini-hud__item-visual';
    const icon = item.icon?.trim();
    if (icon) {
      visual.style.backgroundImage = `url('${icon}')`;
      visual.textContent = '';
    } else {
      visual.textContent = item.name?.charAt(0)?.toUpperCase() ?? '—';
    }
    slot.appendChild(visual);

    const quantity = typeof item.quantity === 'number' && item.quantity > 1 ? Math.floor(item.quantity) : null;
    if (quantity) {
      const badge = document.createElement('span');
      badge.className = 'ui-selection-mini-hud__item-quantity';
      badge.textContent = numberFormatter.format(quantity);
      slot.appendChild(badge);
    }

    target.appendChild(slot);
  }

  if (overflow > 0) {
    const slot = document.createElement('div');
    slot.className = 'ui-selection-mini-hud__item';
    slot.style.setProperty('--slot-gradient', 'linear-gradient(135deg, rgba(30, 64, 175, 0.52), rgba(56, 189, 248, 0.32))');
    const visual = document.createElement('div');
    visual.className = 'ui-selection-mini-hud__item-visual';
    visual.textContent = `+${overflow}`;
    slot.appendChild(visual);
    target.appendChild(slot);
  }

  if (visible.length === 0 && overflow === 0) {
    for (let i = 0; i < 3; i++) {
      const slot = document.createElement('div');
      slot.className = 'ui-selection-mini-hud__item';
      slot.dataset.empty = 'true';
      slot.style.setProperty('--slot-gradient', 'linear-gradient(135deg, rgba(15, 23, 42, 0.25), rgba(30, 41, 59, 0.18))');
      const visual = document.createElement('div');
      visual.className = 'ui-selection-mini-hud__item-visual';
      visual.textContent = '—';
      slot.appendChild(visual);
      target.appendChild(slot);
    }
  }
}

function formatRemaining(seconds: number | typeof Infinity | undefined): string | null {
  if (seconds === undefined) {
    return null;
  }
  if (seconds === Infinity) {
    return '∞';
  }
  const safe = clamp(seconds, 0, 9999);
  if (safe >= 90) {
    return `${Math.round(safe / 60)}m`;
  }
  if (safe >= 10) {
    return `${Math.round(safe)}s`;
  }
  return `${Math.max(1, Math.round(safe))}s`;
}

function renderStatuses(target: HTMLElement, statuses: readonly SelectionStatusChip[]): void {
  target.replaceChildren();
  const visible = statuses.slice(0, 3);
  for (const status of visible) {
    const chip = document.createElement('span');
    chip.className = 'ui-selection-mini-hud__status';
    const remaining = formatRemaining(status.remaining);
    if (status.remaining === Infinity) {
      chip.dataset.variant = 'infinite';
    }
    const label = document.createElement('span');
    label.textContent = status.label;
    chip.appendChild(label);
    if (typeof status.stacks === 'number' && status.stacks > 1) {
      const stacks = document.createElement('span');
      stacks.className = 'ui-selection-mini-hud__status-badge';
      stacks.textContent = `×${numberFormatter.format(status.stacks)}`;
      chip.appendChild(stacks);
    }
    if (remaining && status.remaining !== Infinity) {
      const time = document.createElement('span');
      time.className = 'ui-selection-mini-hud__status-badge';
      time.textContent = remaining;
      chip.appendChild(time);
    }
    target.appendChild(chip);
  }
}

export interface SelectionMiniHud {
  setSelection(payload: UnitSelectionPayload | null): void;
  updateStatus(world: PixelCoord | null, hp?: number, maxHp?: number, shield?: number): void;
  refreshPosition(): void;
  setBehaviorInteractivity(enabled: boolean): void;
  destroy(): void;
}

export function createSelectionMiniHud(options: SelectionMiniHudOptions): SelectionMiniHud {
  const elements = createElements(options.root);
  const state: SelectionMiniHudState = {
    payload: null,
    status: null,
    hp: 0,
    maxHp: 1,
    shield: 0,
    behavior: null,
    behaviorInteractive: Boolean(options.onBehaviorChange)
  } satisfies SelectionMiniHudState;
  const behaviorButtons = new Map<UnitBehavior, HTMLButtonElement>();

  function updateHpDisplay(): void {
    const hp = clamp(state.hp, 0, Math.max(1, state.maxHp));
    const max = Math.max(1, state.maxHp);
    const shield = clamp(state.shield, 0, 9999);
    const ratio = clamp(max > 0 ? hp / max : 0, 0, 1);
    const shieldRatio = clamp(max > 0 ? (hp + shield) / max : 0, 0, 1);

    elements.hpMeter.style.setProperty('--hp-ratio', `${ratio}`);
    elements.hpMeter.style.setProperty('--shield-ratio', `${shieldRatio}`);
    elements.hpMeter.style.setProperty('--shield-opacity', `${shield > 0 ? 1 : 0}`);

    const pieces = [`${numberFormatter.format(Math.round(hp))} / ${numberFormatter.format(Math.round(max))}`];
    elements.hpValue.replaceChildren();
    elements.hpValue.append(document.createTextNode(pieces[0]));
    if (shield > 0) {
      const badge = document.createElement('span');
      badge.className = 'ui-selection-mini-hud__shield-badge';
      badge.textContent = `+${numberFormatter.format(Math.round(shield))}`;
      elements.hpValue.appendChild(badge);
    }
  }

  function updateBehaviorDisplay(): void {
    const meta = options.behaviorMeta;
    const payload = state.payload;
    const behavior = state.behavior;

    if (!meta || !payload || !behavior) {
      elements.behaviorRow.hidden = true;
      elements.behaviorOptions.setAttribute('aria-disabled', 'true');
      for (const button of behaviorButtons.values()) {
        button.classList.remove('is-active');
        button.setAttribute('aria-pressed', 'false');
        button.disabled = true;
      }
      return;
    }

    elements.behaviorRow.hidden = false;
    const label = meta.labels[behavior] ?? behavior;
    elements.behaviorValue.textContent = label;
    elements.behaviorValue.title = `Behavior: ${label}`;
    const hasHandler = state.behaviorInteractive;
    elements.behaviorOptions.setAttribute('aria-disabled', hasHandler ? 'false' : 'true');
    elements.behaviorOptions.setAttribute(
      'aria-label',
      `${payload.name?.trim() || 'Unit'} behavior`
    );

    for (const [value, button] of behaviorButtons.entries()) {
      const buttonLabel = meta.labels[value] ?? value;
      button.textContent = buttonLabel;
      button.title = `Set behavior to ${buttonLabel}`;
      button.setAttribute('aria-label', `Set behavior to ${buttonLabel}`);
      const isActive = value === behavior;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      button.disabled = !hasHandler;
    }
  }

  if (options.behaviorMeta) {
    for (const behavior of options.behaviorMeta.order) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ui-selection-mini-hud__behavior-option';
      button.dataset.behavior = behavior;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        if (!state.payload || !options.behaviorMeta) {
          return;
        }
        if (behavior === state.behavior) {
          return;
        }
        if (!state.behaviorInteractive) {
          return;
        }
        state.behavior = behavior;
        updateBehaviorDisplay();
        options.onBehaviorChange?.(state.payload.id, behavior);
      });
      behaviorButtons.set(behavior, button);
      elements.behaviorOptions.appendChild(button);
    }
  }

  function applyFactionAccent(faction: string): void {
    const accent = resolveFactionAccent(faction);
    elements.card.style.setProperty('--hud-accent-tint', accent.tint);
    elements.card.style.setProperty('--hud-accent-halo', accent.halo);
  }

  function show(): void {
    elements.entry.dataset.visible = 'true';
    elements.entry.style.opacity = '1';
  }

  function hide(): void {
    elements.entry.dataset.visible = 'false';
    elements.entry.style.opacity = '0';
  }

  function refreshPosition(): void {
    if (!state.payload) {
      hide();
      return;
    }

    const lift = options.getVerticalLift();
    let world = state.status;
    if (!world) {
      const { q, r } = state.payload.coord;
      world = axialToPixel({ q, r }, options.getHexSize());
    }

    const projected = options.project(world, lift);
    if (!projected) {
      hide();
      return;
    }

    elements.entry.style.transform = `translate3d(${projected.x}px, ${projected.y}px, 0)`;
    elements.entry.dataset.visible = 'true';
    elements.card.style.setProperty('--hud-accent-tint', resolveFactionAccent(state.payload.faction).tint);
    elements.card.style.setProperty('--hud-accent-halo', resolveFactionAccent(state.payload.faction).halo);
    elements.entry.style.opacity = '1';
  }

  function setSelection(payload: UnitSelectionPayload | null): void {
    state.payload = payload;
    state.status = null;
    state.behavior = payload?.behavior ?? null;
    if (!payload) {
      hide();
      updateBehaviorDisplay();
      elements.subtitle.textContent = '';
      elements.subtitle.hidden = true;
      return;
    }

    elements.name.textContent = payload.name ?? '—';
    const classLabel = typeof payload.className === 'string' ? payload.className.trim() : '';
    if (classLabel) {
      elements.subtitle.textContent = classLabel;
      elements.subtitle.hidden = false;
    } else {
      elements.subtitle.textContent = '';
      elements.subtitle.hidden = true;
    }
    elements.faction.textContent = payload.faction?.toUpperCase?.() ?? '—';
    applyFactionAccent(payload.faction);

    state.hp = payload.hp;
    state.maxHp = Math.max(1, payload.maxHp);
    state.shield = Math.max(0, payload.shield ?? 0);

    updateHpDisplay();
    renderItems(elements.items, payload.items ?? []);
    renderStatuses(elements.statuses, payload.statuses ?? []);
    updateBehaviorDisplay();

    show();
    refreshPosition();
  }

  function updateStatus(world: PixelCoord | null, hp?: number, maxHp?: number, shield?: number): void {
    if (!state.payload) {
      return;
    }
    if (world) {
      state.status = { x: world.x, y: world.y } satisfies PixelCoord;
    }
    if (typeof hp === 'number') {
      state.hp = hp;
    }
    if (typeof maxHp === 'number' && maxHp > 0) {
      state.maxHp = maxHp;
    }
    if (typeof shield === 'number') {
      state.shield = Math.max(0, shield);
    }
    updateHpDisplay();
    refreshPosition();
  }

  function setBehaviorInteractivity(enabled: boolean): void {
    if (state.behaviorInteractive === enabled) {
      return;
    }
    state.behaviorInteractive = enabled;
    updateBehaviorDisplay();
  }

  function destroy(): void {
    elements.host.remove();
  }

  return {
    setSelection,
    updateStatus,
    refreshPosition,
    setBehaviorInteractivity,
    destroy
  } satisfies SelectionMiniHud;
}
