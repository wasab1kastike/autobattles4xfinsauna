import type { AxialCoord, PixelCoord } from '../../hex/HexUtils.ts';
import { axialToPixel } from '../../hex/HexUtils.ts';
import { getHexDimensions } from '../../hex/HexDimensions.ts';
import { getUnitSpriteMetadata } from './sprite_map.ts';
import type { UnitSpriteMetadata } from './sprite_map.ts';
import { snapForZoom } from '../zoom.ts';

export interface SpritePlacementInput {
  readonly coord: AxialCoord;
  readonly hexSize: number;
  readonly origin: PixelCoord;
  readonly zoom: number;
  readonly type: string;
}

export interface SpritePlacement {
  readonly drawX: number;
  readonly drawY: number;
  readonly width: number;
  readonly height: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly metadata: UnitSpriteMetadata;
}

function resolveRawCenter(
  coord: AxialCoord,
  hexSize: number,
  origin: PixelCoord,
  metadata: UnitSpriteMetadata
): PixelCoord {
  const { x, y } = axialToPixel(coord, hexSize);
  const nudgeX = metadata.nudge.x * hexSize;
  const nudgeY = metadata.nudge.y * hexSize;
  return {
    x: x - origin.x + nudgeX,
    y: y - origin.y + nudgeY
  };
}

export function getSpriteCenter({
  coord,
  hexSize,
  origin,
  zoom,
  type
}: SpritePlacementInput): PixelCoord {
  const metadata = getUnitSpriteMetadata(type);
  const center = resolveRawCenter(coord, hexSize, origin, metadata);
  return {
    x: snapForZoom(center.x, zoom),
    y: snapForZoom(center.y, zoom)
  };
}

export function getSpritePlacement({
  coord,
  hexSize,
  origin,
  zoom,
  type
}: SpritePlacementInput): SpritePlacement {
  const metadata = getUnitSpriteMetadata(type);
  const center = resolveRawCenter(coord, hexSize, origin, metadata);
  const { width: hexWidth, height: hexHeight } = getHexDimensions(hexSize);
  const rawWidth = hexWidth * metadata.scale.x;
  const rawHeight = hexHeight * metadata.scale.y;
  const drawX = snapForZoom(center.x - rawWidth * metadata.anchor.x, zoom);
  const drawY = snapForZoom(center.y - rawHeight * metadata.anchor.y, zoom);
  const width = snapForZoom(rawWidth, zoom);
  const height = snapForZoom(rawHeight, zoom);
  const centerX = drawX + width * metadata.anchor.x;
  const centerY = drawY + height * metadata.anchor.y;
  return { drawX, drawY, width, height, centerX, centerY, metadata };
}
