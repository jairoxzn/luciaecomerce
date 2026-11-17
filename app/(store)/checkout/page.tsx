import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getCheckoutConfig } from "@/lib/services/checkout-config";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const config = await getCheckoutConfig();
  return (
    <div className="container-page py-8 sm:py-12">
      <h1 className="mb-8 text-3xl font-extrabold tracking-tight">Finalizar compra</h1>
      <CheckoutForm config={config} />
    </div>
  );
}
