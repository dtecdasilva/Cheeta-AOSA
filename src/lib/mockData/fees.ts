// Mock fees and payment status for the demo Fee Summary page.

export type OtherFee = {
  id: string;
  label: string;
  amount: number; // stored in base currency (XAF)
};

export const mockOtherFees: Record<string, OtherFee[]> = {
  "inst-1": [
    { id: "of-1", label: "Transcript processing", amount: 2000 },
    { id: "of-2", label: "Late submission penalty", amount: 1500 },
  ],
  "inst-2": [{ id: "of-3", label: "Practical exam fee", amount: 3000 }],
  "inst-3": [],
  "inst-4": [{ id: "of-4", label: "Administrative surcharge", amount: 500 }],
};

export type PaymentStatus = "PAID" | "PARTIAL" | "UNPAID";

export const mockPaymentStatus: Record<string, { status: PaymentStatus; paidAmount?: number }> = {
  "inst-1": { status: "PAID", paidAmount: 18500 },
  "inst-2": { status: "PARTIAL", paidAmount: 5000 },
  "inst-3": { status: "UNPAID" },
  "inst-4": { status: "UNPAID" },
};
