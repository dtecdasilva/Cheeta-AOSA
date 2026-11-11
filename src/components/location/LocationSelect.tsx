"use client";

import { Field, SelectInput } from "@/components/Form";
import { selectableParams, useParameters, type ParamItem } from "@/lib/admin/parameters";
import { countryStore } from "@/lib/admin/reference";
import { useT } from "@/lib/i18n/client";

/**
 * Dependent location pickers: [Country →] Region → Town → Site (or Quarter).
 *
 * Every list comes from Location parameters, so what an administrator
 * adds, renames or deactivates there is what every form offers. Rules:
 *   - a level is disabled until the level above is chosen;
 *   - with the optional country level (`country`), only the regions of the
 *     chosen country are offered, and choosing a different country clears a
 *     region (and below) that is not in it;
 *   - choosing a different region clears a town (and site) outside it;
 *   - choosing a different town clears a site outside it;
 *   - inactive entries are not offered, except the one already saved on
 *     the record, which stays visible and is marked "(inactive)".
 *
 * Renders one <Field> per level with no wrapper, so the caller decides
 * the grid.
 */

export interface LocationValue {
  /** Only used when the picker has a country level (`country`). A region's country is the region's own `countryId`. */
  countryId?: string;
  regionId: string;
  townId: string;
  /** Site or quarter id, depending on `leaf`. */
  leafId: string;
}

export const EMPTY_LOCATION: LocationValue = { regionId: "", townId: "", leafId: "" };

type Level = "country" | "region" | "town" | "leaf";

export function LocationSelect({
  value,
  onChange,
  leaf,
  country,
  siteTypes,
  required = { region: false, town: false, leaf: false },
  errors = {},
  labels = {},
  hints = {},
}: {
  value: LocationValue;
  onChange: (next: LocationValue, changed: Level) => void;
  /** Third level, or none. */
  leaf?: "sites" | "quarters";
  /** Add a country level on top, so only that country's regions (and so its towns and quarters) are offered. */
  country?: boolean;
  /** Only offer sites of these types (see the Sites parameter list). */
  siteTypes?: string[];
  required?: Partial<Record<Level, boolean>>;
  errors?: Partial<Record<Level, string>>;
  labels?: Partial<Record<Level, string>>;
  hints?: Partial<Record<Level, string>>;
}) {
  const tr = useT();
  const regions = useParameters("regions");
  const towns = useParameters("towns");
  const leaves = useParameters(leaf ?? "sites");

  const leafItems = leaf
    ? selectableParams(leaves, value.leafId, value.townId || "__none__").filter(
        (i) => i.id === value.leafId || !siteTypes || leaf !== "sites" || siteTypes.includes(String(i.attrs.siteType))
      )
    : [];
  const townItems = value.regionId ? selectableParams(towns, value.townId, value.regionId) : [];
  // With a country level, the regions are the chosen country's, and always the one already saved, whatever its country
  // (a region from before countries existed has none, and must not look as if it had been lost).
  const regionItems = country ? selectableParams(regions, value.regionId).filter((r) => r.id === value.regionId || (value.countryId && r.countryId === value.countryId)) : selectableParams(regions, value.regionId);

  function setCountry(countryId: string) {
    const regionOk = regions.some((r) => r.id === value.regionId && r.countryId === countryId);
    const townOk = regionOk && towns.some((t) => t.id === value.townId && t.parentId === value.regionId);
    onChange({ ...value, countryId, regionId: regionOk ? value.regionId : "", townId: townOk ? value.townId : "", leafId: townOk ? value.leafId : "" }, "country");
  }
  function setRegion(regionId: string) {
    const townOk = towns.some((t) => t.id === value.townId && t.parentId === regionId);
    onChange({ ...value, regionId, townId: townOk ? value.townId : "", leafId: townOk ? value.leafId : "" }, "region");
  }
  function setTown(townId: string) {
    const leafOk = leaves.some((l) => l.id === value.leafId && l.parentId === townId);
    onChange({ ...value, townId, leafId: leafOk ? value.leafId : "" }, "town");
  }

  const leafName = labels.leaf ?? (leaf === "quarters" ? tr("Quarter") : tr("Site"));

  return (
    <>
      {country && <CountryField value={value.countryId ?? ""} onChange={setCountry} regions={regions} required={required.country} error={errors.country} label={labels.country} hint={hints.country} />}
      <Field
        label={labels.region ?? tr("Region")}
        required={required.region}
        error={errors.region}
        hint={country && !value.countryId ? tr("Choose a country first.") : country && regionItems.length === 0 ? tr("No active regions in this country yet.") : tr(hints.region)}
      >
        <Options items={regionItems} value={value.regionId} onChange={setRegion} disabled={country && (!value.countryId || regionItems.length === 0)} />
      </Field>
      <Field
        label={labels.town ?? tr("Town")}
        required={required.town}
        error={errors.town}
        hint={
          !value.regionId
            ? tr("Choose a region first.")
            : townItems.length === 0
              ? tr("No active towns in this region yet.")
              : hints.town
        }
      >
        <Options items={townItems} value={value.townId} onChange={setTown} disabled={!value.regionId || townItems.length === 0} />
      </Field>
      {leaf && (
        <Field
          label={tr(leafName)}
          required={required.leaf}
          error={errors.leaf}
          hint={
            !value.townId
              ? tr("Choose a town first.")
              : leafItems.length === 0
                ? tr("No active {toLowerCase}s in this town yet.", { toLowerCase: leafName.toLowerCase() })
                : hints.leaf
          }
        >
          <Options
            items={leafItems}
            value={value.leafId}
            onChange={(leafId) => onChange({ ...value, leafId }, "leaf")}
            disabled={!value.townId || leafItems.length === 0}
            placeholder={required.leaf ? tr("Select…") : tr("None")}
          />
        </Field>
      )}
    </>
  );
}

/**
 * The country level. Only countries that have regions are listed (a country
 * with none would lead nowhere), plus the one already chosen.
 */
function CountryField({ value, onChange, regions, required, error, label, hint }: { value: string; onChange: (v: string) => void; regions: ParamItem[]; required?: boolean; error?: string; label?: string; hint?: string }) {
  const tr = useT();
  const countries = countryStore.useItems();
  const withRegions = new Set(regions.filter((r) => r.status === "ACTIVE" && r.countryId).map((r) => r.countryId));
  const items = countries.filter((c) => withRegions.has(c.id) || c.id === value).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Field label={label ?? tr("Country")} required={required} error={error} hint={hint ?? tr("Only countries that have regions are listed.")}>
      <SelectInput value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{tr("Select…")}</option>
        {items.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.status === "INACTIVE" ? " (inactive)" : ""}
          </option>
        ))}
      </SelectInput>
    </Field>
  );
}

function Options({
  items,
  value,
  onChange,
  disabled,
  placeholder = "Select…",
  id,
}: {
  items: ParamItem[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}) {
  const tr = useT();
  placeholder = tr(placeholder);
  return (
    <SelectInput id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">{tr(placeholder)}</option>
      {items.map((p) => (
        <option key={p.id} value={p.id}>
          {tr(p.label)}
          {p.status === "INACTIVE" ? " (inactive)" : ""}
        </option>
      ))}
    </SelectInput>
  );
}
