import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MockAudioParam {
  value: number;
  readonly events: Array<{
    type: 'cancel' | 'setValue' | 'linearRamp' | 'setTarget';
    value?: number;
    time: number;
    timeConstant?: number;
  }> = [];

  constructor(value: number) {
    this.value = value;
  }

  cancelScheduledValues(time: number): void {
    this.events.push({ type: 'cancel', time });
  }

  setValueAtTime(value: number, time: number): void {
    this.value = value;
    this.events.push({ type: 'setValue', value, time });
  }

  linearRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.events.push({ type: 'linearRamp', value, time });
  }

  setTargetAtTime(value: number, time: number, timeConstant: number): void {
    this.value = value;
    this.events.push({ type: 'setTarget', value, time, timeConstant });
  }
}

class MockGainNode {
  readonly context: MockAudioContext;
  readonly gain: MockAudioParam;
  readonly connections: unknown[] = [];

  constructor(context: MockAudioContext, initial: number) {
    this.context = context;
    this.gain = new MockAudioParam(initial);
  }

  connect(node: unknown): void {
    this.connections.push(node);
  }

  disconnect(): void {
    this.connections.length = 0;
  }
}

class MockAudioBuffer {
  readonly numberOfChannels: number;
  readonly length: number;
  readonly sampleRate: number;
  private readonly data: Float32Array[];

  constructor(channels: number, length: number, sampleRate: number) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.data = Array.from({ length: channels }, () => new Float32Array(length));
  }

  getChannelData(channel: number): Float32Array {
    return this.data[channel];
  }
}

class MockAudioBufferSourceNode {
  readonly context: MockAudioContext;
  buffer: MockAudioBuffer | null = null;
  readonly connections: unknown[] = [];
  started = 0;
  onended: (() => void) | null = null;
  private readonly endedListeners = new Set<() => void>();

  constructor(context: MockAudioContext) {
    this.context = context;
  }

  connect(node: unknown): void {
    this.connections.push(node);
  }

  addEventListener(type: string, listener: () => void, options?: { once?: boolean }): void {
    if (type !== 'ended') {
      return;
    }
    if (options?.once) {
      const wrapped = () => {
        this.endedListeners.delete(wrapped);
        listener();
      };
      this.endedListeners.add(wrapped);
    } else {
      this.endedListeners.add(listener);
    }
  }

  start(): void {
    this.started++;
  }

  stop(): void {
    if (this.onended) {
      this.onended();
    }
    for (const listener of [...this.endedListeners]) {
      listener();
    }
    this.endedListeners.clear();
  }
}

class MockAudioContext {
  readonly destination = { id: 'destination' };
  readonly sampleRate = 48000;
  currentTime = 0;
  readonly createdSources: MockAudioBufferSourceNode[] = [];

  createGain(): MockGainNode {
    return new MockGainNode(this, 1);
  }

  createBuffer(channels: number, length: number, sampleRate: number): MockAudioBuffer {
    return new MockAudioBuffer(channels, length, sampleRate);
  }

  createBufferSource(): MockAudioBufferSourceNode {
    const source = new MockAudioBufferSourceNode(this);
    this.createdSources.push(source);
    return source;
  }

  async decodeAudioData(): Promise<MockAudioBuffer> {
    return new MockAudioBuffer(1, this.sampleRate, this.sampleRate);
  }
}

