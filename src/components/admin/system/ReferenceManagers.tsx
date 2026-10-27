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
import { useT } from "@/lib/i18n/client";

export const SYSTEM_NAV = [
  { label: "System config", href: "/admin/config" },
  { label: "Countries", href: "/admin/config/countries" },
  { label: "Currencies", href: "/admin/config/currencies" },
  { label: "Exchange rates", href: "/admin/config/exchange-rates" },
];

const regionOptions = (Object.keys(WORLD_REGION_LABELS) as WorldRegion[]).map((r) => ({ value: r, label: WORLD_REGION_LABELS[r] }));

export function CountryManager() {
  const tr = useT();
  const currencies = currencyStore.useItems();
  return (
    <RecordManager<AdminCountry>
      title={tr("Countries")}
      description={tr("The countries offered for nationality, country of birth and residence on every applicant form.")}
      intro={<SubNav items={SYSTEM_NAV} current="/admin/config/countries" />}
      singular={tr("country")}
      plural={tr("countries")}
      store={countryStore}
      idPrefix="country"
      nameOf={(c) => c.name}
      sort={(a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)}
      searchPlaceholder={tr("Name, ISO code or dialling code")}
      searchText={(c) => [c.name, c.iso2, c.iso3, c.dialCode, c.currencyCode]}
      filters={[{ key: "region", label: tr("Region"), options: regionOptions, get: (c) => c.region }]}
      stats={(items) => [
        { label: tr("Countries"), value: items.length },
        { label: tr("Active"), value: items.filter((c) => c.status === "ACTIVE").length },
        { label: tr("Offered as nationality"), value: items.filter((c) => c.status === "ACTIVE" && c.nationality).length },
        { label: tr("Offered as residence"), value: items.filter((c) => c.status === "ACTIVE" && c.residence).length },
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
        { key: "name", label: tr("Country name"), kind: "text", required: true },
        { key: "iso2", label: tr("ISO code (2 letters)"), kind: "text", required: true, uppercase: true, placeholder: "CM", hint: tr("ISO 3166-1 alpha-2.") },
        { key: "iso3", label: tr("ISO code (3 letters)"), kind: "text", uppercase: true, placeholder: "CMR", hint: tr("ISO 3166-1 alpha-3. Optional.") },
        { key: "dialCode", label: tr("Dialling code"), kind: "text", required: true, placeholder: "+237" },
        { key: "region", label: tr("Region"), kind: "select", required: true, options: regionOptions },
        {
          key: "currencyCode",
          label: tr("Currency"),
          kind: "text",
          uppercase: true,
          placeholder: "XAF",
          hint: currencies.length ? tr("Three-letter ISO 4217 code. Platform currencies: {value}.", { value: currencies.map((c) => c.code).join(", ") }) : undefined,
        },
        { key: "sortOrder", label: tr("Display order"), kind: "number", required: true, min: 0, max: 100000, hint: tr("Lower numbers come first in the country pickers; ties are in name order.") },
        { key: "nationality", label: tr("Nationality"), kind: "checkbox", checkboxLabel: tr("Offer as a nationality") },
        { key: "residence", label: tr("Residence"), kind: "checkbox", checkboxLabel: tr("Offer as a country of residence") },
      ]}
      validate={(c, all, editingId) => ({
        iso2: !/^[A-Z]{2}$/.test(c.iso2) ? tr("Use two letters, for example CM.") : all.some((x) => x.id !== editingId && x.iso2 === c.iso2) ? tr("Another country already uses this code.") : undefined,
        iso3: c.iso3 && !/^[A-Z]{3}$/.test(c.iso3) ? tr("Use three letters, for example CMR.") : c.iso3 && all.some((x) => x.id !== editingId && x.iso3 === c.iso3) ? tr("Another country already uses this code.") : undefined,
        sortOrder: !Number.isInteger(c.sortOrder) ? tr("Enter a whole number.") : undefined,
        dialCode: !/^\+\d{1,4}$/.test(c.dialCode) ? tr("Use + followed by 1 to 4 digits, for example +237.") : undefined,
        currencyCode: c.currencyCode && !/^[A-Z]{3}$/.test(c.currencyCode) ? tr("Use three letters, for example XAF.") : undefined,
        name: all.some((x) => x.id !== editingId && x.name.toLowerCase() === c.name.toLowerCase()) ? tr("This country is already on the list.") : undefined,
      })}
      beforeSave={(c) => (c.id ? c : { ...c, id: `country-${c.iso2.toLowerCase()}` })}
      columns={[
        {
          label: tr("Country"),
          render: (c) => (
            <>
              <p className="font-medium text-[var(--color-ink)]">{tr(c.name)}</p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{tr(WORLD_REGION_LABELS[c.region])}</p>
            </>
          ),
        },
        { label: "ISO", render: (c) => <span className="font-mono">{[c.iso2, c.iso3].filter(Boolean).join(" / ")}</span> },
        { label: tr("Order"), align: "right", render: (c) => c.sortOrder },
        { label: tr("Dialling code"), render: (c) => <span className="tabular-nums">{c.dialCode}</span> },
        { label: tr("Currency"), render: (c) => c.currencyCode || "—" },
        {
          label: tr("Offered for"),
          render: (c) =>
            [c.nationality && tr("Nationality"), c.residence && tr("Residence")].filter(Boolean).join(", ") || <span className="text-[var(--color-ink-faint)]">{tr("Nothing")}</span>,
        },
      ]}
    />
  );
}

