import { describe, expect, it } from 'vitest';
import { parseTransform } from '../../tools/export-sprites';

describe('parseTransform', () => {
  it('parses whitespace-separated translate arguments', () => {
    const result = parseTransform('<g transform="translate(3 0)"></g>');

    expect(result.translateX).toBe(3);
    expect(result.translateY).toBe(0);
  });

  it('parses whitespace-separated scale arguments', () => {
    const result = parseTransform('<g transform="scale(0.35 0.35)"></g>');

    expect(result.scaleX).toBeCloseTo(0.35);
    expect(result.scaleY).toBeCloseTo(0.35);
  });
});
