"use client";

import { Field, SelectInput } from "@/components/Form";
import { selectableParams, useParameters, type ParamItem } from "@/lib/admin/parameters";

/**
 * Dependent location pickers: Region → Town → Site (or Quarter).
 *
 * Every list comes from Location parameters, so what an administrator
 * adds, renames or deactivates there is what every form offers. Rules:
 *   - a level is disabled until the level above is chosen;
 *   - choosing a different region clears a town (and site) outside it;
 *   - choosing a different town clears a site outside it;
 *   - inactive entries are not offered, except the one already saved on
 *     the record, which stays visible and is marked "(inactive)".
 *
 * Renders one <Field> per level with no wrapper, so the caller decides
 * the grid.
 */

export interface LocationValue {
  regionId: string;
  townId: string;
  /** Site or quarter id, depending on `leaf`. */
  leafId: string;
}

export const EMPTY_LOCATION: LocationValue = { regionId: "", townId: "", leafId: "" };

type Level = "region" | "town" | "leaf";

export function LocationSelect({
  value,
  onChange,
  leaf,
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
  /** Only offer sites of these types (see the Sites parameter list). */
  siteTypes?: string[];
  required?: Partial<Record<Level, boolean>>;
  errors?: Partial<Record<Level, string>>;
  labels?: Partial<Record<Level, string>>;
  hints?: Partial<Record<Level, string>>;
}) {
  const regions = useParameters("regions");
  const towns = useParameters("towns");
  const leaves = useParameters(leaf ?? "sites");

  const leafItems = leaf
    ? selectableParams(leaves, value.leafId, value.townId || "__none__").filter(
        (i) => i.id === value.leafId || !siteTypes || leaf !== "sites" || siteTypes.includes(String(i.attrs.siteType))
      )
    : [];
  const townItems = value.regionId ? selectableParams(towns, value.townId, value.regionId) : [];

  function setRegion(regionId: string) {
    const townOk = towns.some((t) => t.id === value.townId && t.parentId === regionId);
    onChange({ regionId, townId: townOk ? value.townId : "", leafId: townOk ? value.leafId : "" }, "region");
  }
  function setTown(townId: string) {
    const leafOk = leaves.some((l) => l.id === value.leafId && l.parentId === townId);
    onChange({ ...value, townId, leafId: leafOk ? value.leafId : "" }, "town");
  }

  const leafName = labels.leaf ?? (leaf === "quarters" ? "Quarter" : "Site");

  return (
    <>
      <Field label={labels.region ?? "Region"} required={required.region} error={errors.region} hint={hints.region}>
        <Options items={selectableParams(regions, value.regionId)} value={value.regionId} onChange={setRegion} />
      </Field>
      <Field
        label={labels.town ?? "Town"}
        required={required.town}
        error={errors.town}
        hint={
          !value.regionId
            ? "Choose a region first."
            : townItems.length === 0
              ? "No active towns in this region yet."
              : hints.town
        }
      >
        <Options items={townItems} value={value.townId} onChange={setTown} disabled={!value.regionId || townItems.length === 0} />
      </Field>
      {leaf && (
        <Field
          label={leafName}
          required={required.leaf}
          error={errors.leaf}
          hint={
            !value.townId
              ? "Choose a town first."
              : leafItems.length === 0
                ? `No active ${leafName.toLowerCase()}s in this town yet.`
                : hints.leaf
          }
        >
          <Options
            items={leafItems}
            value={value.leafId}
            onChange={(leafId) => onChange({ ...value, leafId }, "leaf")}
            disabled={!value.townId || leafItems.length === 0}
            placeholder={required.leaf ? "Select…" : "None"}
          />
        </Field>
      )}
    </>
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
  return (
    <SelectInput id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">{placeholder}</option>
      {items.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
          {p.status === "INACTIVE" ? " (inactive)" : ""}
        </option>
      ))}
    </SelectInput>
  );
}
