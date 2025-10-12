import { Play, Pause, RefreshCcw, Sparkles } from 'lucide-react';

interface ControlPanelProps {
  status: 'idle' | 'running' | 'finished';
  autoPlay: boolean;
  onTick: () => void;
  onReset: () => void;
  onToggleAuto: () => void;
  onSimulate: () => void;
}

export function ControlPanel({ status, autoPlay, onTick, onReset, onToggleAuto, onSimulate }: ControlPanelProps) {
  return (
    <section className="card-section space-y-5">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Command console</h2>
        <span className="badge text-white/70">{status === 'running' ? 'Streaming' : status === 'finished' ? 'Complete' : 'Standby'}</span>
      </header>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="button-primary" onClick={onToggleAuto}>
          {autoPlay ? (
            <span className="flex items-center gap-2">
              <Pause className="h-5 w-5" aria-hidden /> Pause autoplay
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Play className="h-5 w-5" aria-hidden /> Engage autoplay
            </span>
          )}
        </button>
        <button type="button" className="button-secondary" onClick={onTick}>
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" aria-hidden /> Advance one tick
          </span>
        </button>
        <button type="button" className="button-secondary" onClick={onReset}>
          <span className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5" aria-hidden /> Reset arena
          </span>
        </button>
        <button type="button" className="button-secondary" onClick={onSimulate}>
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" aria-hidden /> Fast simulate
          </span>
        </button>
      </div>
    </section>
  );
}
