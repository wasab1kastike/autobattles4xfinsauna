import type { AxialCoord } from '../../hex/HexUtils.ts';
import type { HexMap } from '../../hexmap.ts';
import type { Unit } from '../../units/Unit.ts';
import { getNeighbors } from '../../hex/HexUtils.ts';
import { listStrongholds } from '../strongholds.ts';

export interface StrongholdSpawnContext {
  readonly map: HexMap;
  readonly units: Iterable<Unit>;
  readonly random?: () => number;
}

function coordKey(coord: AxialCoord): string {
  return `${coord.q},${coord.r}`;
}

export function pickStrongholdSpawnCoord(
  context: StrongholdSpawnContext
): AxialCoord | undefined {
  const random = typeof context.random === 'function' ? context.random : Math.random;
  const occupied = new Set<string>();
  for (const unit of context.units) {
    if (!unit.isDead()) {
      occupied.add(coordKey(unit.coord));
    }
  }

  const candidates: AxialCoord[] = [];
  const seen = new Set<string>();

  const addCandidate = (coord: AxialCoord) => {
    const key = coordKey(coord);
    if (occupied.has(key) || seen.has(key)) {
      return;
    }
    context.map.ensureTile(coord.q, coord.r);
    seen.add(key);
    candidates.push(coord);
  };

  for (const stronghold of listStrongholds()) {
    if (stronghold.captured) {
      continue;
    }
    addCandidate(stronghold.coord);
    for (const neighbor of getNeighbors(stronghold.coord)) {
      addCandidate(neighbor);
    }
  }

  if (candidates.length === 0) {
    return undefined;
  }

  const index = Math.floor(random() * candidates.length);
  return candidates[index];
}
