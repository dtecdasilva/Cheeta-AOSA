/**
 * Every field is a plain string at this layer (including the Yes/No and
 * dropdown fields) — validation against the controlled option lists in
 * options.ts happens in validation.ts, not via a stricter type here, so
 * a bad/legacy value from the store fails validation with a clear message
 * instead of silently mismatching a union type at the type-checker level.
 *
 * `email` and `telephone` are intentionally NOT part of this record: they
 * are read from the applicant's account (src/lib/auth/users.ts) at request
 * time and shown read-only, never duplicated into a second store. See
 * db/schema.sql's `demographic_profiles` table, which likewise has no
 * email/phone columns for the same reason.
 */
export interface DemographicProfile {
  fullNameOnBirthCertificate: string;
  dateOfBirth: string; // ISO yyyy-mm-dd
  placeOfBirth: string;
  countryOfBirth: string;
  poBox: string;
  alternativeTelephone: string;
  disability: string; // "Yes" | "No"
  disabilityDetails: string;
  countryOfResidence: string;
  nationality: string;
  regionOfOrigin: string;
  divisionOfOrigin: string;
  townOfResidence: string;
  religion: string;
  maritalStatus: string;
  sex: string;
  fathersNames: string;
  mothersNames: string;
  parentsCountry: string;
  parentsTownCity: string;
  parentsAddress: string;
  parentsOccupation: string;
  parentsTelephone: string;
  parentsEmail: string;
  preferredLanguage: string;
  updatedAt: string;
}

export const EMPTY_DEMOGRAPHIC_PROFILE: Omit<DemographicProfile, "updatedAt"> = {
  fullNameOnBirthCertificate: "",
  dateOfBirth: "",
  placeOfBirth: "",
  countryOfBirth: "",
  poBox: "",
  alternativeTelephone: "",
  disability: "",
  disabilityDetails: "",
  countryOfResidence: "",
  nationality: "",
  regionOfOrigin: "",
  divisionOfOrigin: "",
  townOfResidence: "",
  religion: "",
  maritalStatus: "",
  sex: "",
  fathersNames: "",
  mothersNames: "",
  parentsCountry: "",
  parentsTownCity: "",
  parentsAddress: "",
  parentsOccupation: "",
  parentsTelephone: "",
  parentsEmail: "",
  preferredLanguage: "",
};
