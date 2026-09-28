"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { getCountries } from "@/lib/countries/getCountries";

interface CountrySelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  error?: string;
}

/**
 * The one reusable Country selector for the whole app — Country of
 * Birth, Nationality, Country of Residence, Previous Education Country,
 * and anywhere else a country needs picking, all use this exact
 * component rather than each form defining its own <select> and country
 * array. Data comes from getCountries() (src/lib/countries/getCountries.ts),
 * never a list hard-coded in this file or the caller.
 *
 * A combobox rather than a plain <select>: with ~65 options, typing "ni"
 * to jump straight to Nigeria/Niger is materially faster than scrolling
 * a native dropdown, and this is the shared place that behavior lives.
 */
export function CountrySelect({
  label,
  value,
  onChange,
  id,
  required,
  disabled,
  placeholder = "Start typing a country…",
  hint,
  error,
}: CountrySelectProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-listbox`;

  const [countries, setCountries] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getCountries().then((list) => {
      if (!cancelled) setCountries(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Note: `query` only drives what's displayed while `open` (see the
  // input's `value={open ? query : value}` below); the closed state
  // always shows `value` directly, and `onFocus` re-syncs `query` from
  // `value` every time the dropdown opens — so there's no need for an
  // effect to keep them in sync outside of that.

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value); // discard an unselected, half-typed query
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((c) => c.toLowerCase().includes(q));
  }, [countries, query]);

  function select(country: string) {
    onChange(country);
    setQuery(country);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const choice = filtered[highlighted];
      if (choice) select(choice);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery(value);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label htmlFor={inputId} className="mb-1.5 block text-sm text-[var(--color-ink-soft)]">
        {label}
        {required && <span className="text-[var(--color-danger)]"> *</span>}
      </label>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-ink-faint)]"
          strokeWidth={1.75}
        />
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={open ? query : value}
          onFocus={() => {
            setQuery(value);
            setOpen(true);
            setHighlighted(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlighted(0);
          }}
          onKeyDown={handleKeyDown}
          className="w-full border border-[var(--color-line-strong)] bg-[var(--color-surface)] py-2 pl-9 pr-8 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-brass)] disabled:bg-[var(--color-paper)] disabled:text-[var(--color-ink-faint)]"
        />
        <ChevronDown
          className={`pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-ink-faint)] transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={1.75}
        />
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="scrollbar-thin absolute z-20 mt-1 max-h-56 w-full overflow-y-auto border border-[var(--color-line-strong)] bg-[var(--color-surface)] shadow-sm"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[var(--color-ink-faint)]">No matching country</li>
          ) : (
            filtered.map((country, i) => (
              <li
                key={country}
                role="option"
                aria-selected={country === value}
                onMouseDown={(e) => {
                  // onMouseDown, not onClick: fires before the input's
                  // blur/click-outside handler would otherwise close this
                  // list first and discard the selection.
                  e.preventDefault();
                  select(country);
                }}
                onMouseEnter={() => setHighlighted(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  i === highlighted ? "bg-[var(--color-brass-soft)] text-[var(--color-ink)]" : "text-[var(--color-ink-soft)]"
                } ${country === value ? "font-medium" : ""}`}
              >
                {country}
              </li>
            ))
          )}
        </ul>
      )}

      {hint && !error && <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{hint}</p>}
      {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
