import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export default function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      viewport={{ once: true }}
      className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-8 backdrop-blur transition hover:border-sauna-frost/60 hover:bg-white/10"
    >
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-sauna-ember/40 to-sauna-frost/40 blur-3xl transition group-hover:scale-110" />
      <Icon className="relative h-9 w-9 text-sauna-glow" />
      <h3 className="relative mt-6 font-display text-2xl uppercase tracking-[0.25em] text-white">{title}</h3>
      <p className="relative mt-3 text-base text-slate-200">{description}</p>
    </motion.article>
  );
}
