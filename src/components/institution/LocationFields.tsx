"use client";

import { Field, SelectInput, TextInput } from "@/components/Form";
import { useOptions } from "@/lib/institution/api";
import { useT } from "@/lib/i18n/client";

interface Place {
  id: string;
  label: string;
  parentId: string | null;
}

/** Location, region and town, for a faculty or a department. The town list follows the region chosen. */
export function LocationFields({ value, onChange, errors }: { value: { location: string; regionId: string; townId: string }; onChange: (patch: Partial<{ location: string; regionId: string; townId: string }>) => void; errors: Record<string, string | undefined> }) {
  const tr = useT();
  const regions = useOptions<Place>("/api/reference/parameters?category=regions");
  const towns = useOptions<Place>("/api/reference/parameters?category=towns");
  return (
    <>
      <Field label={tr("Location")} error={errors.location} hint={tr("Campus, building or landmark.")}>
        <TextInput value={value.location} onChange={(e) => onChange({ location: e.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tr("Region")} error={errors.regionId}>
          <SelectInput value={value.regionId} onChange={(e) => onChange({ regionId: e.target.value, townId: "" })}>
            <option value="">{tr("Select…")}</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {tr(r.label)}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label={tr("Town")} error={errors.townId}>
          <SelectInput value={value.townId} onChange={(e) => onChange({ townId: e.target.value })} disabled={!value.regionId}>
            <option value="">{value.regionId ? tr("Select…") : tr("Choose the region first")}</option>
            {towns
              .filter((t) => t.parentId === value.regionId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {tr(t.label)}
                </option>
              ))}
          </SelectInput>
        </Field>
      </div>
    </>
  );
}

/** The town's name for a list or a detail page. */
export function useTownName() {
  const towns = useOptions<Place>("/api/reference/parameters?category=towns");
  return (id: string | null | undefined) => (id ? towns.find((t) => t.id === id)?.label ?? "" : "");
}
