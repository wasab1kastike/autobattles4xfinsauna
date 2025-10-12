import { motion } from "framer-motion";

interface RoadmapItem {
  label: string;
  title: string;
  body: string;
  status: "complete" | "active" | "up-next";
}

interface JourneyTimelineProps {
  roadmap: RoadmapItem[];
}

const statusStyles: Record<RoadmapItem["status"], string> = {
  complete: "from-emerald-400 to-emerald-500",
  active: "from-sauna-frost to-blue-500",
  "up-next": "from-slate-500 to-slate-700",
};

export default function JourneyTimeline({ roadmap }: JourneyTimelineProps) {
  return (
    <ol id="roadmap" className="flex-1 space-y-12">
      {roadmap.map((phase, index) => (
        <motion.li
          key={phase.label}
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: index * 0.05 }}
          viewport={{ once: true }}
          className="relative rounded-3xl border border-white/5 bg-white/5 p-8 backdrop-blur"
        >
          <span
            className={`inline-flex items-center rounded-full bg-gradient-to-r ${statusStyles[phase.status]} px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-950`}
          >
            {phase.label}
          </span>
          <h3 className="mt-4 font-display text-3xl uppercase tracking-[0.3em] text-white">{phase.title}</h3>
          <p className="mt-3 text-base text-slate-200">{phase.body}</p>
          <div className="mt-6 h-px w-full bg-gradient-to-r from-white/0 via-white/40 to-white/0" />
          <p className="text-sm text-slate-400">
            Status synced with GitHub Pages deployments. Every successful build refreshes the docs folder with production
            assets—no more Git LFS placeholders.
          </p>
        </motion.li>
      ))}
    </ol>
  );
}
