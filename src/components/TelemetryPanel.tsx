import { GaugeCircle, HeartPulse, Timer, Trophy } from 'lucide-react';
import { useMemo } from 'react';
import type { BattleState } from '../game/simulation';

interface TelemetryPanelProps {
  state: BattleState;
}

export function TelemetryPanel({ state }: TelemetryPanelProps) {
  const metrics = useMemo(() => {
    const sauna = state.snapshot.units.filter((unit) => unit.faction === 'sauna');
    const frost = state.snapshot.units.filter((unit) => unit.faction === 'frost');
    const saunaHealth = sauna.reduce((sum, unit) => sum + unit.health, 0);
    const frostHealth = frost.reduce((sum, unit) => sum + unit.health, 0);
    const saunaMax = sauna.reduce((sum, unit) => sum + unit.maxHealth, 0);
    const frostMax = frost.reduce((sum, unit) => sum + unit.maxHealth, 0);

    const saunaRatio = saunaMax === 0 ? 0 : saunaHealth / saunaMax;
    const frostRatio = frostMax === 0 ? 0 : frostHealth / frostMax;

    return [
      {
        id: 'tick',
        label: 'Battle tick',
        value: `T${state.snapshot.tick.toString().padStart(3, '0')}`,
        icon: <Timer className="h-5 w-5 text-sauna-mist" aria-hidden />
      },
      {
        id: 'sauna',
        label: 'Sauna vitality',
        value: `${Math.round(saunaRatio * 100)}%`,
        icon: <HeartPulse className="h-5 w-5 text-sauna-ember" aria-hidden />
      },
      {
        id: 'frost',
        label: 'Frost presence',
        value: `${Math.round(frostRatio * 100)}%`,
        icon: <GaugeCircle className="h-5 w-5 text-blue-300" aria-hidden />
      },
      {
        id: 'status',
        label: 'Victory lane',
        value: state.snapshot.winner ? `${state.snapshot.winner.toUpperCase()} lead` : 'Contested',
        icon: <Trophy className="h-5 w-5 text-yellow-300" aria-hidden />
      }
    ];
  }, [state.snapshot.tick, state.snapshot.units, state.snapshot.winner]);

  return (
    <section className="card-section">
      <header className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Telemetry</h2>
        <span className="badge text-white/60">Real-time feed</span>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {metrics.map((metric) => (
          <div key={metric.id} className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">{metric.icon}</span>
            <div>
              <p className="text-sm text-white/60">{metric.label}</p>
              <p className="text-lg font-semibold text-white">{metric.value}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
