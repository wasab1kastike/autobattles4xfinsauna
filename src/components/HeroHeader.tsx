import { Flame, Sparkles } from 'lucide-react';
import { VersionBadge } from './VersionBadge';

interface HeroHeaderProps {
  version: string;
  commit: string;
}

export function HeroHeader({ version, commit }: HeroHeaderProps) {
  return (
    <header className="flex flex-col gap-6 text-center sm:text-left">
      <div className="flex items-center justify-center sm:justify-start gap-3 text-sauna-ember/80">
        <Flame className="h-8 w-8" aria-hidden />
        <span className="font-display tracking-[0.4em] uppercase text-sm sm:text-base">Sauna Initiative</span>
      </div>
      <div className="space-y-4">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-semibold text-white drop-shadow-[0_10px_35px_rgba(255,111,97,0.35)]">
          Autobattles for X Finsauna
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-white/70 max-w-2xl">
          Command a premium autopilot skirmish experience where Sauna tacticians dance with Frostbound raiders. Launch
          diagnostics, monitor telemetry, and let the AI choreograph a cinematic strategy showcase.
        </p>
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
          <VersionBadge version={version} commit={commit} />
          <span className="badge bg-gradient-to-r from-white/10 via-sauna-ember/30 to-sauna-mist/20">
            <Sparkles className="h-4 w-4 text-sauna-ember" aria-hidden />
            Launch ready
          </span>
        </div>
      </div>
    </header>
  );
}
