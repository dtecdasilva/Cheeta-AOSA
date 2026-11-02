import { createApiCollection } from "./store";
import type { PaymentMethodType } from "@/lib/institution/paymentMethods";

/**
 * Cheeta's own collection accounts: the only accounts applicants see and
 * pay into, for the application fee with the web fee and for tuition.
 * Cheeta then pays each institution what it is owed (Payouts).
 */
export interface CollectionAccount {
  id: string;
  type: PaymentMethodType;
  label: string;
  provider: string;
  branch: string;
  accountName: string;
  accountNumber: string;
  swift: string;
  bankCode: string;
  branchCode: string;
  rib: string;
  instructions: string;
  status: "ACTIVE" | "INACTIVE";
  updatedAt: string;
}

export const collectionAccountStore = createApiCollection<CollectionAccount>("collection-accounts", () => [], {
  url: "/api/admin/collection-accounts",
  fromApi: (row) => row as unknown as CollectionAccount,
  // Only the account's own details go back: the server keeps them as Cheeta's, always usable.
  toApi: ({ type, label, provider, branch, accountName, accountNumber, swift, bankCode, branchCode, rib, instructions, status }) => ({ type, label, provider, branch, accountName, accountNumber, swift, bankCode, branchCode, rib, instructions, status }),
  canRemove: true,
});
