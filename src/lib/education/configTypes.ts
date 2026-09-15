/**
 * A "school type" an applicant can record in their education history
 * (Primary School, Secondary School, ...), together with the qualifications
 * valid for that level. This is deliberately its own configuration domain,
 * separate from INSTITUTION_TYPES (src/lib/data.ts) — INSTITUTION_TYPES is
 * "what kind of institution can an applicant apply TO", this is "what kind
 * of school did an applicant attend BEFORE now", and the two lists differ
 * (education history includes Primary School, which nobody applies to
 * through this platform).
 */
export interface QualificationOption {
  id: string;
  label: string;
}

export interface EducationLevelConfig {
  id: string;
  name: string;
  order: number;
  qualifications: QualificationOption[];
}
