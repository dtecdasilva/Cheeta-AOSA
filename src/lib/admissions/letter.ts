/**
 * The admission letter's content and wording, shared by the PDF the server
 * issues and the preview on the institution's screen, so the two always
 * say the same thing. It is written in the applicant's language.
 */

import { translate, type Lang } from "@/lib/i18n/core";

export type AdmissionStatus = "PENDING" | "OFFERED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

export const ADMISSION_STATUS_LABELS: Record<AdmissionStatus, string> = { PENDING: "Pending", OFFERED: "Offered", ACCEPTED: "Taken up", REJECTED: "Declined", WITHDRAWN: "Withdrawn" };

export type AdmissionType = "FULL" | "PROVISIONAL";
export type ConditionStatus = "PENDING" | "MET" | "NOT_MET";
export const CONDITION_STATUS_LABELS: Record<ConditionStatus, string> = { PENDING: "Conditions pending", MET: "Conditions met", NOT_MET: "Conditions not met" };

export interface AdmissionLetterContent {
  admissionId: string;
  admissionNumber: string;
  status: AdmissionStatus;
  /** ISO dates. */
  admissionDate: string;
  issuedAt: string | null;
  institution: { name: string; address: string; town: string; phone: string; email: string; website: string };
  applicant: { name: string; email: string };
  applicationNumber: string;
  program: { name: string; code: string; faculty: string; department: string; qualification: string; durationYears: number; studyMode: string; language: string };
  choice: number;
  runNumber: number | null;
  /** The letter's language: the applicant's. */
  language: Lang;
  /** Set while the admission is provisional: the conditions still to be met, and by when (ISO, or null). */
  provisional: { conditions: string; deadline: string | null } | null;
}

const ORDINAL = ["", "first", "second", "third"];
const ORDINAL_FR = ["", "premier", "deuxième", "troisième"];

/** "21 October 2026" (or "21 octobre 2026"), in Cameroon's time. */
export function letterDate(iso: string, lang: Lang = "en"): string {
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Douala" }).format(new Date(iso));
}

function years(n: number, lang: Lang): string {
  const v = n % 1 === 0 ? String(n) : lang === "fr" ? n.toFixed(1).replace(".", ",") : n.toFixed(1);
  return lang === "fr" ? `${v} ${n < 2 ? "an" : "ans"}` : `${v} ${n === 1 ? "year" : "years"}`;
}

/** The letter's wording, in the applicant's language (`c.language`). */
export function letterText(c: AdmissionLetterContent) {
  return c.language === "fr" ? letterTextFr(c) : letterTextEn(c);
}

function letterTextEn(c: AdmissionLetterContent) {
  const i = c.institution.name;
  const p = c.provisional;
  return {
    title: p ? "Provisional admission letter" : "Admission letter",
    subject: `${p ? "Provisional offer" : "Offer"} of admission: ${c.program.name}`,
    greeting: `Dear ${c.applicant.name},`,
    opening: p
      ? [
          `We are pleased to inform you that, following the admission deliberation of ${i}, you have been offered provisional admission to the study program below, which was your ${ORDINAL[c.choice] ?? `number ${c.choice}`} choice.`,
          `This admission is provisional until the following conditions are met${p.deadline ? `, no later than ${letterDate(p.deadline)}` : ""}: ${p.conditions}`,
          `Once ${i} has confirmed that the conditions are met, you will receive a full admission letter. If they are not met, the offer will be withdrawn, and you cannot be matriculated in the meantime.`,
        ]
      : [
          `We are pleased to inform you that, following the admission deliberation of ${i}, you have been offered admission to the study program below, which was your ${ORDINAL[c.choice] ?? `number ${c.choice}`} choice.`,
        ],
    details: [
      ["Study program", c.program.code ? `${c.program.name} (${c.program.code})` : c.program.name],
      ["Faculty / School", c.program.faculty],
      ["Department", c.program.department],
      ["Qualification", c.program.qualification],
      ["Duration", years(c.program.durationYears, "en")],
      ["Mode of study", c.program.studyMode],
      ["Language of instruction", c.program.language],
    ] as [string, string][],
    stepsTitle: "What to do next",
    steps: [
      "Sign in to Cheeta Academia Online and take up this offer from your application.",
      `Follow ${i}'s instructions for registration and the payment of fees.`,
      "Bring this letter and the originals of the documents you uploaded when you register.",
    ],
    conditions: `This offer is made on application ${c.applicationNumber} and depends on the information and documents you submitted being true and authentic.`,
    closing: ["Yours faithfully,", "The Admissions Office", i],
    reference: [
      ["Admission No.", c.admissionNumber],
      ["Application ID", c.applicationNumber],
      ["Date", letterDate(c.admissionDate)],
    ] as [string, string][],
    footer: `Issued through Cheeta Academia Online · ${c.admissionNumber}`,
    fileName: `${p ? "Provisional-admission" : "Admission"}-letter-${c.admissionNumber}.pdf`,
  };
}

