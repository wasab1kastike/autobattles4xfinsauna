import { eventBus } from '../events/EventBus.ts';
import type { UnitDamagedPayload, UnitDiedPayload } from '../events/types.ts';
import { playSafe } from './sfx.ts';

type SisuBurstPayload = {
  remaining: number;
  status?: string;
};

const GLOBAL_FLAG = '__autobattlesAudioEvents__';
const globalWithFlag = globalThis as typeof globalThis & {
  [GLOBAL_FLAG]?: boolean;
};

if (!globalWithFlag[GLOBAL_FLAG]) {
  eventBus.on<UnitDamagedPayload>('unitDamaged', (payload) => {
    if (!payload || payload.amount <= 0) {
      return;
    }
    playSafe('attack');
  });

  eventBus.on<UnitDiedPayload>('unitDied', () => {
    playSafe('death');
  });

  eventBus.on<SisuBurstPayload>('sisuBurstStart', () => {
    playSafe('sisu');
  });

  globalWithFlag[GLOBAL_FLAG] = true;
}
