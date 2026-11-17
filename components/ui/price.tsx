import { cn, formatPEN } from "@/lib/utils";

export function Price({ price, compareAt, className, size = "md" }: { price: number; compareAt?: number | null; className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "text-sm", md: "text-base", lg: "text-2xl" };
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      <span className={cn("font-bold", sizes[size], compareAt ? "text-brand" : "text-ink")}>{formatPEN(price)}</span>
      {compareAt ? <span className={cn("text-stone line-through", size === "lg" ? "text-base" : "text-xs")}>{formatPEN(compareAt)}</span> : null}
    </div>
  );
}
