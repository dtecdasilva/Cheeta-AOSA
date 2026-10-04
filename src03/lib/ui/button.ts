/**
 * The three button treatments in the Cheeta identity.
 *
 * - `primary`   Cheeta Orange, white text. The main action on a screen;
 *               aim for one per view so the orange keeps its meaning.
 * - `secondary` White, black border, black text. Everything alongside it.
 * - `dark`      Cheeta Black, white text. A strong action that isn't the
 *               primary one.
 *
 * This file has no "use client" directive on purpose, so server
 * components can style a <Link> or <a> as a button. Client code can use
 * it too, or the <PrimaryButton>/<SecondaryButton>/<DarkButton> components
 * in components/Form.tsx.
 */
export type ButtonVariant = "primary" | "secondary" | "dark";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)]",
  secondary:
    "border border-[var(--color-ink)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-paper)]",
  dark: "bg-[var(--color-ink)] text-white hover:bg-[var(--color-ink-2)]",
};

export function buttonClass(variant: ButtonVariant = "primary") {
  return `${BASE} ${VARIANTS[variant]}`;
}
