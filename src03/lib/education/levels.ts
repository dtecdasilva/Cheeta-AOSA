/**
 * The school types an applicant can record in their education history and
 * the qualifications valid for each. This is the initial list the database
 * is seeded with (`education_levels`, `education_qualifications`); after
 * that the database is the source, served by /api/config/education-levels.
 */
export const EDUCATION_LEVEL_SEED: { name: string; qualifications: string[] }[] = [
  { name: "Primary School", qualifications: ["No Qualification", "First School Leaving Certificate (FSLC)", "Common Entrance"] },
  { name: "Secondary School", qualifications: ["No Qualification", "GCE O Level", "BEPC", "Probatoire"] },
  { name: "High School", qualifications: ["No Qualification", "GCE A Level", "Baccalaureate/BAC"] },
  {
    name: "Vocational School",
    qualifications: ["No Qualification", "CAP (Certificat d'Aptitude Professionnelle)", "Technical Probatoire", "Technical Baccalaureate"],
  },
  { name: "Professional School", qualifications: ["No Qualification", "Professional Diploma", "Higher Technician Diploma (HND)"] },
  { name: "University", qualifications: ["No Qualification", "Bachelor's Degree", "Master's Degree", "Doctorate / PhD"] },
];
