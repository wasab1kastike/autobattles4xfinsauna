export enum TerrainId {
  Plains = 0,
  Forest = 1,
  Hills = 2,
  Lake = 3,
}

// Simple deterministic hash-based noise returning value in [0,1).
function noise(x: number, y: number, seed: number): number {
  let h = x * 374761393 + y * 668265263 + seed * 1442695040888963407;
  h = (h ^ (h >> 13)) * 1274126177;
  h ^= h >> 16;
  return (h >>> 0) / 0xffffffff;
}

export function terrainAt(q: number, r: number, seed = 0): TerrainId {
  const n = noise(q, r, seed);
  if (n < 0.1) return TerrainId.Lake;
  if (n < 0.3) return TerrainId.Forest;
  if (n < 0.5) return TerrainId.Hills;
  return TerrainId.Plains;
}

export function generateTerrain(width: number, height: number, seed = 0): TerrainId[][] {
  const rows: TerrainId[][] = [];
  for (let r = 0; r < height; r++) {
    const row: TerrainId[] = [];
    for (let q = 0; q < width; q++) {
      row.push(terrainAt(q, r, seed));
    }
    rows.push(row);
  }
  return rows;
}
