"use client";

import { useMemo } from "react";
import { useAdminData, type AdminApplication } from "@/lib/admin/useAdminData";
import { seededRandom } from "@/lib/admin/store";
import { STAGES, reachedStages, stageLabel, type StageKey } from "@/lib/admin/status";
import { feePaymentStore, institutionFeeView, type FeePayment } from "@/lib/payments/applicationFees";
import { figures, institutionTuitionView, tuitionStore, type TuitionAccount } from "@/lib/tuition/data";
import { medicalStore, recordsByAccount, type MedicalRecord } from "@/lib/medical/data";
import { buildRow, matriculationStore, type MatricRow } from "@/lib/matriculation/data";
import { maskFullName, maskName } from "@/lib/payments/privacy";
import { mockAnchor } from "@/lib/admin/store";

/**
 * Everything the reports read, gathered once. Each builder turns the raw
 * stores into flat rows for one report. `institutionId` scopes rows to one
 * institution; `masked` marks rows the institution may only see as
 * "<name> — awaiting payment" (lib/payments/privacy.ts).
 */
export function useReportSources() {
  const admin = useAdminData();
  const fees = feePaymentStore.useItems();
  const accounts = tuitionStore.useItems();
  const medical = medicalStore.useItems();
  const matric = matriculationStore.useItems();
  return useMemo(() => {
    const feeByApp = new Map<string, FeePayment>();
    for (const f of fees) {
      const prev = feeByApp.get(f.applicationId);
      if (!prev || prev.submittedAt < f.submittedAt) feeByApp.set(f.applicationId, f);
    }
    const byAccount = recordsByAccount(medical);
    const matricById = new Map(matric.map((m) => [m.id, m]));
    const matricRows = accounts.map((a) => buildRow(a, byAccount.get(a.id) ?? [], matricById.get(a.id)));
    return { ...admin, fees, feeByApp, accounts, medical, matricRows };
  }, [admin, fees, accounts, medical, matric]);
}

export type Sources = ReturnType<typeof useReportSources>;

export interface Base {
  id: string;
  masked: boolean;
  maskedName: string;
}

const DAY = 86_400_000;
const days = (from: string, to: string | number) => Math.max(0, Math.round(((typeof to === "number" ? to : new Date(to).getTime()) - new Date(from).getTime()) / DAY));

function scopeApps(s: Sources, institutionId?: string) {
  return s.applications.filter((a) => !institutionId || a.institutionId === institutionId);
}

/** Masked for an institution when the student's fee is paid but not approved by AOSA. */
function appMasked(s: Sources, a: AdminApplication, institutionId?: string) {
  if (!institutionId) return false;
  const f = s.feeByApp.get(a.id);
  return !!f && institutionFeeView(f).state === "AWAITING";
}

function appBase(s: Sources, a: AdminApplication, institutionId?: string) {
  const st = s.studentById.get(a.studentId);
  return {
    id: a.id,
    masked: appMasked(s, a, institutionId),
    maskedName: st ? maskName(st.firstName, st.lastName) : "Student",
    reference: a.reference,
    student: s.studentLabel(a.studentId),
    registrationNo: st?.registrationNo ?? "",
    institutionId: a.institutionId,
    institution: s.institutionName(a.institutionId),
    program: a.programName,
    status: a.status,
  };
}

// ---------------------------------------------------------------------------

export function registrationRows(s: Sources) {
  return s.students.map((st) => ({
    id: st.id,
    masked: false,
    maskedName: "",
    registrationNo: st.registrationNo,
    name: `${st.firstName} ${st.lastName}`,
    gender: st.gender,
    region: s.label(st.regionId),
    regionId: st.regionId,
    town: s.label(st.townId),
    qualification: st.highestQualification,
    source: st.source,
    email: st.email,
    registeredAt: st.registeredAt,
    applications: s.appsByStudent.get(st.id)?.length ?? 0,
  }));
}

export function applicationRows(s: Sources, institutionId?: string) {
  return scopeApps(s, institutionId).map((a) => {
    const f = s.feeByApp.get(a.id);
    const feeState = !f ? "NONE" : institutionId ? (institutionFeeView(f).state === "PAID" ? "APPROVED" : "AWAITING") : f.approval;
    return { ...appBase(s, a, institutionId), feeState, createdAt: a.createdAt, updatedAt: a.updatedAt };
  });
}

