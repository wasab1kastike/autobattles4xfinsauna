import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Snowflake } from 'lucide-react';
import { getUnitsByFaction, normaliseHealth, type BattleState } from '../game/simulation';

interface BattleViewportProps {
  state: BattleState;
}

const factionStyles = {
  sauna: {
    gradient: 'from-sauna-ember/70 via-orange-500/40 to-red-500/20',
    icon: <Flame className="h-5 w-5" aria-hidden />,
    accent: 'text-sauna-ember'
  },
  frost: {
    gradient: 'from-blue-500/60 via-indigo-500/30 to-purple-500/20',
    icon: <Snowflake className="h-5 w-5" aria-hidden />,
    accent: 'text-sauna-mist'
  }
} as const;

type FactionKey = keyof typeof factionStyles;

function UnitCard({ unit }: { unit: ReturnType<typeof getUnitsByFaction>[number] }) {
  const healthRatio = normaliseHealth(unit);
  const variant = factionStyles[unit.faction as FactionKey];
  const isDown = unit.health <= 0;

  return (
    <motion.div
      layout
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 shadow-inner`}
      animate={{ opacity: isDown ? 0.45 : 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${variant.gradient} opacity-30`} />
      <div className="relative space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`badge ${variant.accent}`}>{variant.icon}</span>
            <p className="text-white font-semibold">{unit.name}</p>
          </div>
          <span className="text-white/70 text-sm">{unit.health}/{unit.maxHealth}</span>
        </div>
        <div className="h-2 rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-white to-sauna-mist"
            animate={{ width: `${Math.max(0.05, healthRatio) * 100}%` }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-white/60">
          <div>
            <p>Damage</p>
            <p className="text-white/80">
              {unit.attack[0]} - {unit.attack[1]}
            </p>
          </div>
          <div>
            <p>Crit</p>
            <p className="text-white/80">{Math.round(unit.critChance * 100)}%</p>
          </div>
        </div>
      </div>
      {isDown && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <span className="uppercase tracking-[0.3em] text-white/50 text-xs">Down</span>
        </div>
      )}
    </motion.div>
  );
}

export const BattleViewport = memo(({ state }: BattleViewportProps) => {
  const saunaUnits = getUnitsByFaction(state.snapshot.units, 'sauna');
  const frostUnits = getUnitsByFaction(state.snapshot.units, 'frost');

  return (
    <section className="card-section space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Combat viewport</h2>
        <span className="badge bg-white/5 text-white/70">Tick {state.snapshot.tick.toString().padStart(3, '0')}</span>
      </header>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] items-center">
        <div className="grid gap-4">
          <AnimatePresence>{saunaUnits.map((unit) => <UnitCard key={unit.id} unit={unit} />)}</AnimatePresence>
        </div>
        <div className="hidden lg:flex items-center justify-center">
          <div className="h-full w-px bg-gradient-to-b from-white/0 via-white/20 to-white/0" />
        </div>
        <div className="grid gap-4">
          <AnimatePresence>{frostUnits.map((unit) => <UnitCard key={unit.id} unit={unit} />)}</AnimatePresence>
        </div>
      </div>
    </section>
  );
});

BattleViewport.displayName = 'BattleViewport';
