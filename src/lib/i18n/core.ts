import { Fragment, createElement, type ReactNode } from "react";
import { FR } from "./fr";

/**
 * The platform's two languages. Text is written in English in the code and
 * looked up by that English text: `t("Save")` is "Enregistrer" in French,
 * and anything without a French entry yet shows in English, so nothing is
 * ever blank. Values go in braces: `t("Showing {n} of {total}", { n, total })`.
 * A value that is itself an element (a link, bold text) is kept as one.
 */

export type Lang = "en" | "fr";
export const LANGS: Lang[] = ["en", "fr"];
export const DEFAULT_LANG: Lang = "en";
export const LANG_COOKIE = "lang";
export const LANG_NAMES: Record<Lang, string> = { en: "English", fr: "Français" };

export function normalizeLang(v: unknown): Lang | null {
  if (typeof v !== "string") return null;
  const l = v.trim().slice(0, 2).toLowerCase();
  return l === "fr" ? "fr" : l === "en" ? "en" : null;
}

const DICTIONARIES: Record<Lang, Record<string, string>> = { en: {}, fr: FR };

export type Vars = Record<string, ReactNode>;

export interface Translate {
  (key: string, vars?: Record<string, string | number | null | undefined>): string;
  (key: string | undefined, vars?: Record<string, string | number | null | undefined>): string | undefined;
  (key: ReactNode, vars?: Vars): ReactNode;
}

function format(template: string, vars?: Vars): ReactNode {
  if (!vars) return template;
  const parts = template.split(/\{(\w+)\}/);
  const rich = Object.values(vars).some((v) => v !== null && typeof v === "object");
  if (!rich) return parts.map((p, i) => (i % 2 ? String(vars[p] ?? "") : p)).join("");
  return parts.map((p, i) => (i % 2 ? createElement(Fragment, { key: i }, vars[p]) : p));
}

/** The text in `lang`: the dictionary's entry, or the English itself. Anything that isn't text is returned as it is. */
export function translate(lang: Lang, key: ReactNode, vars?: Vars): ReactNode {
  if (typeof key !== "string") return key;
  const dict = DICTIONARIES[lang];
  const hit = dict[key] ?? (key.trim() !== key ? withSpaces(dict, key) : undefined);
  return format(hit ?? key, vars);
}

function withSpaces(dict: Record<string, string>, key: string): string | undefined {
  const core = key.trim();
  const hit = dict[core];
  return hit === undefined ? undefined : key.slice(0, key.indexOf(core)) + hit + key.slice(key.indexOf(core) + core.length);
}

export function makeT(lang: Lang): Translate {
  return ((key: ReactNode, vars?: Vars) => translate(lang, key, vars)) as Translate;
}
