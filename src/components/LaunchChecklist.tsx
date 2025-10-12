import { useMemo, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, Cpu, Waves } from 'lucide-react';

interface LaunchChecklistProps {
  status: 'idle' | 'running' | 'finished';
  tick: number;
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  ready: boolean;
  icon: ReactNode;
}

function checkWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl') ||
      canvas.getContext('webgl2')
    );
  } catch (error) {
    console.warn('WebGL capability check failed', error);
    return false;
  }
}

export function LaunchChecklist({ status, tick }: LaunchChecklistProps) {
  const items = useMemo<ChecklistItem[]>(() => {
    const glReady = checkWebGL();
    const timingReady = window.performance?.now() !== undefined;
    const tickSync = tick >= 0;

    return [
      {
        id: 'renderer',
        label: 'Renderer linked',
        description: glReady ? 'WebGL acceleration detected' : 'Fallback rendering in use',
        ready: glReady,
        icon: <Waves className="h-5 w-5" aria-hidden />
      },
      {
        id: 'timing',
        label: 'Frame pacing',
        description: timingReady ? 'High precision timers online' : 'Using basic timing loop',
        ready: timingReady,
        icon: <Cpu className="h-5 w-5" aria-hidden />
      },
      {
        id: 'state-sync',
        label: 'Battle sync',
        description: tickSync ? `Tick ${tick.toString().padStart(3, '0')}` : 'Awaiting bootstrap',
        ready: tickSync,
        icon: <CheckCircle2 className="h-5 w-5" aria-hidden />
      }
    ];
  }, [tick]);

  return (
    <section className="card-section space-y-5">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Launch checklist</h2>
        <span className="badge">
          {status === 'running' ? 'Live simulation' : status === 'finished' ? 'Battle complete' : 'Idle'}
        </span>
      </header>
      <div className="grid gap-4">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                item.ready ? 'bg-green-400/20 text-green-300' : 'bg-yellow-400/10 text-yellow-300'
              }`}
            >
              {item.icon}
            </span>
            <div className="flex-1">
              <p className="text-base font-medium text-white flex items-center gap-2">
                {item.label}
                {item.ready ? (
                  <CheckCircle2 className="h-4 w-4 text-green-300" aria-hidden />
                ) : (
                  <CircleAlert className="h-4 w-4 text-yellow-300" aria-hidden />
                )}
              </p>
              <p className="text-sm text-white/60">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
