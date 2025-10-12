import { motion } from "framer-motion";
import { Flame, Swords, Target, Users } from "lucide-react";
import AuroraHero from "../components/AuroraHero";
import FeatureCard from "../components/FeatureCard";
import JourneyTimeline from "../components/JourneyTimeline";
import SupportersPanel from "../components/SupportersPanel";
import FooterCTA from "../components/FooterCTA";

const featureBlocks = [
  {
    icon: Flame,
    title: "Sauna-Fueled Strategy",
    description:
      "Empower your roster with mythical steam rituals. Balance heat, morale, and positioning to outlast the waves of invaders.",
  },
  {
    icon: Swords,
    title: "Tactical Auto Battles",
    description:
      "Design synergies, tune encounter pacing, and watch the battlefield shift dynamically with every strategic tweak.",
  },
  {
    icon: Target,
    title: "Adaptive AI Encounters",
    description:
      "Procedural enemy scaling keeps each expedition fresh. Scout threats, respond to ambushes, and evolve the village arsenal.",
  },
  {
    icon: Users,
    title: "Community-Crafted Progression",
    description:
      "Playtest builds and design logs are released frequently. Share balance ideas and help shape the future of the sauna league.",
  },
];

const roadmap = [
  {
    label: "Prototype",
    title: "Vertical Slice",
    body:
      "A polished encounter sandbox with core roster units, sauna economy loop, and cinematic UI foundations.",
    status: "complete",
  },
  {
    label: "Alpha",
    title: "Campaign Frontier",
    body:
      "Branching 4X-style expeditions, narrative events, and persistent upgrades that celebrate Nordic folklore.",
    status: "active",
  },
  {
    label: "Beta",
    title: "Cooperative Sauna Raids",
    body:
      "Synchronous defence runs with friends, seasonal ladders, and community-sourced challenge modifiers.",
    status: "up-next",
  },
];

const supporters = [
  {
    title: "Play the Latest Build",
    description: "GitHub Pages hosts the evergreen demo updated on every main branch deployment.",
    href: "https://wasab1kastike.github.io/autobattles4xfinsauna/",
    cta: "Launch Demo",
  },
  {
    title: "Read the Design Logs",
    description: "Deep dives into AI behaviours, combat math, and art direction.",
    href: "https://wasab1kastike.github.io/autobattles4xfinsauna/docs/design",
    cta: "View Documentation",
  },
  {
    title: "Join the Sauna Circle",
    description: "Collaborate on balance patches, request features, and follow milestone drops.",
    href: "https://discord.gg/your-sauna-circle",
    cta: "Enter Discord",
  },
];

export default function App() {
  return (
    <div className="gradient-bg min-h-screen w-full">
      <AuroraHero />

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <motion.h2
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="font-display text-4xl font-semibold uppercase tracking-[0.3em] text-sauna-glow/80"
        >
          What Awaits Inside the Steam
        </motion.h2>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {featureBlocks.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>

      <section className="bg-slate-900/40 py-20">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 md:flex-row md:items-start">
          <div className="max-w-xl">
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="font-display text-4xl font-semibold uppercase tracking-[0.25em] text-sauna-frost"
            >
              Expedition Roadmap
            </motion.h2>
            <p className="mt-5 text-lg text-slate-300">
              Each milestone pushes the autobattler deeper into strategy territory. This roadmap is reflected live on the
              GitHub Pages build so contributors can validate changes without pulling the repository.
            </p>
          </div>
          <JourneyTimeline roadmap={roadmap} />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <SupportersPanel cards={supporters} />
      </section>

      <FooterCTA />
    </div>
  );
}
