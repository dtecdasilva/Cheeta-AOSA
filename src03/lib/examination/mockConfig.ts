import * as React from "react";
import { parameterStore } from "@/lib/admin/parameters";
import { buildExamConfigurationData, toExamConfiguration, type ExamConfiguration, type ExamConfigurationData } from "./config";

/**
 * The examination configuration for the student forms, as a React hook.
 * The configuration itself (types, builders, pass/fail) is in ./config.ts
 * and re-exported here, so existing imports keep working.
 */
export * from "./config";

let request: Promise<ExamConfigurationData | null> | null = null;

/** One request per page load, shared by every form that needs the configuration. */
function loadConfiguration(): Promise<ExamConfigurationData | null> {
  if (!request) {
    request = fetch("/api/config/examinations", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as ExamConfigurationData) : null))
      .catch(() => null);
  }
  return request;
}

/**
 * The live examination configuration, from the database
 * (GET /api/config/examinations). Until it arrives, and if it can't be
 * read, the built-in parameter lists are used so the form still renders;
 * the server checks whatever is submitted against the database either way.
 */
export function useExamConfiguration(): ExamConfiguration {
  const items = parameterStore.useItems();
  const [remote, setRemote] = React.useState<ExamConfigurationData | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    loadConfiguration().then((data) => {
      if (!cancelled && data) setRemote(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return React.useMemo(() => toExamConfiguration(remote ?? buildExamConfigurationData(items)), [remote, items]);
}
