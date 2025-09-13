export interface AxialCoord {
  q: number;
  r: number;
}

export interface PixelCoord {
  x: number;
  y: number;
}

const SQRT3 = Math.sqrt(3);

const DIRECTIONS: AxialCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
];

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
