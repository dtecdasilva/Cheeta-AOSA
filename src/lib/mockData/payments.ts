import { Institution } from "@/lib/types";
import { mockInstitutions } from "./institutions";

export type BankAccountConfig = {
  accountName: string;
  accountNumber: string;
  bankName: string;
  branch?: string;
  instructions?: string;
};

export type MobileMoneyConfig = {
  operator: string;
  accountNumber: string;
  accountName?: string;
  instructions?: string;
};

export type MoneyTransferConfig = {
  provider: string;
  recipientName: string;
  referenceFormat: string;
  instructions?: string;
};

export type DebitWalletConfig = {
  walletName: string;
  walletId: string;
  instructions?: string;
};

export type InstitutionPaymentConfig = {
  institutionId: string;
  bank?: BankAccountConfig;
  mobileMoney?: MobileMoneyConfig[];
  moneyTransfer?: MoneyTransferConfig[];
  debitWallet?: DebitWalletConfig;
};

export const mockPaymentConfigs: InstitutionPaymentConfig[] = mockInstitutions.map((i) => {
  if (i.id === "inst-oxf") {
    return {
      institutionId: i.id,
      bank: {
        accountName: "Oxbridge International Univ. - Applications",
        accountNumber: "1234567890",
        bankName: "First Global Bank",
        branch: "Oxford Branch",
        instructions: "Deposit the exact amount and include your application ID as reference.",
      },
      mobileMoney: [
        { operator: "MobiCash", accountNumber: "+441234567890", accountName: "Oxbridge Applications", instructions: "Send with application reference." },
      ],
      moneyTransfer: [
        { provider: "QuickSend", recipientName: "Oxbridge Intl Univ", referenceFormat: "APP-{applicationId}", instructions: "Use the APP-<id> reference when sending." },
      ],
      debitWallet: { walletName: "GlobalPay Wallet", walletId: "GW-001", instructions: "Open your wallet app and send to the institution wallet." },
    };
  }

  if (i.id === "inst-ken") {
    return {
      institutionId: i.id,
      bank: {
        accountName: "Kenvale Polytechnic Applications",
        accountNumber: "9988776655",
        bankName: "Kenya National Bank",
        branch: "Nairobi Main",
      },
      mobileMoney: [
        { operator: "M-Kopa", accountNumber: "+254700111222", accountName: "Kenvale Fees" },
        { operator: "MobiCash", accountNumber: "+254711222333", accountName: "Kenvale Payments" },
      ],
      moneyTransfer: [],
      debitWallet: { walletName: "KenWallet", walletId: "KW-09" },
    };
  }

  return { institutionId: i.id };
});

export function getPaymentConfigForInstitution(id: string) {
  return mockPaymentConfigs.find((c) => c.institutionId === id) ?? null;
}
