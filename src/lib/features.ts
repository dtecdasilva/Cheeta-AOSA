/**
 * Modules that can be switched off until they are released.
 *
 * Deliberation (admission rules, deliberation runs, publishing offers,
 * provisional admission, the deliberation subscription and its report) is
 * off unless NEXT_PUBLIC_DELIBERATION_ENABLED is "true". While it is off,
 * its pages show "Coming soon", its API routes answer 404 (src/proxy.ts)
 * and the screens that link to it hide those links.
 *
 * NEXT_PUBLIC_ values are fixed when the app is built, so the same value is
 * seen by the proxy, the server and the browser. Changing it takes a
 * redeploy.
 */
export const DELIBERATION_ENABLED = process.env.NEXT_PUBLIC_DELIBERATION_ENABLED === "true";

/** Pages that belong to the deliberation module. */
const DELIBERATION_PAGES = ["/institution/deliberations", "/institution/rules", "/institution/admissions/provisional"];

/** API routes that belong to the deliberation module. */
const DELIBERATION_APIS = [
  "/api/institution/deliberation",
  "/api/institution/admission-rules",
  "/api/institution/admissions/provisional",
  "/api/admin/deliberation",
  "/api/reports/deliberation",
];

const under = (pathname: string, prefixes: string[]) => prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));

/** "page" or "api" when the path belongs to a module that is switched off. */
export function disabledFeatureArea(pathname: string): "page" | "api" | null {
  if (DELIBERATION_ENABLED) return null;
  if (under(pathname, DELIBERATION_APIS)) return "api";
  if (under(pathname, DELIBERATION_PAGES)) return "page";
  return null;
}

export const COMING_SOON_PATH = "/institution/coming-soon";
