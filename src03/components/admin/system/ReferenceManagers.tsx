"use client";

import { RecordManager } from "@/components/admin/RecordManager";
import { SubNav, ToneBadge } from "@/components/admin/ui";
import {
  BASE_CURRENCY,
  WORLD_REGION_LABELS,
  countryStore,
  currencyStore,
  rateStore,
  type AdminCountry,
  type AdminCurrency,
  type WorldRegion,
} from "@/lib/admin/reference";

export const SYSTEM_NAV = [
  { label: "System config", href: "/admin/config" },
  { label: "Countries", href: "/admin/config/countries" },
  { label: "Currencies", href: "/admin/config/currencies" },
  { label: "Exchange rates", href: "/admin/config/exchange-rates" },
];

const regionOptions = (Object.keys(WORLD_REGION_LABELS) as WorldRegion[]).map((r) => ({ value: r, label: WORLD_REGION_LABELS[r] }));

export function CountryManager() {
  const currencies = currencyStore.useItems();
  return (
    <RecordManager<AdminCountry>
      title="Countries"
      description="The countries offered for nationality, country of birth and residence on every applicant form."
      intro={<SubNav items={SYSTEM_NAV} current="/admin/config/countries" />}
      singular="country"
      plural="countries"
      store={countryStore}
      idPrefix="country"
      nameOf={(c) => c.name}
      sort={(a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)}
      searchPlaceholder="Name, ISO code or dialling code"
      searchText={(c) => [c.name, c.iso2, c.iso3, c.dialCode, c.currencyCode]}
      filters={[{ key: "region", label: "Region", options: regionOptions, get: (c) => c.region }]}
      stats={(items) => [
        { label: "Countries", value: items.length },
        { label: "Active", value: items.filter((c) => c.status === "ACTIVE").length },
        { label: "Offered as nationality", value: items.filter((c) => c.status === "ACTIVE" && c.nationality).length },
        { label: "Offered as residence", value: items.filter((c) => c.status === "ACTIVE" && c.residence).length },
      ]}
      blank={() => ({
        id: "",
        name: "",
        iso2: "",
        iso3: "",
        dialCode: "+",
        region: "OTHER",
        currencyCode: "",
        nationality: true,
        residence: true,
        sortOrder: 0,
        status: "ACTIVE",
        updatedAt: "",
      })}
      fields={[
        { key: "name", label: "Country name", kind: "text", required: true },
        { key: "iso2", label: "ISO code (2 letters)", kind: "text", required: true, uppercase: true, placeholder: "CM", hint: "ISO 3166-1 alpha-2." },
        { key: "iso3", label: "ISO code (3 letters)", kind: "text", uppercase: true, placeholder: "CMR", hint: "ISO 3166-1 alpha-3. Optional." },
        { key: "dialCode", label: "Dialling code", kind: "text", required: true, placeholder: "+237" },
        { key: "region", label: "Region", kind: "select", required: true, options: regionOptions },
        {
          key: "currencyCode",
          label: "Currency",
          kind: "text",
          uppercase: true,
          placeholder: "XAF",
          hint: currencies.length ? `Three-letter ISO 4217 code. Platform currencies: ${currencies.map((c) => c.code).join(", ")}.` : undefined,
        },
        { key: "sortOrder", label: "Display order", kind: "number", required: true, min: 0, max: 100000, hint: "Lower numbers come first in the country pickers; ties are in name order." },
        { key: "nationality", label: "Nationality", kind: "checkbox", checkboxLabel: "Offer as a nationality" },
        { key: "residence", label: "Residence", kind: "checkbox", checkboxLabel: "Offer as a country of residence" },
      ]}
      validate={(c, all, editingId) => ({
        iso2: !/^[A-Z]{2}$/.test(c.iso2) ? "Use two letters, for example CM." : all.some((x) => x.id !== editingId && x.iso2 === c.iso2) ? "Another country already uses this code." : undefined,
        iso3: c.iso3 && !/^[A-Z]{3}$/.test(c.iso3) ? "Use three letters, for example CMR." : c.iso3 && all.some((x) => x.id !== editingId && x.iso3 === c.iso3) ? "Another country already uses this code." : undefined,
        sortOrder: !Number.isInteger(c.sortOrder) ? "Enter a whole number." : undefined,
        dialCode: !/^\+\d{1,4}$/.test(c.dialCode) ? "Use + followed by 1 to 4 digits, for example +237." : undefined,
        currencyCode: c.currencyCode && !/^[A-Z]{3}$/.test(c.currencyCode) ? "Use three letters, for example XAF." : undefined,
        name: all.some((x) => x.id !== editingId && x.name.toLowerCase() === c.name.toLowerCase()) ? "This country is already on the list." : undefined,
      })}
      beforeSave={(c) => (c.id ? c : { ...c, id: `country-${c.iso2.toLowerCase()}` })}
      columns={[
        {
          label: "Country",
          render: (c) => (
            <>
              <p className="font-medium text-[var(--color-ink)]">{c.name}</p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{WORLD_REGION_LABELS[c.region]}</p>
            </>
          ),
        },
        { label: "ISO", render: (c) => <span className="font-mono">{[c.iso2, c.iso3].filter(Boolean).join(" / ")}</span> },
        { label: "Order", align: "right", render: (c) => c.sortOrder },
        { label: "Dialling code", render: (c) => <span className="tabular-nums">{c.dialCode}</span> },
        { label: "Currency", render: (c) => c.currencyCode || "—" },
        {
          label: "Offered for",
          render: (c) =>
            [c.nationality && "Nationality", c.residence && "Residence"].filter(Boolean).join(", ") || <span className="text-[var(--color-ink-faint)]">Nothing</span>,
        },
      ]}
    />
  );
}

