import "server-only";
import { cookies, headers } from "next/headers";
import { DEFAULT_LANG, LANG_COOKIE, makeT, normalizeLang, type Lang, type Translate } from "./core";

/** The visitor's language: the one they chose (cookie), else their browser's if it is French, else English. */
export async function getLang(): Promise<Lang> {
  const chosen = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
  if (chosen) return chosen;
  const accept = (await headers()).get("accept-language") ?? "";
  const first = accept.split(",").map((x) => normalizeLang(x)).find(Boolean);
  return first ?? DEFAULT_LANG;
}

/** The translate function for server components. */
export async function getT(): Promise<Translate> {
  return makeT(await getLang());
}
