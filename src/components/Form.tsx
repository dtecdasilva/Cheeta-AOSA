"use client";

import React, { useId } from "react";

/**
 * Form primitives. Every input in the platform goes through these so the
 * border, focus ring, sizing and disabled treatment are defined once —
 * screens that reached for a raw `<input className="border px-3 py-2">`
 * ended up with the browser's default grey border instead of
 * --color-line-strong, which is why the institution portal's filters
 * looked unlike every other form.
 */

const CONTROL_CLASS =
  "w-full border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] " +
  "placeholder:text-[var(--color-ink-faint)] transition-colors focus:border-[var(--color-brass)] " +
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
      <label htmlFor={controlId} className="mb-1.5 block text-sm text-[var(--color-ink-soft)]">
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

export function TextInput({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL_CLASS} ${className}`} />;
}

export function SelectInput({ className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CONTROL_CLASS} ${className}`} />;
}

export function TextArea({ className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL_CLASS} ${className}`} />;
}

export function PrimaryButton({
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brass-dark)] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
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
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Link styled as a primary button. Use this instead of nesting a
 * <button> inside a <Link> — that produced invalid markup (interactive
 * element inside an anchor) and swallowed keyboard activation.
 */
export function ButtonLinkClass(variant: "primary" | "secondary" = "primary") {
  return variant === "primary"
    ? "inline-flex items-center justify-center gap-2 bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brass-dark)]"
    : "inline-flex items-center justify-center gap-2 border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]";
}

/** Error summary shown above a form's submit button. */
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]"
    >
      {children}
    </p>
  );
}
