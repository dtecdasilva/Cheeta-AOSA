"use client";

import { useMemo } from "react";
import { tuitionStore, DEMO_TUITION_ID } from "@/lib/tuition/data";
import { medicalStore } from "@/lib/medical/data";
import { matriculationStore } from "@/lib/matriculation/data";
import { feePaymentStore } from "@/lib/payments/applicationFees";
import { applicationStore, studentStore } from "@/lib/admin/students";
import { institutionStore } from "@/lib/admin/institutions";
import { useParameterIndex } from "@/lib/admin/parameters";
import type { DocContext } from "@/lib/documents/data";
import { seedBankCode } from "@/lib/payments/privacy";

const DAY = 86_400_000;

/** The demo student isn't in the generated student list, so her details live here. */
const DEMO_STUDENT: DocContext["student"] = {
  firstName: "Nadège",
  lastName: "Mbarga",
  dateOfBirth: "2006-03-14",
  gender: "Female",
  email: "nadege.mbarga@example.cm",
  phone: "+237 677 21 43 90",
  address: "BP 4471, Bastos",
  town: "Yaoundé",
  region: "Centre",
  qualification: "BAC C",
};

/**
 * Everything the document builders need for one admitted student, pulled
 * from the mock stores. Returns null until the account is found.
 */
export function useDocContext(accountId: string): DocContext | null {
  const accounts = tuitionStore.useItems();
  const medical = medicalStore.useItems();
  const matric = matriculationStore.useItems();
  const fees = feePaymentStore.useItems();
  const students = studentStore.useItems();
  const applications = applicationStore.useItems();
  const institutions = institutionStore.useItems();
  const index = useParameterIndex();

  return useMemo(() => {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return null;
    const inst = institutions.find((i) => i.id === account.institutionId);
    const s = students.find((x) => x.id === account.studentId);
    const app = applications.find((x) => x.id === account.applicationId);
    const [first, ...rest] = account.studentName.split(" ");

    const student: DocContext["student"] =
      account.id === DEMO_TUITION_ID
        ? DEMO_STUDENT
        : {
            firstName: s?.firstName ?? first,
            lastName: s?.lastName ?? rest.join(" "),
            dateOfBirth: s?.dateOfBirth ?? "2005-01-01",
            gender: s?.gender ?? "—",
            email: s?.email ?? account.email,
            phone: s?.phone ?? account.phone,
            address: s?.address ?? "",
            town: s ? index.get(s.townId)?.label ?? "" : "",
            region: s ? index.get(s.regionId)?.label ?? "" : "",
            qualification: s?.highestQualification ?? "BAC D",
          };

    const admitted = new Date(account.admittedAt).getTime();
    const submittedAt = app?.history.find((h) => h.status === "SUBMITTED")?.at ?? new Date(admitted - 14 * DAY).toISOString();
    const createdAt = app?.createdAt ?? new Date(admitted - 21 * DAY).toISOString();

    return {
      account,
      student,
      institution: {
        name: inst?.name ?? "Institution",
        address: inst?.address ?? "",
        town: inst ? index.get(inst.townId)?.label ?? "" : "",
        phone: inst?.phone ?? "",
        domain: inst?.website ?? "",
        contact: inst?.contactName ?? "",
      },
      application: { reference: account.applicationRef, createdAt, submittedAt, choices: [account.programName] },
      fee: fees.find((f) => f.applicationId === account.applicationId && f.institutionId === account.institutionId) ?? demoFee(account.id, account.applicationId, account.institutionId, student, account.programName, submittedAt),
      methodLabel: (id: string) => index.get(id)?.label ?? "—",
      medical: medical.filter((m) => m.accountId === account.id),
      matric: matric.find((m) => m.id === account.id) ?? null,
    };
  }, [accountId, accounts, medical, matric, fees, students, applications, institutions, index]);
}

/**
 * Admitted students whose application predates the fee store (the demo
 * student, and the institution's topped-up intake) still paid a fee; give
 * them a settled one so their payment record isn't blank.
 */
function demoFee(accountId: string, applicationId: string, institutionId: string, s: DocContext["student"], program: string, submittedAt: string): DocContext["fee"] {
  const paid = new Date(new Date(submittedAt).getTime() - 5 * 3_600_000).toISOString();
  const approved = new Date(new Date(submittedAt).getTime() + DAY).toISOString();
  return {
    id: `fee-${accountId}`,
    applicationId,
    applicationRef: applicationId,
    studentId: accountId,
    firstName: s.firstName,
    lastName: s.lastName,
    email: s.email,
    institutionId,
    programName: program,
    method: "MTN Mobile Money",
    reference: `MTN-26-${String(accountId.length * 7919).padStart(7, "0")}`,
    receiptFile: null,
    applicationFee: 15000,
    webFee: 2500,
    amount: 17500,
    paidAt: paid,
    submittedAt: paid,
    approval: "APPROVED",
    bankCode: seedBankCode("A", new Date(approved).getUTCFullYear(), accountId),
    reviewedAt: approved,
    reviewedBy: "AOSA payments desk",
    note: "",
  };
}
