import { Github, Mail } from "lucide-react";

export default function FooterCTA() {
  return (
    <footer className="border-t border-white/10 bg-slate-950/80 py-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-8 px-6 text-center md:flex-row md:text-left">
        <div>
          <p className="font-display text-lg uppercase tracking-[0.35em] text-sauna-glow/80">Sustain the Steam</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">
            Ship new encounters, export a fresh build, and push directly to GitHub Pages with <code>npm run build</code>.
          </h2>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            href="https://github.com/wasab1kastike/autobattles4xfinsauna"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:border-sauna-frost/70 hover:text-sauna-frost"
          >
            <Github className="h-4 w-4" />
            Repository
          </a>
          <a
            href="mailto:hello@finsauna.dev"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sauna-ember via-sauna-glow to-sauna-frost px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-sauna-ember/30 transition hover:scale-105 hover:shadow-xl"
          >
            <Mail className="h-4 w-4" />
            Contact Team
          </a>
        </div>
      </div>
      <p className="mt-10 text-center text-xs text-slate-500">
        GitHub Pages now serves first-class static assets—no Git LFS placeholders. Review the updated deployment guide in the README.
      </p>
    </footer>
  );
}
