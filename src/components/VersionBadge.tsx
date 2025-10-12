import { Code2 } from 'lucide-react';

interface VersionBadgeProps {
  version: string;
  commit: string;
}

export function VersionBadge({ version, commit }: VersionBadgeProps) {
  return (
    <span className="badge bg-white/15 text-xs sm:text-sm">
      <Code2 className="h-4 w-4 text-sauna-mist" aria-hidden />
      <span className="uppercase tracking-wider">Build {version}</span>
      <span className="text-white/60">#{commit}</span>
    </span>
  );
}
