import {
  LayoutGrid,
  Route,
  FileText,
  Building2,
  Wallet,
  SendHorizonal,
  Bell,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export interface NavLink {
  label: string;
  href: string;
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  children: NavLink[];
}

export interface NavTopLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

export type NavEntry = ({ kind: "link" } & NavTopLink) | ({ kind: "group" } & NavGroup);

/**
 * Single source of truth for the student portal's navigation. Every item
 * required by the spec is here; items other than Dashboard and The Process
 * Flow currently point at placeholder pages (see app/student/**\/page.tsx)
 * until their modules are built — the links are real and stable now so
 * nothing has to change here when that happens, only the pages they point to.
 */
export const STUDENT_NAV: NavEntry[] = [
  { kind: "link", label: "Dashboard", href: "/student/dashboard", icon: LayoutGrid },
  { kind: "link", label: "The Process Flow", href: "/student/process-flow", icon: Route },
  {
    kind: "group",
    label: "My Application",
    icon: FileText,
    children: [
      { label: "Application Summary", href: "/student/application/summary" },
      { label: "Demographic Information", href: "/student/application/demographic" },
      { label: "Education Information", href: "/student/application/education" },
      { label: "Examinations Information", href: "/student/application/examinations" },
      { label: "Results Information", href: "/student/application/results" },
    ],
  },
  {
    kind: "group",
    label: "My Institutions",
    icon: Building2,
    children: [
      { label: "Institution Summary", href: "/student/institutions/summary" },
      // Deliberately NOT pointed at the old /student/applications/new flow.
      // That screen creates a whole new multi-institution Application bundle
      // (a different data shape than "add one institution to my ongoing
      // application," which is what this nav item means in the new IA).
      // Reusing it here would be forcing a mismatched flow into this slot,
      // not genuine reuse — so this stays a clean placeholder until the
      // real add-institution flow is built against the correct model.
      { label: "Add Institution", href: "/student/institutions/add" },
      { label: "Institution Upload", href: "/student/institutions/upload" },
    ],
  },
  {
    kind: "group",
    label: "My Application Fees",
    icon: Wallet,
    children: [
      { label: "Application Fee Summary", href: "/student/fees/summary" },
      { label: "View Payment Options", href: "/student/fees/payment-options" },
      { label: "Add Bank Account Payment", href: "/student/fees/payment/bank-account" },
      { label: "Add Money Transfer Payment", href: "/student/fees/payment/money-transfer" },
      { label: "Add Mobile Operator Payment", href: "/student/fees/payment/mobile-operator" },
      { label: "Add Debit Wallet Payment", href: "/student/fees/payment/debit-wallet" },
    ],
  },
  {
    kind: "group",
    label: "View/Submit My Application",
    icon: SendHorizonal,
    children: [{ label: "Print/Submit My Application", href: "/student/submit/print-submit" }],
  },
];

/** Utility items kept separate from the specified IA — already built in an
 * earlier module, so they stay available rather than being removed. */
export const STUDENT_NAV_UTILITY: NavTopLink[] = [
  { label: "Notifications", href: "/student/notifications", icon: Bell },
  { label: "Profile", href: "/student/profile", icon: UserRound },
];
