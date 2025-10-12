import { Fragment, useMemo } from 'react';
import { Swords, Activity } from 'lucide-react';
import type { BattleState } from '../game/simulation';

interface CombatLogProps {
  state: BattleState;
}

export function CombatLog({ state }: CombatLogProps) {
  const events = useMemo(() => state.snapshot.events.slice(-6), [state.snapshot.events]);

  return (
    <section className="card-section space-y-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/80">
          <Swords className="h-5 w-5 text-sauna-ember" aria-hidden />
          <h2 className="text-xl font-semibold">Combat log</h2>
        </div>
        <span className="badge text-white/70">
          {events.length > 0 ? `${events.length} recent events` : 'Awaiting impact'}
        </span>
      </header>
      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center gap-2 py-8 text-white/50">
            <Activity className="h-6 w-6" aria-hidden />
            <p>Battle telemetry will appear once the simulation begins.</p>
          </div>
        )}
        {events.map((event) => {
          const isSelfCast = event.source === event.target;
          return (
            <Fragment key={`${event.tick}-${event.source}-${event.target}-${event.amount}`}>
              <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70">
                    Tick {event.tick.toString().padStart(3, '0')} · {isSelfCast ? 'Recovery' : 'Impact'}
                  </p>
                  <p className="text-base text-white">
                    <span className="text-sauna-mist">{event.source}</span>
                    {isSelfCast ? ' restored ' : ' struck '}
                    <span className="text-sauna-ember">{event.target}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-semibold ${isSelfCast ? 'text-green-300' : 'text-red-300'}`}>
                    {isSelfCast ? '+' : '-'}
                    {event.amount}
                  </p>
                  {event.wasCrit && !isSelfCast && <p className="text-xs text-white/60">Critical</p>}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}
