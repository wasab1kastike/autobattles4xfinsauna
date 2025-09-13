import { describe, it, expect } from 'vitest';
import { HexMap } from './hexmap.ts';
import { HexTile } from './hex/HexTile.ts';

describe('HexMap', () => {
  it('generates a grid of tiles', () => {
    const map = new HexMap(3, 3);
    let count = 0;
    map.forEachTile(() => count++);
    expect(count).toBe(9);
    expect(map.getTile(0, 0)).toBeInstanceOf(HexTile);
  });

  it('returns neighboring tiles', () => {
    const map = new HexMap(3, 3);
    const neighbors = map.getNeighbors(1, 1);
    expect(neighbors).toHaveLength(6);
    neighbors.forEach((tile) => expect(tile).toBeInstanceOf(HexTile));
  });
});
