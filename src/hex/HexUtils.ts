export interface AxialCoord {
  q: number;
  r: number;
}

export interface PixelCoord {
  x: number;
  y: number;
}

/** Square root of three used in many of the hex math formulae. */
const SQRT3 = Math.sqrt(3);

/** Direction vectors for axial coordinates (pointy topped). */
export const DIRECTIONS: ReadonlyArray<AxialCoord> = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
] as const;

/** Convert axial coordinates to pixel coordinates for pointy-topped hexes. */
export function axialToPixel(hex: AxialCoord, size: number): PixelCoord {
  return {
    x: size * SQRT3 * (hex.q + hex.r / 2),
    y: size * (3 / 2) * hex.r
  };
}

/** Convert pixel coordinates to axial coordinates for pointy-topped hexes. */
export function pixelToAxial(x: number, y: number, size: number): AxialCoord {
  const q = (SQRT3 / 3 * x - 1 / 3 * y) / size;
  const r = (2 / 3 * y) / size;
  return hexRound({ q, r });
}

/** Get the six neighboring axial coordinates. */
export function getNeighbors(hex: AxialCoord): AxialCoord[] {
  return DIRECTIONS.map((d) => ({ q: hex.q + d.q, r: hex.r + d.r }));
}

/**
 * Get a single neighboring coordinate in a specific direction.
 *
 * Directions are numbered 0-5 corresponding to {@link DIRECTIONS}.
 */
export function getNeighbor(hex: AxialCoord, direction: number): AxialCoord {
  const dir = DIRECTIONS[(direction % 6 + 6) % 6];
  return { q: hex.q + dir.q, r: hex.r + dir.r };
}

function hexRound(frac: AxialCoord): AxialCoord {
  let x = frac.q;
  let z = frac.r;
  let y = -x - z;

  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { q: rx, r: rz };
}
