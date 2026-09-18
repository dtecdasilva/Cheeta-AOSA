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
    id: "pm-oxf-bank-1",
    institutionId: "inst-oxf",
    type: "bank",
    label: "Main bank account",
    active: true,
    bank: {
      accountName: "Oxbridge Int. Univ.",
      accountNumber: "GB29NWBK60161331926819",
      bankName: "National Westminster",
      swift: "NWBKGB2L",
      notes: "Use reference: applicant ID",
    },
  },
  {
    id: "pm-oxf-mobile-1",
    institutionId: "inst-oxf",
    type: "mobile_operator",
    label: "Oxbridge Mobile Pay",
    active: true,
    mobile: { operator: "OxPay", number: "+441865000100", accountName: "Oxbridge Payments", notes: "Include application reference" },
  },
  {
    id: "pm-ken-wallet-1",
    institutionId: "inst-ken",
    type: "debit_wallet",
    label: "Kenvale Debit Wallet",
    active: true,
    wallet: { provider: "MobiCash", walletId: "KEN-ACCT-001", instructions: "Send with applicant name" },
  },
  {
    id: "pm-ken-money-1",
    institutionId: "inst-ken",
    type: "money_transfer",
    label: "Western Union",
    active: false,
    money: { provider: "Western Union", instructions: "Send to account name Kenvale Finance" },
  },
];
