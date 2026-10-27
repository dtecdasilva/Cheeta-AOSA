"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LANG, LANG_COOKIE, makeT, type Lang, type Translate } from "./core";

const LangContext = createContext<Lang>(DEFAULT_LANG);

/** Set once at the root from the language cookie, so server and client render in the same language. */
export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

/** The translate function for the current language. */
export function useT(): Translate {
  const lang = useLang();
  return useMemo(() => makeT(lang), [lang]);
}

/** Changes the language: remembered in a cookie for a year (and on the account, when signed in), then every screen is redrawn. */
export function useSetLang() {
  const router = useRouter();
  return useCallback(
    async (lang: Lang) => {
      document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = lang;
      await fetch("/api/me/language", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language: lang }) }).catch(() => undefined);
      router.refresh();
    },
    [router]
  );
}

/**
 * Text translated where it is shown, for components that are drawn both on
 * the server and in the browser (and so can't use a hook or getT):
 * `<T>Complete</T>`, `<T vars={{ n }}>{"Step {n}"}</T>`.
 */
export function T({ children, vars }: { children: ReactNode; vars?: Record<string, ReactNode> }) {
  const t = useT();
  return <>{t(children, vars)}</>;
}
