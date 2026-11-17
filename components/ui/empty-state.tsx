import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-3xl border border-dashed border-brand-soft bg-brand-tint/40 px-6 py-14 text-center", className)}>
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white text-brand shadow-card">
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-stone">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
