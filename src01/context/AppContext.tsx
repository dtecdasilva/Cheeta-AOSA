"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Application, ApplicationStatus, Notification, StepKey } from "@/lib/types";
import { stepOrder } from "@/lib/data";
import { uid } from "@/lib/utils";

// This context holds application-domain data only (draft applications,
// notifications) — identity and authentication live in AuthContext /
// the server session instead. It's still backed by localStorage for now
// because no database has been built for this module; only auth is real.

const STORAGE_KEY = "cheeta-aosa:applications:v1";

interface StoredState {
  applications: Application[];
  notifications: Notification[];
}

interface AppContextValue extends StoredState {
  createApplication: (institutionIds: string[]) => Application;
  getApplication: (id: string) => Application | undefined;
  updateStepDraft: (applicationId: string, key: StepKey, patch: Partial<Application>) => void;
  submitStep: (applicationId: string, key: StepKey) => void;
  submitApplication: (applicationId: string) => void;
  setInstitutionStatus: (applicationId: string, institutionId: string, status: ApplicationStatus) => void;
  markNotificationRead: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function loadState(): StoredState {
  if (typeof window === "undefined") return { applications: [], notifications: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { applications: [], notifications: [] };
    return JSON.parse(raw);
  } catch {
    return { applications: [], notifications: [] };
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoredState>({ applications: [], notifications: [] });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Reading localStorage must happen after mount, not in the initializer —
    // doing it there would make the client's first render diverge from the
    // server-rendered HTML (server has no localStorage) and trigger a
    // hydration mismatch. This effect synchronizes React state with an
    // external system exactly once, on mount, which is the correct pattern
    // even though it needs a setState call inside a useEffect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const createApplication: AppContextValue["createApplication"] = (institutionIds) => {
    const now = new Date().toISOString();
    const perInstitutionStatus: Record<string, ApplicationStatus> = {};
    institutionIds.forEach((instId) => (perInstitutionStatus[instId] = "INCOMPLETE"));
    const steps: Record<StepKey, "locked" | "editable" | "submitted"> = {} as Record<
      StepKey,
      "locked" | "editable" | "submitted"
    >;
    stepOrder.forEach((k, i) => (steps[k] = i === 0 ? "editable" : "locked"));

    const application: Application = {
      id: uid("appl"),
      createdAt: now,
      updatedAt: now,
      overallStatus: "INCOMPLETE",
      institutionIds,
      perInstitutionStatus,
      steps,
      personalInfo: null,
      education: [],
      examinations: [],
      programChoices: [],
      documents: [],
      payment: null,
      submittedAt: null,
    };
    setState((s) => ({ ...s, applications: [application, ...s.applications] }));
    return application;
  };

  const getApplication = (id: string) => state.applications.find((a) => a.id === id);

  const updateStepDraft: AppContextValue["updateStepDraft"] = (applicationId, _key, patch) => {
    setState((s) => ({
      ...s,
      applications: s.applications.map((a) =>
        a.id === applicationId ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a
      ),
    }));
  };

  const submitStep: AppContextValue["submitStep"] = (applicationId, key) => {
    setState((s) => ({
      ...s,
      applications: s.applications.map((a) => {
        if (a.id !== applicationId) return a;
        const idx = stepOrder.indexOf(key);
        const nextKey = stepOrder[idx + 1];
        const steps = { ...a.steps, [key]: "submitted" as const };
        if (nextKey && steps[nextKey] === "locked") {
          steps[nextKey] = "editable";
        }
        const allSubmitted = stepOrder.every((k) => steps[k] === "submitted");
        return {
          ...a,
          steps,
          overallStatus: allSubmitted ? "COMPLETED" : a.overallStatus,
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  };

  const submitApplication: AppContextValue["submitApplication"] = (applicationId) => {
    const now = new Date().toISOString();
    setState((s) => {
      const app = s.applications.find((a) => a.id === applicationId);
      const notif: Notification[] = app
        ? [
            {
              id: uid("note"),
              title: "Application submitted",
              body: `Your application to ${app.institutionIds.length} institution(s) has been submitted for verification.`,
              createdAt: now,
              read: false,
              applicationId,
            },
            ...s.notifications,
          ]
        : s.notifications;
      return {
        ...s,
        applications: s.applications.map((a) => {
          if (a.id !== applicationId) return a;
          const perInstitutionStatus: Record<string, ApplicationStatus> = {};
          a.institutionIds.forEach((instId) => (perInstitutionStatus[instId] = "SUBMITTED"));
          return {
            ...a,
            overallStatus: "SUBMITTED",
            perInstitutionStatus,
            submittedAt: now,
            updatedAt: now,
          };
        }),
        notifications: notif,
      };
    });
  };

  const setInstitutionStatus: AppContextValue["setInstitutionStatus"] = (applicationId, institutionId, status) => {
    setState((s) => ({
      ...s,
      applications: s.applications.map((a) =>
        a.id === applicationId
          ? {
              ...a,
              perInstitutionStatus: { ...a.perInstitutionStatus, [institutionId]: status },
              updatedAt: new Date().toISOString(),
            }
          : a
      ),
    }));
  };

  const markNotificationRead = (id: string) => {
    setState((s) => ({
      ...s,
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  };

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      createApplication,
      getApplication,
      updateStepDraft,
      submitStep,
      submitApplication,
      setInstitutionStatus,
      markNotificationRead,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handler identities are stable per state snapshot; re-created intentionally alongside state
    [state]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
