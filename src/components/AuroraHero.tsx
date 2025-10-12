import { motion } from "framer-motion";
import { Sparkle } from "lucide-react";

const heroVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0 },
};

export default function AuroraHero() {
  return (
    <header className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.35),transparent_55%)]" />
      <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_center,rgba(255,122,24,0.28),transparent_60%)] md:block" />

      <div className="relative mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col items-center justify-center gap-12 px-6 py-24 text-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={heroVariants}
          transition={{ duration: 0.65 }}
          className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-sauna-frost shadow-neon backdrop-blur"
        >
          <Sparkle className="h-4 w-4" />
          <span>Playable slice updated every sprint</span>
        </motion.div>

        <motion.h1
          initial="hidden"
          animate="visible"
          variants={heroVariants}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display text-6xl uppercase tracking-[0.35em] text-white drop-shadow-[0_0_30px_rgba(56,189,248,0.35)] md:text-7xl"
        >
          Autobattles 4X Finsauna
        </motion.h1>

        <motion.p
          initial="hidden"
          animate="visible"
          variants={heroVariants}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="max-w-3xl text-lg text-slate-200 md:text-xl"
        >
          Orchestrate a band of sauna guardians who harness elemental steam to shield the Nordic frontier. Optimise your
          roster, experiment with relics, and let the auto-battler spectacle unfold under neon auroras.
        </motion.p>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={heroVariants}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-wrap justify-center gap-4"
        >
          <a
            href="#roadmap"
            className="rounded-full bg-gradient-to-r from-sauna-ember via-sauna-glow to-sauna-frost px-8 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-sauna-ember/30 transition hover:scale-105 hover:shadow-xl"
          >
            Explore the Vision
          </a>
          <a
            href="https://github.com/wasab1kastike/autobattles4xfinsauna"
            className="rounded-full border border-white/20 px-8 py-3 text-base font-medium text-white transition hover:border-sauna-frost/70 hover:text-sauna-frost"
          >
            View Source on GitHub
          </a>
        </motion.div>
      </div>
    </header>
  );
}
