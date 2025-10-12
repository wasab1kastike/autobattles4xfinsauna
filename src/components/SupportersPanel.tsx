import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

interface SupportCard {
  title: string;
  description: string;
  href: string;
  cta: string;
}

interface SupportersPanelProps {
  cards: SupportCard[];
}

export default function SupportersPanel({ cards }: SupportersPanelProps) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {cards.map((card, index) => (
        <motion.a
          key={card.title}
          href={card.href}
          target="_blank"
          rel="noreferrer"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.05 }}
          viewport={{ once: true }}
          className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-8 text-left backdrop-blur transition hover:border-sauna-frost/60 hover:bg-white/10"
        >
          <div>
            <h3 className="font-display text-2xl uppercase tracking-[0.3em] text-white">{card.title}</h3>
            <p className="mt-4 text-base text-slate-200">{card.description}</p>
          </div>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-sauna-frost">
            {card.cta}
            <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </span>
          <div className="absolute -bottom-24 right-[-30%] h-52 w-52 rounded-full bg-gradient-to-tr from-sauna-ember/20 to-sauna-frost/20 blur-3xl transition group-hover:scale-110" />
        </motion.a>
      ))}
    </div>
  );
}