export function progressionRows(s: Sources, institutionId?: string) {
  const now = mockAnchor().getTime() + DAY;
  return scopeApps(s, institutionId).map((a) => {
    const reached = reachedStages(a);
    const current = [...STAGES].reverse().find((st) => reached.has(st.key))!.key as StageKey;
    const last = a.history[a.history.length - 1];
    const final = ["I_REJECTED", "A_ACKNOWLEDGED", "A_REJECTED"].includes(a.status);
    return {
      ...appBase(s, a, institutionId),
      app: a,
      reached: reached.size,
      current,
      currentLabel: stageLabel(current),
      final,
      daysInStage: days(last.at, now),
      daysTotal: days(a.createdAt, final ? last.at : now),
      createdAt: a.createdAt,
    };
  });
}

export function paymentRows(s: Sources, institutionId?: string) {
  type Row = Base & {
    kind: "Application fee" | "Tuition";
    student: string;
    reference: string;
    institutionId: string;
    institution: string;
    program: string;
    method: string;
    paymentRef: string;
    institutionAmount: number;
    webFee: number;
    total: number;
    state: "AWAITING" | "APPROVED" | "REJECTED";
    bankCode: string;
    recordedAt: string;
    approvedAt: string | null;
  };
  const rows: Row[] = [];
  for (const f of s.fees) {
    if (institutionId && f.institutionId !== institutionId) continue;
    const v = institutionFeeView(f);
    rows.push({
      id: f.id,
      masked: !!institutionId && v.state === "AWAITING",
      maskedName: maskName(f.firstName, f.lastName),
      kind: "Application fee",
      student: `${f.firstName} ${f.lastName}`,
      reference: f.applicationRef,
      institutionId: f.institutionId,
      institution: s.institutionName(f.institutionId),
      program: f.programName,
      method: f.method,
      paymentRef: f.reference,
      institutionAmount: f.applicationFee,
      webFee: f.webFee,
      total: f.amount,
      state: institutionId && f.approval === "REJECTED" ? "AWAITING" : f.approval,
      bankCode: f.bankCode ?? "",
      recordedAt: f.submittedAt,
      approvedAt: f.approval === "APPROVED" ? f.reviewedAt : null,
    });
  }
  for (const a of s.accounts) {
    if (institutionId && a.institutionId !== institutionId) continue;
    for (const p of a.payments) {
      // Rejected tuition payments are between AOSA and the student.
      if (institutionId && p.status === "REJECTED") continue;
      const state = p.status === "VERIFIED" ? "APPROVED" : p.status === "REJECTED" ? "REJECTED" : "AWAITING";
      rows.push({
        id: p.id,
        masked: !!institutionId && state === "AWAITING",
        maskedName: maskFullName(a.studentName),
        kind: "Tuition",
        student: a.studentName,
        reference: a.applicationRef,
        institutionId: a.institutionId,
        institution: s.institutionName(a.institutionId),
        program: a.programName,
        method: s.label(p.methodId),
        paymentRef: p.reference,
        institutionAmount: p.amount,
        webFee: 0,
        total: p.amount,
        state,
        bankCode: p.bankCode ?? "",
        recordedAt: p.recordedAt,
        approvedAt: p.status === "VERIFIED" ? [...p.reviews].reverse().find((r) => r.action === "VERIFIED")?.at ?? null : null,
      });
    }
  }
  return rows;
}

export function acknowledgedRows(s: Sources, institutionId?: string) {
  return scopeApps(s, institutionId).flatMap((a) =>
    a.history
      .filter((h) => h.status === "I_ACKNOWLEDGED" || h.status === "A_ACKNOWLEDGED")
      .map((h) => ({
        ...appBase(s, a, institutionId),
        id: `${a.id}-${h.status}`,
        by: h.status === "I_ACKNOWLEDGED" ? "Institution" : "Applicant (offer taken up)",
        byKey: h.status,
        at: h.at,
        daysFromSubmission: days(a.history.find((x) => x.status === "SUBMITTED")?.at ?? a.createdAt, h.at),
      }))
  );
}

export function rejectedRows(s: Sources, institutionId?: string) {
  return scopeApps(s, institutionId).flatMap((a) =>
    a.history
      .filter((h) => h.status === "I_REJECTED" || h.status === "A_REJECTED")
      .map((h) => ({
        ...appBase(s, a, institutionId),
        id: `${a.id}-${h.status}`,
        by: h.status === "I_REJECTED" ? "Institution" : "Applicant (declined offer)",
        byKey: h.status,
        reason: h.note,
        at: h.at,
        daysFromSubmission: days(a.history.find((x) => x.status === "SUBMITTED")?.at ?? a.createdAt, h.at),
      }))
  );
}

