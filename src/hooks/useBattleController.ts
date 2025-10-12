import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createInitialState, stepBattle, simulateBattle } from '../game/simulation';
import type { BattleState, BattleSnapshot } from '../game/simulation';

interface ResetOptions {
  seed?: number;
}

type BattleAction =
  | { type: 'tick' }
  | { type: 'reset'; seed?: number }
  | { type: 'hydrate'; snapshot: BattleSnapshot; seed: number };

function battleReducer(state: BattleState, action: BattleAction): BattleState {
  switch (action.type) {
    case 'tick':
      return stepBattle(state);
    case 'reset':
      return createInitialState(action.seed ?? Date.now());
    case 'hydrate': {
      return {
        seed: action.seed,
        status: 'idle',
        snapshot: {
          ...action.snapshot,
          events: [],
          tick: 0,
          winner: null
        }
      };
    }
    default:
      return state;
  }
}

export function useBattleController(seed = Date.now()) {
  const [state, dispatch] = useReducer(battleReducer, undefined, () => createInitialState(seed));
  const [autoPlay, setAutoPlay] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const status = state.status;

  const stopAutoPlay = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setAutoPlay(false);
  }, []);

  const tick = useCallback(() => {
    dispatch({ type: 'tick' });
  }, []);

  const reset = useCallback((options?: ResetOptions) => {
    stopAutoPlay();
    dispatch({ type: 'reset', seed: options?.seed });
  }, [stopAutoPlay]);

  const toggleAuto = useCallback(() => {
    setAutoPlay((previous) => {
      const next = !previous;
      if (!next) {
        stopAutoPlay();
      }
      return next;
    });
  }, [stopAutoPlay]);

  const simulate = useCallback(() => {
    stopAutoPlay();
    const newSeed = Date.now();
    const snapshot = simulateBattle(newSeed, 200);
    dispatch({ type: 'hydrate', snapshot, seed: newSeed });
  }, [stopAutoPlay]);

  useEffect(() => {
    if (!autoPlay) {
      stopAutoPlay();
      return;
    }
    if (status === 'finished') {
      stopAutoPlay();
      return;
    }

    intervalRef.current = window.setInterval(() => {
      dispatch({ type: 'tick' });
    }, 650);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoPlay, status, stopAutoPlay]);

  useEffect(() => {
    if (state.status === 'finished') {
      stopAutoPlay();
    }
  }, [state.status, stopAutoPlay]);

  const progress = useMemo(() => {
    return {
      tick: state.snapshot.tick,
      winner: state.snapshot.winner
    };
  }, [state.snapshot.tick, state.snapshot.winner]);

  return {
    state,
    status,
    progress,
    autoPlay,
    tick,
    reset,
    toggleAuto,
    simulate
  };
}
