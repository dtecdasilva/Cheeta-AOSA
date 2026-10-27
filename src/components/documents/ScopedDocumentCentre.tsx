"use client";

import type { Audience, DocType } from "@/lib/documents/data";
import { DocumentCentre, DocumentViewer } from "./Documents";

/**
 * Admin and institution wrappers. Which documents an institution may open
 * (its own applications, once submitted and the fee approved; payment
 * records and letters with the matching permission) is decided by the
 * server; anything else comes back as not available.
 */
export function ScopedDocumentCentre({ accountId, audience, basePath }: { accountId: string; audience: Audience; basePath: string; institutionId?: string }) {
  return <DocumentCentre id={accountId} audience={audience} basePath={basePath} />;
}

export function ScopedDocumentViewer({ accountId, type, audience, backHref, backLabel }: { accountId: string; type: DocType; audience: Audience; backHref: string; backLabel: string; institutionId?: string }) {
  return <DocumentViewer id={accountId} type={type} audience={audience} backHref={backHref} backLabel={backLabel} />;
}
