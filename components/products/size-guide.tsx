"use client";

import { useState } from "react";
import { Ruler } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import type { SizeGuideSection } from "@/lib/services/settings";

export function SizeGuideButton({ guide }: { guide: SizeGuideSection[] }) {
  const [open, setOpen] = useState(false);
  if (!guide.length) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand underline-offset-4 hover:underline">
        <Ruler className="h-4 w-4" /> Guía de tallas
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Guía de tallas" description="Medidas aproximadas del cuerpo en centímetros." size="lg">
        <div className="space-y-6">
          {guide.map((s) => (
            <section key={s.title}>
              <h3 className="mb-2 text-sm font-semibold">{s.title}</h3>
              <div className="overflow-x-auto rounded-xl border border-neutral-100">
                <table className="w-full text-sm">
                  <thead className="bg-brand-tint text-left">
                    <tr>{s.headers.map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {s.rows.map((r, i) => (
                      <tr key={i} className="border-t border-neutral-100">
                        {r.map((c, j) => <td key={j} className={j === 0 ? "px-4 py-2.5 font-semibold" : "px-4 py-2.5 text-stone"}>{c}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </Modal>
    </>
  );
}