function letterTextFr(c: AdmissionLetterContent) {
  const i = c.institution.name;
  const p = c.provisional;
  const rank = ORDINAL_FR[c.choice] ?? `n° ${c.choice}`;
  return {
    title: p ? "Lettre d'admission provisoire" : "Lettre d'admission",
    subject: `${p ? "Offre d'admission provisoire" : "Offre d'admission"} : ${c.program.name}`,
    greeting: `Madame, Monsieur ${c.applicant.name},`,
    opening: p
      ? [
          `Nous avons le plaisir de vous informer qu'à l'issue de la délibération d'admission de ${i}, une admission provisoire vous est proposée dans la filière ci-dessous, qui était votre ${rank} choix.`,
          `Cette admission reste provisoire jusqu'à ce que les conditions suivantes soient remplies${p.deadline ? `, au plus tard le ${letterDate(p.deadline, "fr")}` : ""} : ${p.conditions}`,
          `Dès que ${i} aura confirmé que les conditions sont remplies, vous recevrez une lettre d'admission définitive. Si elles ne le sont pas, l'offre sera retirée ; vous ne pouvez pas être immatriculé dans l'intervalle.`,
        ]
      : [`Nous avons le plaisir de vous informer qu'à l'issue de la délibération d'admission de ${i}, une admission vous est proposée dans la filière ci-dessous, qui était votre ${rank} choix.`],
    details: [
      ["Filière", c.program.code ? `${c.program.name} (${c.program.code})` : c.program.name],
      ["Faculté / École", c.program.faculty],
      ["Département", c.program.department],
      ["Diplôme", c.program.qualification],
      ["Durée", years(c.program.durationYears, "fr")],
      ["Mode d'études", translate("fr", c.program.studyMode) as string],
      ["Langue d'enseignement", translate("fr", c.program.language) as string],
    ] as [string, string][],
    stepsTitle: "Ce que vous devez faire ensuite",
    steps: [
      "Connectez-vous à Cheeta Academia Online et acceptez cette offre depuis votre candidature.",
      `Suivez les instructions de ${i} pour l'inscription et le paiement des frais.`,
      "Apportez cette lettre et les originaux des documents téléversés lors de votre inscription.",
    ],
    conditions: `Cette offre est faite sur la base de la candidature ${c.applicationNumber} et suppose que les informations et documents que vous avez soumis sont exacts et authentiques.`,
    closing: ["Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.", "Le Service des admissions", i],
    reference: [
      ["N° d'admission", c.admissionNumber],
      ["N° de candidature", c.applicationNumber],
      ["Date", letterDate(c.admissionDate, "fr")],
    ] as [string, string][],
    footer: `Délivrée via Cheeta Academia Online · ${c.admissionNumber}`,
    fileName: `${p ? "Admission-provisoire" : "Admission"}-lettre-${c.admissionNumber}.pdf`,
  };
}
