"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, TableFrame, Td, Th } from "@/components/ui";
import { Field, FormError, PrimaryButton, TextInput } from "@/components/Form";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency, formatDate } from "@/lib/utils";
import DeliberationsList from "./DeliberationsList";

interface Overview {
  fees: { subscriptionFee: number | null; perNameFee: number | null; set: boolean };
  canDeliberate: boolean;
  canRequest: boolean;
  subscription: { status: "PENDING" | "ACTIVE" | "REJECTED" | "CANCELLED" | "EXPIRED"; subscriptionFee: number; perNameFee: number; decisionNote: string; endsAt: string | null; paymentReference: string } | null;
  namesOnList: number;
  charges: { names: number; amount: number; unpaid: number };
}

interface ListedName {
  id: string;
  reference: string;
  applicantName: string;
  acknowledgedAt: string;
  choices: { rank: number; programName: string }[];
}

/** Where this institution stands on deliberation, from /api/institution/deliberation. */
function useDeliberationOverview() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/institution/deliberation", { cache: "no-store" });
      const body = await res.json();
      if (res.ok) setOverview(body.data);
      else setError(body.error ?? "Could not load the deliberation details.");
    } catch {
      setError("Could not load the deliberation details. Check your connection.");
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { overview, error, reload };
}

/**
 * The institution's deliberation screen.
 *
 * Every institution gets the Deliberation List and can reject
 * applications. Deliberating itself (admitting applicants through the
 * platform) is a paid service: an annual subscription plus a fee for each
 * applicant name on the list. This shows which side of that line the
 * institution is on, lets its administrator ask to subscribe, and only
 * shows the deliberation tools once the subscription is active. The
 * server enforces the same rule, whatever this screen shows.
 */
