import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-paper)]">
      <header className="flex items-center justify-between px-8 py-6 sm:px-16">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Cheeta AOSA logo" width={24} height={24} className="h-6 w-6 object-contain" />
          <span className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">Cheeta AOSA</span>
        </div>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/login" className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
            Sign in
          </Link>
          <Link
            href="/register"
            className="border border-[var(--color-ink)] px-4 py-2 text-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white transition-colors"
          >
            Register as an applicant
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col justify-center px-8 py-16 sm:px-16">
        <div className="grid max-w-6xl gap-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm text-[var(--color-brass-dark)]">Cheeta Academia Online School Application Platform</p>
            <h1 className="mt-4 max-w-xl font-[var(--font-display)] text-5xl leading-[1.08] text-[var(--color-ink)] sm:text-6xl">
              One application. Every institution you&apos;re considering.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-[var(--color-ink-soft)]">
              Complete your personal, education and examination records, then apply to
              secondary schools, high schools, universities, vocational and professional
              schools — and track every decision from a single dashboard.
            </p>
            <div className="mt-9 flex items-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-[var(--color-ink)] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brass-dark)]"
              >
                Register as an applicant
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
              </Link>
              <Link href="/login" className="text-sm font-medium text-[var(--color-ink)] underline underline-offset-4">
                I already have an account
              </Link>
            </div>
          </div>

          <div className="self-center border border-[var(--color-line)] bg-[var(--color-surface)]">
            <table className="w-full border-collapse text-sm">
              <caption className="border-b border-[var(--color-line)] px-5 py-3 text-left font-[var(--font-display)] text-base text-[var(--color-ink)]">
                Your application, step by step
              </caption>
              <tbody>
                {[
                  ["1", "Personal information"],
                  ["2", "Education history"],
                  ["3", "Examination records"],
                  ["4", "Institutions & programs"],
                  ["5", "Required documents"],
                  ["6", "Fees & payment"],
                  ["7", "Review & submit"],
                ].map(([n, label]) => (
                  <tr key={n} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="w-12 px-5 py-3 text-[var(--color-ink-faint)]">{n}</td>
                    <td className="px-5 py-3 text-[var(--color-ink)]">{label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="border-t border-[var(--color-line)] px-8 py-6 text-xs text-[var(--color-ink-faint)] sm:px-16">
        Cheeta Academia Online School Application Platform — Applicant, Institution and Administration portals.
      </footer>
    </div>
  );
}
