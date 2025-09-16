/** Default hex radius used for rendering calculations and assets. */
export const HEX_R = 32;

export { axialToPixel } from './HexUtils.ts';

/**
 * Trace a flat-topped hexagon path centered at the provided position.
 *
 * The function begins a new path on the supplied 2D rendering context and
 * connects the six vertices of a regular hexagon oriented with flat top and
 * bottom edges.
 */
export function pathHex(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number
): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const px = x + r * Math.cos(angle);
    const py = y + r * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}
