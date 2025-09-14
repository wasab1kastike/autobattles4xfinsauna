import { describe, it, expect } from 'vitest';
import { HexTile } from './HexTile.ts';
import { HexMap } from '../hexmap.ts';

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

  it('reveals tiles within radius and leaves distant tiles fogged', () => {
    const map = new HexMap(5, 5);
    // reveal around center with radius 1
    map.revealAround({ q: 2, r: 2 }, 1);
    expect(map.getTile(2, 2)?.isFogged).toBe(false);
    expect(map.getTile(2, 3)?.isFogged).toBe(false); // neighbor within radius
    expect(map.getTile(4, 2)?.isFogged).toBe(true); // outside radius
  });
});
