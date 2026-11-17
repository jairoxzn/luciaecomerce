import { Check, X } from "lucide-react";
import { ORDER_STATUS_LABEL } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import type { OrderView } from "@/lib/services/order-queries";

/** Historial de estados con fecha, observación y responsable. */
export function OrderTimeline({ history, showActor = false }: { history: OrderView["history"]; showActor?: boolean }) {
  return (
    <ol className="relative space-y-5 border-l-2 border-brand-soft/70 pl-6">
      {history.map((h, i) => {
        const last = i === history.length - 1;
        const cancelled = h.status === "CANCELADO";
        return (
          <li key={h.id} className="relative">
            <span className={cn("absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white", cancelled ? "border-red-400 text-red-500" : last ? "border-brand bg-brand text-white" : "border-brand-soft text-brand")}>
              {cancelled ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
            </span>
            <p className={cn("text-sm font-semibold", last && !cancelled && "text-brand")}>{ORDER_STATUS_LABEL[h.status]}</p>
            <p className="text-xs text-stone">{formatDate(h.createdAt, true)}{showActor && h.by ? ` · ${h.by}` : ""}</p>
            {h.note && <p className="mt-1 text-sm text-stone">{h.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}
