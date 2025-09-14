import type { AxialCoord } from '../hex/HexUtils.ts';

/** Simple sauna building providing a healing aura. */
export class Sauna {
  constructor(
    public pos: AxialCoord,
    public auraRadius: number,
    public regenPerSec: number
  ) {}
}

export default Sauna;

