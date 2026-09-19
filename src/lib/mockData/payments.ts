import { mockInstitutions } from "./institutions";

const INST_A = "inst-1";
const INST_B = "inst-2";

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
  if (i.id === INST_A) {
    return {
      institutionId: i.id,
      bank: {
        accountName: "Mont Fébé University — Applications",
        accountNumber: "CM21 10005 00012 09876543210 88",
        bankName: "Afriland First Bank",
        branch: "Mont Fébé Branch",
        instructions: "Deposit the exact amount and include your application ID as reference.",
      },
      mobileMoney: [
        { operator: "MTN MoMo", accountNumber: "+237 677 000 100", accountName: "Mont Fébé Applications", instructions: "Send with your application reference." },
      ],
      moneyTransfer: [
        { provider: "Express Union", recipientName: "Mont Fébé University", referenceFormat: "APP-{applicationId}", instructions: "Use the APP-<id> reference when sending." },
      ],
      debitWallet: { walletName: "Orange Money Wallet", walletId: "MFU-001", instructions: "Open your wallet app and send to the institution wallet." },
    };
  }

  if (i.id === INST_B) {
    return {
      institutionId: i.id,
      bank: {
        accountName: "Sanaga Polytechnic — Applications",
        accountNumber: "CM21 10033 00044 01234567890 21",
        bankName: "Société Générale Cameroun",
        branch: "Douala Bonanjo",
      },
      mobileMoney: [
        { operator: "Orange Money", accountNumber: "+237 699 000 200", accountName: "Sanaga Fees" },
        { operator: "MTN MoMo", accountNumber: "+237 677 000 200", accountName: "Sanaga Payments" },
      ],
      moneyTransfer: [],
      debitWallet: { walletName: "Sanaga Wallet", walletId: "SNG-09" },
    };
  }

  return { institutionId: i.id };
});

export function getPaymentConfigForInstitution(id: string) {
  return mockPaymentConfigs.find((c) => c.institutionId === id) ?? null;
}