export function CurrencyManager() {
  const rates = rateStore.useItems();
  return (
    <RecordManager<AdminCurrency>
      title="Currencies"
      description={`Currencies applicants can view fees in. Every amount is stored in ${BASE_CURRENCY}, the base currency; the others are for display, converted at the exchange rates.`}
      intro={<SubNav items={SYSTEM_NAV} current="/admin/config/currencies" />}
      singular="currency"
      plural="currencies"
      store={currencyStore}
      idPrefix="cur"
      nameOf={(c) => `${c.code} — ${c.name}`}
      sort={(a, b) => (a.code === BASE_CURRENCY ? -1 : b.code === BASE_CURRENCY ? 1 : a.code.localeCompare(b.code))}
      searchPlaceholder="Code or name"
      searchText={(c) => [c.code, c.name, c.symbol]}
      stats={(items) => [
        { label: "Currencies", value: items.length },
        { label: "Shown to applicants", value: items.filter((c) => c.status === "ACTIVE" && c.displayToApplicants).length },
        { label: "Base currency", value: BASE_CURRENCY, detail: "Fees are stored in this" },
        { label: "Without a rate", value: items.filter((c) => !rates.some((r) => r.code === c.code)).length, href: "/admin/config/exchange-rates" },
      ]}
      blank={() => ({
        id: "",
        code: "",
        name: "",
        symbol: "",
        decimalDigits: 2,
        symbolPosition: "prefix",
        displayToApplicants: true,
        status: "ACTIVE",
        updatedAt: "",
      })}
      fields={[
        { key: "code", label: "Code", kind: "text", required: true, uppercase: true, placeholder: "USD", lockedOnEdit: true, hint: "Three-letter ISO 4217 code." },
        { key: "name", label: "Name", kind: "text", required: true, placeholder: "US Dollar" },
        { key: "symbol", label: "Symbol", kind: "text", required: true, placeholder: "$" },
        { key: "decimalDigits", label: "Decimal places", kind: "number", required: true, min: 0, max: 3 },
        {
          key: "symbolPosition",
          label: "Symbol position",
          kind: "select",
          required: true,
          options: [
            { value: "prefix", label: "Before the amount ($10.00)" },
            { value: "suffix", label: "After the amount (10 FCFA)" },
          ],
        },
        { key: "displayToApplicants", label: "Applicants", kind: "checkbox", checkboxLabel: "Let applicants view fees in this currency" },
      ]}
      validate={(c, all, editingId) => ({
        code: !/^[A-Z]{3}$/.test(c.code) ? "Use three letters, for example USD." : all.some((x) => x.id !== editingId && x.code === c.code) ? "This currency is already on the list." : undefined,
      })}
      beforeSave={(c) => {
        // A new currency needs a rate row so the converter has something to edit.
        if (!rateStore.getAll().some((r) => r.code === c.code)) {
          rateStore.add({ id: c.code, code: c.code, xafPerUnit: 0, source: "Not set", asOf: new Date().toISOString(), updatedBy: "AOSA administrator" });
        }
        return { ...c, id: c.code };
      }}
      deactivateBlocker={(c) => (c.code === BASE_CURRENCY ? "The base currency can't be deactivated." : null)}
      columns={[
        {
          label: "Currency",
          render: (c) => (
            <>
              <p className="font-medium text-[var(--color-ink)]">
                {c.code}
                {c.code === BASE_CURRENCY && (
                  <span className="ml-2 align-middle">
                    <ToneBadge tone="info">Base</ToneBadge>
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{c.name}</p>
            </>
          ),
        },
        { label: "Example", render: (c) => <span className="tabular-nums">{formatPreview(c)}</span> },
        {
          label: `Rate (${BASE_CURRENCY} per unit)`,
          align: "right",
          render: (c) => {
            const r = rates.find((x) => x.code === c.code);
            return r && r.xafPerUnit > 0 ? r.xafPerUnit.toLocaleString("en-GB", { maximumFractionDigits: 4 }) : <span className="text-[var(--color-danger)]">Not set</span>;
          },
        },
        { label: "Applicants", render: (c) => (c.displayToApplicants ? "Shown" : <span className="text-[var(--color-ink-faint)]">Hidden</span>) },
      ]}
    />
  );
}

function formatPreview(c: AdminCurrency) {
  const n = (1234.5).toLocaleString("en-US", { minimumFractionDigits: c.decimalDigits, maximumFractionDigits: c.decimalDigits });
  return c.symbolPosition === "prefix" ? `${c.symbol}${n}` : `${n} ${c.symbol}`;
}
