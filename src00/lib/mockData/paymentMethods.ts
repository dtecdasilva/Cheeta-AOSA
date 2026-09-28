export type PaymentMethodType = "bank" | "money_transfer" | "mobile_operator" | "debit_wallet";

export interface BankDetails {
  accountName: string;
  accountNumber: string;
  bankName: string;
  swift?: string;
  notes?: string;
}

export interface MobileOperatorDetails {
  operator: string;
  number: string;
  accountName?: string;
  notes?: string;
}

export interface MoneyTransferDetails {
  provider: string;
  instructions: string;
}

export interface DebitWalletDetails {
  provider: string;
  walletId: string;
  instructions?: string;
}

export interface PaymentMethodConfig {
  id: string;
  institutionId: string;
  type: PaymentMethodType;
  label: string;
  active: boolean;
  bank?: BankDetails;
  mobile?: MobileOperatorDetails;
  money?: MoneyTransferDetails;
  wallet?: DebitWalletDetails;
}

export const mockPaymentMethods: PaymentMethodConfig[] = [
  {
    id: "pm-1-bank-1",
    institutionId: "inst-1",
    type: "bank",
    label: "Main bank account",
    active: true,
    bank: {
      accountName: "Mont Fébé University — Applications",
      accountNumber: "CM21 10005 00012 09876543210 88",
      bankName: "Afriland First Bank",
      swift: "CCEICMCX",
      notes: "Use your application ID as the deposit reference.",
    },
  },
  {
    id: "pm-1-mobile-1",
    institutionId: "inst-1",
    type: "mobile_operator",
    label: "MTN Mobile Money",
    active: true,
    mobile: {
      operator: "MTN MoMo",
      number: "+237 677 000 100",
      accountName: "Mont Fébé Applications",
      notes: "Include your application reference in the message.",
    },
  },
  {
    id: "pm-2-wallet-1",
    institutionId: "inst-2",
    type: "debit_wallet",
    label: "Sanaga debit wallet",
    active: true,
    wallet: {
      provider: "Orange Money",
      walletId: "SNG-ACCT-001",
      instructions: "Send with the applicant's full name.",
    },
  },
  {
    id: "pm-2-money-1",
    institutionId: "inst-2",
    type: "money_transfer",
    label: "Express Union",
    active: false,
    money: {
      provider: "Express Union",
      instructions: "Send to account name: Sanaga Polytechnic Finance.",
    },
  },
];
