import type { PaymentMethod } from "@prisma/client";

export type PaymentOption = {
  method: PaymentMethod;
  label: string;
  hint: string;
  number?: string | null;
  holder?: string | null;
  qrUrl?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankCci?: string | null;
};

export type SavedAddress = {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  department: string;
  province: string;
  district: string;
  line: string;
  reference: string | null;
  isDefault: boolean;
};

export type CheckoutConfig = {
  pickupEnabled: boolean;
  pickupAddress: string | null;
  pickupPrice: number;
  payments: PaymentOption[];
  paymentInstructions: string | null;
  departments: string[];
  prefill: { firstName: string; lastName: string; email: string; phone: string; dni: string } | null;
  addresses: SavedAddress[];
  authenticated: boolean;
};
