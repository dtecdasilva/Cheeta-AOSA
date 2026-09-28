"use client";

import { useState } from "react";
import type { Application, ApplicationStatus } from "@/lib/types";
import { mockDocumentStates } from "@/lib/mockData/institutions";
import { mockApplications } from "@/lib/mockData/applications";
import { Card, CardHeader, RowList, Row } from "@/components/ui";
import { PrimaryButton, SecondaryButton, TextArea } from "@/components/Form";
import { formatDateTime } from "@/lib/utils";

export default function InstitutionVerificationPanel({ application, institutionId }: { application: Application; institutionId: string }) {
  const [appState, setAppState] = useState<ApplicationStatus>(application.perInstitutionStatus[institutionId] as ApplicationStatus);
  const [docStates, setDocStates] = useState(() => ({ ...mockDocumentStates }));

  function updateApplicationStatus(status: ApplicationStatus, comment?: string) {
    const a = mockApplications.find((x) => x.id === application.id);
    if (a) {
      a.perInstitutionStatus[institutionId] = status as any;
      setAppState(status);
    }
    if (comment) {
      // store comment temporarily on the instance for mock purposes
      (a as any)._institutionComment = comment;
    }
  }

  function approvePayment() {
    updateApplicationStatus("I_ACKNOWLEDGED");
    alert("Payment approved (mock)");
  }

  function rejectPayment() {
    const reason = prompt("Enter rejection reason for payment:") ?? "";
    updateApplicationStatus("I_REJECTED", reason);
    alert("Payment rejected (mock)");
  }

  function approveDocument(docId: string) {
    mockDocumentStates[docId] = { status: "APPROVED" };
    setDocStates({ ...mockDocumentStates });
  }

  function rejectDocument(docId: string) {
    const reason = prompt("Enter rejection reason for document:") ?? "";
    mockDocumentStates[docId] = { status: "REJECTED", rejectionReason: reason };
    setDocStates({ ...mockDocumentStates });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Payment" />
        <div className="px-5 py-4">
          {application.payment ? (
            <div className="space-y-2">
              <div className="text-sm">Method: {application.payment.method}</div>
              <div className="text-sm">Reference: {application.payment.reference}</div>
              <div className="text-sm">Amount: {application.payment.amount}</div>
              <div className="text-sm">Paid at: {application.payment.paidAt ? formatDateTime(application.payment.paidAt) : "—"}</div>
              <div className="flex gap-2 mt-3">
                <PrimaryButton onClick={approvePayment}>Approve payment</PrimaryButton>
                <SecondaryButton onClick={rejectPayment}>Reject payment</SecondaryButton>
              </div>
            </div>
          ) : (
            <div className="text-sm text-[var(--color-ink-soft)]">No payment evidence provided.</div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Documents verification" description="Approve or reject uploaded documents" />
        <div className="px-5 py-4">
          {application.documents.filter((d) => d.institutionId === institutionId).length === 0 ? (
            <div className="text-sm text-[var(--color-ink-soft)]">No documents to verify.</div>
          ) : (
            <RowList>
              {application.documents
                .filter((d) => d.institutionId === institutionId)
                .map((d) => {
                  const state = docStates[d.id]?.status ?? (d.fileName ? "PENDING" : "NOT_UPLOADED");
                  const reason = docStates[d.id]?.rejectionReason;
                  return (
                    <Row
                      key={d.id}
                      title={d.requirementName}
                      subtitle={d.fileName ? `${d.fileName} · uploaded ${formatDateTime(d.uploadedAt ?? "")}` : "Not uploaded"}
                      meta={<div className="text-sm text-[var(--color-ink-soft)]">{state}{reason ? ` · ${reason}` : ""}</div>}
                      actions={
                        <div className="flex gap-2">
                          <PrimaryButton onClick={() => approveDocument(d.id)}>Approve</PrimaryButton>
                          <SecondaryButton onClick={() => rejectDocument(d.id)}>Reject</SecondaryButton>
                        </div>
                      }
                    />
                  );
                })}
            </RowList>
          )}
        </div>
      </Card>
    </div>
  );
}
