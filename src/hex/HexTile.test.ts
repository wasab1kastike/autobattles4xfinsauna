import { describe, it, expect } from 'vitest';
import { HexTile } from './HexTile.ts';

describe('HexTile', () => {
  it('tracks terrain, building and fog state', () => {
    const tile = new HexTile('water', null, true);
    expect(tile.terrain).toBe('water');
    expect(tile.isFogged).toBe(true);
    tile.reveal();
    expect(tile.isFogged).toBe(false);
    tile.placeBuilding('city');
    expect(tile.building).toBe('city');
    tile.setFogged(true);
    expect(tile.isFogged).toBe(true);
  });
});
