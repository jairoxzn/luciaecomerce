import Image from "next/image";
import type { PaymentOption } from "./types";

/** Datos de pago (provienen de Configuración; nada hardcodeado). */
export function PaymentDetails({ option, instructions, amount }: { option: PaymentOption; instructions?: string | null; amount?: string }) {
  if (option.method === "COD") {
    return <p className="rounded-2xl bg-brand-tint/60 p-4 text-sm text-stone">Pagarás en efectivo al recibir tu pedido. Ten el monto exacto listo para agilizar la entrega.</p>;
  }
  return (
    <div className="rounded-2xl border border-brand-soft bg-brand-tint/40 p-4 text-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {option.qrUrl && (
          <div className="relative mx-auto h-44 w-44 shrink-0 overflow-hidden rounded-2xl bg-white p-2 shadow-card">
            <Image src={option.qrUrl} alt={`Código QR de ${option.label}`} fill sizes="176px" className="object-contain p-2" />
          </div>
        )}
        <dl className="space-y-1.5">
          {amount && (
            <div className="flex gap-2"><dt className="text-stone">Monto a pagar:</dt><dd className="font-bold text-brand">{amount}</dd></div>
          )}
          {option.method === "TRANSFER" ? (
            <>
              {option.bankName && <div className="flex gap-2"><dt className="text-stone">Banco:</dt><dd className="font-semibold">{option.bankName}</dd></div>}
              {option.bankAccountNumber && <div className="flex gap-2"><dt className="text-stone">N.° de cuenta:</dt><dd className="font-semibold">{option.bankAccountNumber}</dd></div>}
              {option.bankCci && <div className="flex gap-2"><dt className="text-stone">CCI:</dt><dd className="font-semibold">{option.bankCci}</dd></div>}
              {option.holder && <div className="flex gap-2"><dt className="text-stone">Titular:</dt><dd className="font-semibold">{option.holder}</dd></div>}
            </>
          ) : (
            <>
              {option.number && <div className="flex gap-2"><dt className="text-stone">{option.label}:</dt><dd className="text-base font-bold">{option.number}</dd></div>}
              {option.holder && <div className="flex gap-2"><dt className="text-stone">A nombre de:</dt><dd className="font-semibold">{option.holder}</dd></div>}
            </>
          )}
        </dl>
      </div>
      {instructions && <p className="mt-3 border-t border-brand-soft/60 pt-3 text-xs text-stone">{instructions}</p>}
    </div>
  );
}