let nowMs = 0;

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('combat SFX safeguards', () => {
  beforeEach(() => {
    vi.resetModules();
    nowMs = 0;
    vi.stubGlobal('performance', { now: () => nowMs } as Pick<Performance, 'now'>);
    vi.stubGlobal(
      'localStorage',
      {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: vi.fn(),
        get length() {
          return 0;
        }
      } satisfies Partial<Storage> as Storage
    );
    vi.stubGlobal(
      'window',
      {
        AudioContext: MockAudioContext,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      } as unknown as typeof window
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const setup = async () => {
    const mixer = await import('./mixer.ts');
    const sfx = await import('./sfx.ts');
    const ctx = mixer.initAudioContext() as unknown as MockAudioContext;
    return { mixer, sfx, ctx };
  };

  it('applies weighted debouncing to bursty attacks', async () => {
    const { mixer, sfx, ctx } = await setup();
    try {
      nowMs = 0;
      sfx.playSafe('attack');
      await flushMicrotasks();

      nowMs = 30;
      sfx.playSafe('attack');
      await flushMicrotasks();

      nowMs = 60;
      sfx.playSafe('attack');
      await flushMicrotasks();

      const started = ctx.createdSources.filter((source) => source.started > 0).length;
      expect(started).toBe(2);
    } finally {
      ctx.createdSources.forEach((source) => source.stop());
      sfx.resetSfxForTests();
      mixer.resetMixerForTests();
    }
  });

  it('caps active attack sources by the configured polyphony', async () => {
    const { mixer, sfx, ctx } = await setup();
    try {
      nowMs = 0;
      sfx.playSafe('attack');
      await flushMicrotasks();

      nowMs = 200;
      sfx.playSafe('attack');
      await flushMicrotasks();

      nowMs = 400;
      sfx.playSafe('attack');
      await flushMicrotasks();

      nowMs = 600;
      sfx.playSafe('attack');
      await flushMicrotasks();

      const started = ctx.createdSources.filter((source) => source.started > 0).length;
      expect(started).toBe(3);
    } finally {
      ctx.createdSources.forEach((source) => source.stop());
      sfx.resetSfxForTests();
      mixer.resetMixerForTests();
    }
  });

  it('ducks the music bus when SISU fires', async () => {
    const { mixer, sfx, ctx } = await setup();
    try {
      const musicNode = mixer.getChannelGainNode('music') as unknown as MockGainNode;
      const initialGain = musicNode.gain.value;
      const originalGetChannelGainNode = mixer.getChannelGainNode;
      vi.spyOn(mixer, 'getChannelGainNode').mockImplementation((channel) => {
        if (channel === 'music') {
          originalGetChannelGainNode(channel);
          return musicNode as unknown as GainNode;
        }
        return originalGetChannelGainNode(channel);
      });
      const cancelSpy = vi.spyOn(musicNode.gain, 'cancelScheduledValues');
      const setValueSpy = vi.spyOn(musicNode.gain, 'setValueAtTime');
      const rampSpy = vi.spyOn(musicNode.gain, 'linearRampToValueAtTime');
      const targetSpy = vi.spyOn(musicNode.gain, 'setTargetAtTime');

      nowMs = 0;
      ctx.currentTime = 1.2;
      const expectedAttackTime = ctx.currentTime + 0.04;
      const expectedReleaseConstant = 0.6;
      sfx.playSafe('sisu');
      await flushMicrotasks();
      await flushMicrotasks();

      expect(cancelSpy).toHaveBeenCalled();
      expect(setValueSpy).toHaveBeenCalled();
      expect(rampSpy).toHaveBeenCalled();
      const [dipValue, dipTime] = rampSpy.mock.calls[0];
      expect(typeof dipValue).toBe('number');
      expect(dipValue).toBeLessThan(initialGain);
      expect(dipTime).toBeCloseTo(expectedAttackTime, 5);

      expect(targetSpy).toHaveBeenCalled();
      const lastTargetCall = targetSpy.mock.calls.at(-1);
      expect(lastTargetCall?.[0]).toBeCloseTo(initialGain, 5);
      expect(lastTargetCall?.[1]).toBeCloseTo(expectedAttackTime, 5);
      expect(lastTargetCall?.[2]).toBeCloseTo(expectedReleaseConstant, 5);
    } finally {
      ctx.createdSources.forEach((source) => source.stop());
      sfx.resetSfxForTests();
      mixer.resetMixerForTests();
    }
  });
});
