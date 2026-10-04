import { ArrowRight } from "lucide-react";
import { buttonClass } from "@/lib/ui/button";
import { Logo } from "@/components/brand/Logo";
import { BRAND } from "@/lib/brand";

const STEPS = [
  "Personal information",
  "Education history",
  "Examination records",
  "Institutions & programs",
  "Required documents",
  "Fees & payment",
  "Review & submit",
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-paper)]">
      <header className="border-b border-[var(--color-line)] bg-[var(--color-surface)] px-5 sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 py-4">
          <Logo height={36} priority />
          <nav className="flex items-center gap-2 text-sm sm:gap-4">
            <a href="/login" className="rounded-lg px-3 py-2 font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper)]">
              Sign in
            </a>
            <span className="hidden sm:block">
              <a href="/register" className={buttonClass("secondary")}>
                Register as an applicant
              </a>
            </span>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            <p className="text-sm font-semibold text-[var(--color-brand-strong)]">{BRAND.platformName}</p>
            <h1 className="mt-4 max-w-xl text-4xl font-bold leading-[1.08] tracking-tight text-[var(--color-ink)] sm:text-5xl lg:text-6xl">
              One application. Every institution you&apos;re considering.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-[var(--color-ink-soft)]">
              Complete your personal, education and examination records, then apply to
              secondary schools, high schools, universities, vocational and professional
              schools — and track every decision from a single dashboard.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
              <a href="/register" className={buttonClass("primary")}>
                Register as an applicant
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </a>
              <a href="/login" className="text-sm font-medium text-[var(--color-ink)] underline underline-offset-4">
                I already have an account
              </a>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-8">
            <h2 className="text-base font-semibold text-[var(--color-ink)]">Your application, step by step</h2>
            <ol className="mt-5 space-y-1">
              {STEPS.map((label, i) => (
                <li key={label} className="flex items-center gap-3.5 py-1.5 text-sm text-[var(--color-ink)]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-xs font-semibold tabular-nums text-[var(--color-brand-strong)]">
                    {i + 1}
                  </span>
                  {label}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </main>

      <footer className="border-t border-[var(--color-line)] bg-[var(--color-surface)] px-5 sm:px-8">
        <div className="mx-auto w-full max-w-6xl py-6 text-xs text-[var(--color-ink-faint)]">
          {BRAND.platformName} — Applicant, Institution and Administration portals.
        </div>
      </footer>
    </div>
  );
}