export default function DeliberationAccess({ institutionId }: { institutionId: string }) {
  const { user } = useAuth();
  const { overview, error, reload } = useDeliberationOverview();
  const [names, setNames] = useState<ListedName[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/institution/deliberation/list", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (res.ok) setNames(body.data);
        else setListError(body.error ?? "Could not load the deliberation list.");
      })
      .catch(() => setListError("Could not load the deliberation list. Check your connection."));
  }, []);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch("/api/institution/deliberation/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentReference: reference, note }) });
      const body = await res.json();
      if (!res.ok) setFormError(body.fieldErrors?.paymentReference ?? body.error ?? "Could not send the request.");
      else await reload();
    } catch {
      setFormError("Could not send the request. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const sub = overview?.subscription ?? null;
  const isAdmin = user?.role === "INSTITUTION_ADMIN";

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">Deliberation</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-[var(--color-ink-soft)]">
              Your Deliberation List is always available, and you can reject an application at any time. Admitting applicants through the platform is a paid service: an annual
              subscription, plus a fee for each applicant name on the list.
            </p>
          </div>
          {overview && (
            <span
              className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                overview.canDeliberate
                  ? "bg-[var(--color-success-soft)] text-[var(--color-success-strong)]"
                  : sub?.status === "PENDING"
                  ? "bg-[var(--color-warning-soft)] text-[var(--color-warning-strong)]"
                  : "bg-[var(--color-line)]/60 text-[var(--color-ink-soft)]"
              }`}
            >
              {overview.canDeliberate ? "Subscription active" : sub?.status === "PENDING" ? "Awaiting approval" : "Not subscribed"}
            </span>
          )}
        </div>

        {error && <div className="mt-4"><FormError>{error}</FormError></div>}

        {overview && (
          <div className="mt-4 space-y-4 text-sm">
            <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-3">
              <div>
                <dt className="text-[var(--color-ink-soft)]">Annual subscription</dt>
                <dd className="font-medium text-[var(--color-ink)]">{(sub && overview.canDeliberate ? sub.subscriptionFee : overview.fees.subscriptionFee) === null ? "Not set yet" : formatCurrency((sub && overview.canDeliberate ? sub.subscriptionFee : overview.fees.subscriptionFee) as number)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-soft)]">Per applicant name</dt>
                <dd className="font-medium text-[var(--color-ink)]">{(sub && overview.canDeliberate ? sub.perNameFee : overview.fees.perNameFee) === null ? "Not set yet" : formatCurrency((sub && overview.canDeliberate ? sub.perNameFee : overview.fees.perNameFee) as number)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-soft)]">Names on your list</dt>
                <dd className="font-medium text-[var(--color-ink)]">{overview.namesOnList}</dd>
              </div>
            </dl>

            {overview.canDeliberate && sub && (
              <p className="text-[var(--color-ink-soft)]">
                Active until <span className="font-medium text-[var(--color-ink)]">{formatDate(sub.endsAt)}</span>. {overview.charges.names} name{overview.charges.names === 1 ? "" : "s"} charged so far, {formatCurrency(overview.charges.amount)} in total
                {overview.charges.unpaid > 0 ? `, of which ${formatCurrency(overview.charges.unpaid)} is still to pay.` : "."}
              </p>
            )}
            {!overview.canDeliberate && sub?.status === "PENDING" && (
              <p className="text-[var(--color-ink-soft)]">
                Your request (payment reference <span className="font-medium text-[var(--color-ink)]">{sub.paymentReference || "none"}</span>) is waiting for Cheeta to confirm the payment. Deliberation opens as soon as it is approved.
              </p>
            )}
            {!overview.canDeliberate && sub?.status === "REJECTED" && <p className="text-[var(--color-danger-strong)]">Your last request was not approved{sub.decisionNote ? `: ${sub.decisionNote}` : "."}</p>}
            {!overview.canDeliberate && sub?.status === "EXPIRED" && <p className="text-[var(--color-ink-soft)]">Your subscription ended on {formatDate(sub.endsAt)}. Renew it to deliberate again.</p>}
            {!overview.canDeliberate && !overview.fees.set && <p className="text-[var(--color-ink-soft)]">The deliberation fees haven&apos;t been announced yet, so subscriptions aren&apos;t open.</p>}

            {overview.canRequest && (
              <form onSubmit={request} className="grid gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field label="Payment reference for the annual fee" required={(overview.fees.subscriptionFee ?? 0) > 0}>
                  <TextInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. transfer or mobile money reference" />
                </Field>
                <Field label="Note (optional)">
                  <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
                <PrimaryButton type="submit" disabled={busy}>
                  {busy ? "Sending…" : "Request subscription"}
                </PrimaryButton>
                {formError && <div className="sm:col-span-3"><FormError>{formError}</FormError></div>}
              </form>
            )}
            {!overview.canDeliberate && !overview.canRequest && overview.fees.set && sub?.status !== "PENDING" && !isAdmin && (
              <p className="text-[var(--color-ink-soft)]">Only your institution&apos;s administrator can subscribe.</p>
            )}
          </div>
        )}
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-[var(--color-ink)]">Deliberation List</h2>
        {listError ? (
          <FormError>{listError}</FormError>
        ) : (
          <TableFrame>
            <thead>
              <tr>
                <Th>Applicant</Th>
                <Th>Reference</Th>
                <Th>Program choices</Th>
                <Th>On the list since</Th>
              </tr>
            </thead>
            <tbody>
              {!names && (
                <tr>
                  <Td className="text-[var(--color-ink-soft)]">Loading…</Td>
                </tr>
              )}
              {names && names.length === 0 && (
                <tr>
                  <Td className="text-[var(--color-ink-soft)]">No applicants are awaiting deliberation. Applicants appear here once their application is acknowledged.</Td>
                </tr>
              )}
              {(names ?? []).map((n) => (
                <tr key={n.id}>
                  <Td className="font-medium text-[var(--color-ink)]">{n.applicantName}</Td>
                  <Td className="font-mono text-xs">{n.reference}</Td>
                  <Td>{n.choices.length ? n.choices.map((c) => `${c.rank}. ${c.programName}`).join("  ·  ") : "—"}</Td>
                  <Td className="whitespace-nowrap">{formatDate(n.acknowledgedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </section>

      {overview?.canDeliberate && <DeliberationsList institutionId={institutionId} />}
    </div>
  );
}

/**
 * Wraps a deliberation tool so it only shows for an institution whose
 * subscription is active; anyone else is told why and sent back.
 */
export function DeliberationGate({ children }: { children: React.ReactNode }) {
  const { overview, error } = useDeliberationOverview();
  if (error) return <FormError>{error}</FormError>;
  if (!overview) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;
  if (overview.canDeliberate) return <>{children}</>;
  return (
    <Card>
      <p className="text-base font-semibold text-[var(--color-ink)]">Deliberation needs an active subscription</p>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Your institution isn&apos;t subscribed to deliberation at the moment. You can still see your Deliberation List and reject applications.</p>
      <Link href="/institution/deliberations" className="mt-3 inline-block text-sm text-[var(--color-ink)] underline underline-offset-4">
        Back to deliberation
      </Link>
    </Card>
  );
}
