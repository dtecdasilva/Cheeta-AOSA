export const mockInstitutionPortalCounts: Record<string, { applications: number; pending: number; paymentVerification: number; uploadVerification: number; acknowledged: number; rejected: number; deliberation: number; accepted: number }> = {
  "inst-1": { applications: 42, pending: 15, paymentVerification: 6, uploadVerification: 7, acknowledged: 8, rejected: 3, deliberation: 5, accepted: 4 },
  "inst-oxf": { applications: 28, pending: 10, paymentVerification: 3, uploadVerification: 4, acknowledged: 5, rejected: 2, deliberation: 2, accepted: 3 },
  "inst-ken": { applications: 17, pending: 6, paymentVerification: 2, uploadVerification: 3, acknowledged: 3, rejected: 1, deliberation: 1, accepted: 2 },
};
