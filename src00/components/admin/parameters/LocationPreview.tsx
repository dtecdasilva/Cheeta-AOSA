"use client";

import { useState } from "react";
import { Card, CardHeader, DescriptionList } from "@/components/ui";
import { FilterSelect } from "@/components/admin/ui";
import { EMPTY_LOCATION, LocationSelect, type LocationValue } from "@/components/location/LocationSelect";
import { getCategoryDef, useParameterIndex } from "@/lib/admin/parameters";

const SITE_TYPE_OPTIONS = (() => {
  const f = getCategoryDef("sites")?.fields.find((x) => x.key === "siteType");
  return f && f.kind === "select" ? f.options : [];
})();

/**
 * The same Region → Town → Site/Quarter pickers the forms use, wired to
 * the lists on this page — so an admin can see the effect of a change
 * (a deactivated town, a new site) before anyone meets it in a form.
 */
export function LocationPreview() {
  const index = useParameterIndex();
  const [siteType, setSiteType] = useState("");
  const [site, setSite] = useState<LocationValue>(EMPTY_LOCATION);
  const [quarter, setQuarter] = useState<LocationValue>(EMPTY_LOCATION);

  const chosenSite = site.leafId ? index.get(site.leafId) : undefined;
  const path = (v: LocationValue) =>
    [v.regionId, v.townId, v.leafId]
      .filter(Boolean)
      .map((id) => index.get(id)?.label ?? "Unknown")
      .join(" → ") || "Nothing chosen yet";

  return (
    <Card padded={false} className="mt-8">
      <CardHeader
        title="Try the location selectors"
        description="These are the pickers used on institution, student and site forms. They read the lists above, so changes show here straight away."
      />
      <div className="space-y-6 p-5">
        <div>
          <p className="mb-3 text-sm font-medium text-[var(--color-ink)]">Region → Town → Site</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              label="Site type"
              value={siteType}
              onChange={(v) => {
                setSiteType(v);
                setSite((s) => ({ ...s, leafId: "" }));
              }}
              options={SITE_TYPE_OPTIONS}
              allLabel="Any type"
            />
            <LocationSelect leaf="sites" value={site} onChange={setSite} siteTypes={siteType ? [siteType] : undefined} />
          </div>
          <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
            Selected: <span className="text-[var(--color-ink)]">{path(site)}</span>
          </p>
          {chosenSite && (
            <div className="mt-3 border border-[var(--color-line)]">
              <DescriptionList
                items={[
                  { label: "Type", value: SITE_TYPE_OPTIONS.find((o) => o.value === chosenSite.attrs.siteType)?.label ?? "—" },
                  { label: "Address", value: String(chosenSite.attrs.address || "—") },
                  { label: "Capacity", value: Number(chosenSite.attrs.capacity) ? String(chosenSite.attrs.capacity) : "—" },
                  { label: "Phone", value: String(chosenSite.attrs.phone || "—") },
                ]}
              />
            </div>
          )}
        </div>

        <div className="border-t border-[var(--color-line)] pt-6">
          <p className="mb-3 text-sm font-medium text-[var(--color-ink)]">Region → Town → Quarter</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <LocationSelect leaf="quarters" value={quarter} onChange={setQuarter} />
          </div>
          <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
            Selected: <span className="text-[var(--color-ink)]">{path(quarter)}</span>
          </p>
        </div>

        <p className="text-xs text-[var(--color-ink-faint)]">
          Changing a region clears a town outside it, and changing a town clears its site or quarter. Inactive entries aren&apos;t offered.
        </p>
      </div>
    </Card>
  );
}
