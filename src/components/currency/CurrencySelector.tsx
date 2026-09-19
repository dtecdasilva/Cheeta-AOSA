"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { getCurrencies } from "@/lib/currency/getCurrencies";
import { CurrencyInfo } from "@/lib/currency/data";

interface CurrencySelectorProps {
  label: string;
  value: string; // currency code, e.g. "XAF"
  onChange: (code: string) => void;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  error?: string;
}

/**
 * The one reusable Currency selector for the whole app. A short,
 * independent combobox rather than sharing code with CountrySelect
 * (src/components/CountrySelect.tsx) — that component is already built
 * and tested, and with only ~10 currencies (vs. ~65 countries) a second,
 * smaller implementation is lower risk than reworking a working one to
 * share a base. Data always comes from getCurrencies()
 * (src/lib/currency/getCurrencies.ts), never a list hard-coded here.
 */
export function CurrencySelector({
  label,
  value,
  onChange,
  id,
  required,
  disabled,
  hint,
  error,
}: CurrencySelectorProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-listbox`;

  const [currencies, setCurrencies] = useState<CurrencyInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getCurrencies().then((list) => {
      if (!cancelled) setCurrencies(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = currencies.find((c) => c.code === value);
  const displayLabel = selected ? `${selected.code} — ${selected.name}` : value;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return currencies;
    return currencies.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [currencies, query]);

  function select(code: string) {
    onChange(code);
    setQuery("");
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
      if (choice) select(choice.code);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
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
          placeholder="Search by code or name…"
          value={open ? query : displayLabel}
          onFocus={() => {
            setQuery("");
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
            <li className="px-3 py-2 text-sm text-[var(--color-ink-faint)]">No matching currency</li>
          ) : (
            filtered.map((c, i) => (
              <li
                key={c.code}
                role="option"
                aria-selected={c.code === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(c.code);
                }}
                onMouseEnter={() => setHighlighted(i)}
                className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                  i === highlighted ? "bg-[var(--color-brass-soft)] text-[var(--color-ink)]" : "text-[var(--color-ink-soft)]"
                } ${c.code === value ? "font-medium" : ""}`}
              >
                <span>
                  {c.code} — {c.name}
                </span>
                <span className="text-[var(--color-ink-faint)]">{c.symbol}</span>
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
