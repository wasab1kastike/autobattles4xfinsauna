import { HeroHeader } from './components/HeroHeader';
import { LaunchChecklist } from './components/LaunchChecklist';
import { BattleViewport } from './components/BattleViewport';
import { CombatLog } from './components/CombatLog';
import { ControlPanel } from './components/ControlPanel';
import { TelemetryPanel } from './components/TelemetryPanel';
import { useBattleController } from './hooks/useBattleController';

function useBuildMetadata() {
  return {
    version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
    commit: typeof __APP_COMMIT__ === 'string' ? __APP_COMMIT__ : 'unknown'
  };
}

export default function App() {
  const { version, commit } = useBuildMetadata();
  const { state, status, autoPlay, tick, reset, toggleAuto, progress, simulate } = useBattleController();

  return (
    <div className="px-4 py-8 sm:px-10 lg:px-16 xl:px-24 max-w-7xl mx-auto space-y-10 text-white">
      <HeroHeader version={version} commit={commit} />
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-8">
          <BattleViewport state={state} />
          <CombatLog state={state} />
        </div>
        <div className="space-y-8">
          <LaunchChecklist status={status} tick={progress.tick} />
          <TelemetryPanel state={state} />
          <ControlPanel
            status={status}
            autoPlay={autoPlay}
            onTick={tick}
            onReset={() => reset()}
            onToggleAuto={toggleAuto}
            onSimulate={simulate}
          />
        </div>
      </div>
      <footer className="text-center text-xs text-white/50">
        Autobattles for X Finsauna · Crafted for immersive diagnostics · Build {version} ({commit})
      </footer>
    </div>
  );
}
