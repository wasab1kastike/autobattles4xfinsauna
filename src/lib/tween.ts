/** Basic tweening utilities. */

/** Linear interpolation between two numbers. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Exponential smoothing toward a target using a damping factor.
 *
 * @param a current value
 * @param b target value
 * @param lambda damping factor per second
 * @param dt time step in seconds
 */
export function damp(a: number, b: number, lambda: number, dt: number): number {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}
