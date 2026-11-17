"use client";

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { markMessageReadAction } from "@/app/admin/actions/customers";
import { Button } from "@/components/ui/button";

export function MarkReadButton({ id }: { id: string }) {
  const router = useRouter();
  return <Button size="sm" variant="outline" onClick={async () => { await markMessageReadAction(id); router.refresh(); }}><Check className="h-4 w-4" /> Marcar como leído</Button>;
}