function hashRandom(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return seededRandom(h >>> 0);
}

export function deliberationRows(s: Sources, institutionId?: string) {
  return scopeApps(s, institutionId)
    .filter((a) => a.history.some((h) => h.status === "I_ACKNOWLEDGED"))
    .map((a) => {
      const rnd = hashRandom(a.id);
      const decision = a.history.find((h) => h.status === "ACCEPTED" || h.status === "I_REJECTED");
      const outcome = !decision ? "PENDING" : decision.status === "ACCEPTED" ? "ADMITTED" : "NOT_ADMITTED";
      const score = outcome === "ADMITTED" ? 62 + Math.floor(rnd() * 33) : outcome === "NOT_ADMITTED" ? 28 + Math.floor(rnd() * 34) : null;
      const r = rnd();
      return {
        ...appBase(s, a, institutionId),
        session: decision?.at ?? null,
        rule: r < 0.6 ? "2026 intake, standard" : r < 0.85 ? "2026 intake, merit ranking" : "2026 intake, quota",
        score,
        choice: outcome === "ADMITTED" ? (rnd() < 0.75 ? 1 : 2) : 1 + Math.floor(rnd() * 3),
        outcome,
        acknowledgedAt: a.history.find((h) => h.status === "I_ACKNOWLEDGED")!.at,
      };
    });
}

export function admissionRows(s: Sources, institutionId?: string) {
  const now = mockAnchor().getTime() + DAY;
  return scopeApps(s, institutionId)
    .filter((a) => a.history.some((h) => h.status === "ACCEPTED"))
    .map((a) => {
      const offered = a.history.find((h) => h.status === "ACCEPTED")!.at;
      const reply = a.history.find((h) => h.status === "A_ACKNOWLEDGED" || h.status === "A_REJECTED");
      return {
        ...appBase(s, a, institutionId),
        offeredAt: offered,
        response: !reply ? "AWAITING" : reply.status === "A_ACKNOWLEDGED" ? "TAKEN_UP" : "DECLINED",
        respondedAt: reply?.at ?? null,
        daysToRespond: reply ? days(offered, reply.at) : days(offered, now),
      };
    });
}

export function tuitionRows(s: Sources, institutionId?: string) {
  return s.accounts
    .filter((a) => !institutionId || a.institutionId === institutionId)
    .map((a: TuitionAccount) => {
      const f = figures(a);
      const v = institutionTuitionView(a);
      return {
        id: a.id,
        masked: !!institutionId && v.masked,
        maskedName: v.displayName,
        student: a.studentName,
        registrationNo: a.registrationNo,
        institutionId: a.institutionId,
        institution: s.institutionName(a.institutionId),
        program: a.programName,
        category: s.label(a.feeCategoryId),
        tuition: a.tuitionAmount,
        verified: f.verified,
        awaiting: f.awaiting,
        outstanding: f.outstanding,
        paymentStatus: f.paymentStatus,
        verificationStatus: f.verificationStatus,
        institutionState: v.state,
        toReconcile: v.toReconcile,
        admittedAt: a.admittedAt,
      };
    });
}

export function medicalRows(s: Sources, institutionId?: string) {
  return s.medical
    .filter((r) => !institutionId || r.institutionId === institutionId)
    .map((r: MedicalRecord) => ({ ...r, masked: false, maskedName: "", institution: s.institutionName(r.institutionId) }));
}

export function matriculationRows(s: Sources, institutionId?: string) {
  return s.matricRows
    .filter((r) => !institutionId || r.account.institutionId === institutionId)
    .map((r: MatricRow) => ({
      id: r.account.id,
      masked: !!institutionId && r.maskedForInstitution,
      maskedName: maskFullName(r.account.studentName),
      student: r.account.studentName,
      registrationNo: r.account.registrationNo,
      institutionId: r.account.institutionId,
      institution: s.institutionName(r.account.institutionId),
      program: r.account.programName,
      admission: r.admission,
      tuition: r.tuition,
      medical: r.medical,
      status: r.status,
      code: r.record?.code ?? "",
      matriculatedAt: r.record?.matriculatedAt ?? null,
      admittedAt: r.account.admittedAt,
    }));
}