export function CurrencyManager() {
  const tr = useT();
  const rates = rateStore.useItems();
  return (
    <RecordManager<AdminCurrency>
      title={tr("Currencies")}
      description={tr("Currencies applicants can view fees in. Every amount is stored in {BASE_CURRENCY}, the base currency; the others are for display, converted at the exchange rates.", { BASE_CURRENCY })}
      intro={<SubNav items={SYSTEM_NAV} current="/admin/config/currencies" />}
      singular={tr("currency")}
      plural={tr("currencies")}
      store={currencyStore}
      idPrefix="cur"
      nameOf={(c) => `${c.code} — ${c.name}`}
      sort={(a, b) => (a.code === BASE_CURRENCY ? -1 : b.code === BASE_CURRENCY ? 1 : a.code.localeCompare(b.code))}
      searchPlaceholder={tr("Code or name")}
      searchText={(c) => [c.code, c.name, c.symbol]}
      stats={(items) => [
        { label: tr("Currencies"), value: items.length },
        { label: tr("Shown to applicants"), value: items.filter((c) => c.status === "ACTIVE" && c.displayToApplicants).length },
        { label: tr("Base currency"), value: BASE_CURRENCY, detail: tr("Fees are stored in this") },
        { label: tr("Without a rate"), value: items.filter((c) => !rates.some((r) => r.code === c.code)).length, href: "/admin/config/exchange-rates" },
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
        { key: "code", label: tr("Code"), kind: "text", required: true, uppercase: true, placeholder: "USD", lockedOnEdit: true, hint: tr("Three-letter ISO 4217 code.") },
        { key: "name", label: tr("Name"), kind: "text", required: true, placeholder: tr("US Dollar") },
        { key: "symbol", label: tr("Symbol"), kind: "text", required: true, placeholder: "$" },
        { key: "decimalDigits", label: tr("Decimal places"), kind: "number", required: true, min: 0, max: 3 },
        {
          key: "symbolPosition",
          label: tr("Symbol position"),
          kind: "select",
          required: true,
          options: [
            { value: "prefix", label: tr("Before the amount ($10.00)") },
            { value: "suffix", label: tr("After the amount (10 FCFA)") },
          ],
        },
        { key: "displayToApplicants", label: tr("Applicants"), kind: "checkbox", checkboxLabel: tr("Let applicants view fees in this currency") },
      ]}
      validate={(c, all, editingId) => ({
        code: !/^[A-Z]{3}$/.test(c.code) ? tr("Use three letters, for example USD.") : all.some((x) => x.id !== editingId && x.code === c.code) ? tr("This currency is already on the list.") : undefined,
      })}
      // A new currency shows on the Exchange rates screen as "Not set" until its first rate is added there.
      beforeSave={(c) => ({ ...c, id: c.code })}
      deactivateBlocker={(c) => (c.code === BASE_CURRENCY ? tr("The base currency can't be deactivated.") : null)}
      columns={[
        {
          label: tr("Currency"),
          render: (c) => (
            <>
              <p className="font-medium text-[var(--color-ink)]">
                {c.code}
                {c.code === BASE_CURRENCY && (
                  <span className="ml-2 align-middle">
                    <ToneBadge tone="info">{tr("Base")}</ToneBadge>
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{tr(c.name)}</p>
            </>
          ),
        },
        { label: tr("Example"), render: (c) => <span className="tabular-nums">{formatPreview(c)}</span> },
        {
          label: tr("Rate ({BASE_CURRENCY} per unit)", { BASE_CURRENCY }),
          align: "right",
          render: (c) => {
            const r = rates.find((x) => x.code === c.code);
            return r && r.xafPerUnit > 0 ? r.xafPerUnit.toLocaleString("en-GB", { maximumFractionDigits: 4 }) : <span className="text-[var(--color-danger)]">{tr("Not set")}</span>;
          },
        },
        { label: tr("Applicants"), render: (c) => (c.displayToApplicants ? tr("Shown") : <span className="text-[var(--color-ink-faint)]">{tr("Hidden")}</span>) },
      ]}
    />
  );
}

function formatPreview(c: AdminCurrency) {
  const n = (1234.5).toLocaleString("en-US", { minimumFractionDigits: c.decimalDigits, maximumFractionDigits: c.decimalDigits });
  return c.symbolPosition === "prefix" ? `${c.symbol}${n}` : `${n} ${c.symbol}`;
}
