"use client";

import { useEffect, useState } from "react";
import type { MyOverview } from "@/server/modules/student/overview.service";

export type { MyOverview };
export type OverviewInstitution = MyOverview["institutions"][number];

/** The applicant's overview from /api/student/overview: the five steps, each application, fees and actions. */
export function useMyOverview() {
  const [data, setData] = useState<MyOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/student/overview", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!live) return;
        if (res.ok) setData(body.data);
        else setError(body.error ?? "Could not load your application overview.");
      })
      .catch(() => live && setError("Could not load your application overview. Check your connection."));
    return () => {
      live = false;
    };
  }, []);
  return { data, error };
}
