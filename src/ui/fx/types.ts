import type { AxialCoord, PixelCoord } from '../../hex/HexUtils.ts';
import type { UnitBehavior } from '../../unit/types.ts';

export interface UnitStatusBuff {
  id: string;
  remaining?: number | typeof Infinity;
  duration?: number | typeof Infinity;
  stacks?: number;
}

export interface UnitStatusPayload {
  id: string;
  world: PixelCoord;
  radius: number;
  hp: number;
  maxHp: number;
  shield?: number;
  faction: string;
  visible?: boolean;
  selected?: boolean;
  buffs?: readonly UnitStatusBuff[];
}

export interface SaunaPerimeterAnchor {
  /** Angle in radians relative to the positive X axis (clockwise in screen space). */
  angle: number;
  /** Distance from the sauna centre to the anchor, expressed in world pixels. */
  radius: number;
  /**
   * Absolute world coordinate for the anchor point. The UI projects this into
   * screen space when it needs elements to hug the overlay perimeter.
   */
  world: PixelCoord;
}

export interface SaunaPerimeterGeometry {
  /** Radius of the progress annulus measured from the sauna centre. */
  ringRadius: number;
  /** Thickness of the ring used for gauges in world pixels. */
  ringThickness: number;
  /** Starting angle for the progress sweep in radians. */
  startAngle: number;
  /** Preferred angle for positioning the badge around the perimeter. */
  badgeAngle: number;
  /** Radial distance from centre to the badge anchor point. */
  badgeRadius: number;
  /** Optional radius for positioning a marker within the ring. */
  markerRadius?: number;
  /** Collection of anchor points hugging the edge of the hex. */
  anchors: readonly SaunaPerimeterAnchor[];
}

export interface SaunaStatusPayload {
  id: string;
  world: PixelCoord;
  radius: number;
  progress: number;
  countdown: number;
  label?: string;
  unitLabel?: string;
  visible?: boolean;
  geometry?: SaunaPerimeterGeometry;
}

export interface SelectionItemSlot {
  id: string;
  name: string;
  icon?: string;
  rarity?: string;
  quantity?: number;
}

export interface SelectionStatusChip {
  id: string;
  label: string;
  remaining?: number | typeof Infinity;
  duration?: number | typeof Infinity;
  stacks?: number;
}

export interface UnitSelectionPayload {
  id: string;
  name: string;
  faction: string;
  coord: AxialCoord;
  hp: number;
  maxHp: number;
  shield?: number;
  behavior?: UnitBehavior;
  items: readonly SelectionItemSlot[];
  statuses: readonly SelectionStatusChip[];
}
