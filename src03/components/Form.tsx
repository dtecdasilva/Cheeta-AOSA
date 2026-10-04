"use client";

import React, { useId } from "react";
import { buttonClass, type ButtonVariant } from "@/lib/ui/button";

/**
 * Form primitives. Every input and button in the platform goes through
 * these so the border, radius, focus treatment, sizing and disabled state
 * are defined once — screens that reached for a raw
 * `<input className="border px-3 py-2">` ended up with the browser's
 * default grey border instead of --color-line-strong, which is why the
 * institution portal's filters looked unlike every other form.
 */

const CONTROL_CLASS =
  "w-full rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] " +
  "placeholder:text-[var(--color-ink-faint)] transition-colors " +
  "focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/25 " +
  "disabled:cursor-not-allowed disabled:bg-[var(--color-paper)] disabled:text-[var(--color-ink-faint)]";

/**
 * Wraps a control with its label, required marker, hint and error.
 *
 * If no `htmlFor` is given, a generated id is passed down to the child
 * control automatically, so a label is always associated with something —
 * several call sites previously rendered a bare <label> next to an input
 * with no relationship between them, which screen readers can't follow.
 */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const generatedId = useId();
  const controlId = htmlFor ?? generatedId;

  // Attach the id to the control when the caller hasn't set one itself.
  const child =
    React.isValidElement<{ id?: string; "aria-invalid"?: boolean }>(children) && !children.props.id
      ? React.cloneElement(children, { id: controlId, "aria-invalid": error ? true : undefined })
      : children;

  return (
    <div>
      <label htmlFor={controlId} className="mb-1.5 block text-sm font-medium text-[var(--color-ink)]">
        {label}
        {required && <span className="text-[var(--color-danger)]"> *</span>}
      </label>
      {child}
      {error ? (
        <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{hint}</p>
      )}
    </div>
  );
}

export function TextInput({ className = "", ...props }: React.ComponentProps<"input">) {
  return <input {...props} className={`${CONTROL_CLASS} ${className}`} />;
}

export function SelectInput({ className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CONTROL_CLASS} ${className}`} />;
}

export function TextArea({ className = "", ...props }: React.ComponentProps<"textarea">) {
  return <textarea {...props} className={`${CONTROL_CLASS} ${className}`} />;
}

export function PrimaryButton({
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`${buttonClass("primary")} ${className}`}>
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`${buttonClass("secondary")} ${className}`}>
      {children}
    </button>
  );
}

export function DarkButton({
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`${buttonClass("dark")} ${className}`}>
      {children}
    </button>
  );
}

/**
 * Link styled as a button. Use this instead of nesting a <button> inside
 * a <Link> — that produced invalid markup (interactive element inside an
 * anchor) and swallowed keyboard activation.
 *
 * Client components only. In a server component, import `buttonClass`
 * from "@/lib/ui/button" instead — it returns the same string.
 */
export function ButtonLinkClass(variant: ButtonVariant = "primary") {
  return buttonClass(variant);
}

/** Error summary shown above a form's submit button. */
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger-strong)]"
    >
      {children}
    </p>
  );
}
