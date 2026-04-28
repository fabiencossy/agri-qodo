import type { LucideIcon } from "lucide-react";

export function ComingSoon({
  icon: Icon,
  title,
  module,
  description,
}: {
  icon: LucideIcon;
  title: string;
  module: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <Icon className="mx-auto h-16 w-16 text-green/40" />
      <h1 className="mt-4 text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-xs uppercase tracking-wider text-foreground/40">{module}</p>
      <p className="mx-auto mt-4 max-w-md text-sm text-foreground/60">{description}</p>
      <div className="mx-auto mt-8 max-w-xs rounded-lg border border-dashed border-border px-4 py-3 text-xs text-foreground/50">
        🌱 Module en cours de développement
      </div>
    </div>
  );
}
