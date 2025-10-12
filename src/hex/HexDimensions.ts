export interface HexDimensions {
  width: number;
  height: number;
}

const HEX_WIDTH_RATIO = Math.sqrt(3);
const HEX_HEIGHT_RATIO = 2;

/**
 * Derive the rendered width and height for a flat-topped hexagon.
 *
 * Every hex is rendered as a rectangle that contains the pointy corners of the
 * hexagonal sprite. For a given side length (`hexSize`), the width equals
 * `hexSize * sqrt(3)` and the height equals `hexSize * 2`.
 */
export function getHexDimensions(hexSize: number): HexDimensions {
  return {
    width: hexSize * HEX_WIDTH_RATIO,
    height: hexSize * HEX_HEIGHT_RATIO,
  };
}
