"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Lock, Printer } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { ButtonLinkClass } from "@/components/Form";
import { formatDate } from "@/lib/utils";
import { docLabel, type Audience, type DocBlock, type DocModel, type DocType } from "@/lib/documents/data";
import { pdfUrl, useDocumentModel, useDocumentSubjects, useSubjectDocuments, type SubjectDocuments } from "@/lib/documents/api";
import { useT } from "@/lib/i18n/client";

// ---------------------------------------------------------------------------
// The sheet
//
// Styled with its own scoped stylesheet rather than utility classes, so the
// exact same markup can be saved as a standalone file by Download and still
// look right when opened outside the app.
// ---------------------------------------------------------------------------

export const DOC_CSS = `
.doc-sheet{--ink:#050505;--soft:#4b5563;--faint:#6b7280;--line:#e5e7eb;--strong:#d1d5db;--brand:#f7941d;--paper:#f8f9fa;
  background:#fff;color:var(--ink);max-width:794px;margin:0 auto;padding:56px 60px 40px;border:1px solid var(--line);
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:13.5px;line-height:1.5}
.doc-sheet .doc-display{font-weight:700;letter-spacing:-.01em}
.doc-head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding-bottom:18px;border-bottom:2px solid var(--brand)}
.doc-issuer-name{font-size:21px;line-height:1.2;margin:0}
.doc-issuer-line{margin:2px 0 0;color:var(--soft);font-size:12px}
.doc-meta{text-align:right}
.doc-title{font-size:17px;margin:0}
.doc-meta p{margin:3px 0 0;font-size:12px;color:var(--soft)}
.doc-number{font-variant-numeric:tabular-nums;letter-spacing:.02em;color:var(--ink)!important}
.doc-recipient{margin-top:22px;font-size:13px}
.doc-recipient p{margin:0}
.doc-recipient .doc-rname{font-weight:600}
.doc-block{margin-top:24px;break-inside:avoid}
.doc-block-title{font-size:15px;margin:0 0 8px}
.doc-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-top:1px solid var(--line)}
.doc-field{display:flex;justify-content:space-between;gap:16px;padding:7px 0;border-bottom:1px solid var(--line)}
.doc-field:nth-child(odd){padding-right:18px}
.doc-field:nth-child(even){padding-left:18px;border-left:1px solid var(--line)}
.doc-field dt{color:var(--soft)}
.doc-field dd{margin:0;text-align:right;font-weight:500}
.doc-table{width:100%;border-collapse:collapse}
.doc-table th{text-align:left;font-weight:400;font-size:11.5px;color:var(--faint);padding:6px 10px 6px 0;border-bottom:1px solid var(--strong)}
.doc-table td{padding:7px 10px 7px 0;border-bottom:1px solid var(--line);vertical-align:top}
.doc-table .num{text-align:right;font-variant-numeric:tabular-nums;padding-right:0}
.doc-table tfoot td{font-weight:600;border-bottom:none;border-top:1px solid var(--ink)}
.doc-empty{color:var(--faint);font-style:italic}
.doc-text p{margin:0 0 10px;max-width:68ch}
.doc-code{border:1px solid var(--ink);padding:18px 20px;display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px 24px;background:
  repeating-linear-gradient(135deg,transparent 0 9px,rgba(247,148,29,.09) 9px 10px)}
.doc-code-label{margin:0;color:var(--soft);font-size:12px}
.doc-code-value{margin:0;font-size:30px;letter-spacing:.08em;font-variant-numeric:tabular-nums;line-height:1.1}
.doc-code-caption{flex-basis:100%;margin:0;color:var(--soft);font-size:12px}
.doc-sigs{display:flex;flex-wrap:wrap;gap:40px;margin-top:40px}
.doc-sig{min-width:220px}
.doc-sig-line{height:36px;border-bottom:1px solid var(--ink)}
.doc-sig p{margin:6px 0 0;font-size:12px}
.doc-sig .doc-sig-role{color:var(--soft);margin-top:1px}
.doc-foot{margin-top:36px;padding-top:12px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:20px;font-size:10.5px;color:var(--faint)}
.doc-foot p{margin:0;max-width:60ch}
@media (max-width:640px){.doc-sheet{padding:28px 20px}.doc-head{flex-direction:column}.doc-meta{text-align:left}.doc-fields{grid-template-columns:1fr}
  .doc-field:nth-child(even){padding-left:0;border-left:none}.doc-field:nth-child(odd){padding-right:0}.doc-code-value{font-size:22px}}
@media print{.doc-sheet{border:none;padding:0;max-width:none}}
`;

function Block({ b }: { b: DocBlock }) {
  const tr = useT();
  const title = "title" in b && b.title ? <h2 className="doc-block-title doc-display">{tr(b.title)}</h2> : null;
  switch (b.kind) {
    case "fields":
      return (
        <section className="doc-block">
          {tr(title)}
          <dl className="doc-fields">
            {b.fields.map((f) => (
              <div key={f.label} className="doc-field">
                <dt>{tr(f.label)}</dt>
                <dd>{f.value || "—"}</dd>
              </div>
            ))}
          </dl>
        </section>
      );
    case "table":
      return (
        <section className="doc-block">
          {tr(title)}
          <table className="doc-table">
            <thead>
              <tr>
                {b.columns.map((c, i) => (
                  <th key={i} className={b.numeric?.includes(i) ? "num" : undefined}>
                    {tr(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.length === 0 ? (
                <tr>
                  <td colSpan={b.columns.length} className="doc-empty">
                    {b.empty ?? tr("None.")}
                  </td>
                </tr>
              ) : (
                b.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((cell, j) => (
                      <td key={j} className={b.numeric?.includes(j) ? "num" : undefined}>
                        {tr(cell)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {b.foot && b.rows.length > 0 && (
              <tfoot>
                <tr>
                  {b.foot.map((cell, j) => (
                    <td key={j} className={b.numeric?.includes(j) || j === b.foot!.length - 1 ? "num" : undefined}>
                      {tr(cell)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </section>
      );
    case "text":
      return (
        <section className="doc-block doc-text">
          {tr(title)}
          {b.paragraphs.map((p, i) => (
            <p key={i}>{tr(p)}</p>
          ))}
        </section>
      );
    case "code":
      return (
        <section className="doc-block">
          <div className="doc-code">
            <p className="doc-code-label">{tr(b.label)}</p>
            <p className="doc-code-value doc-display">{b.value}</p>
            {b.caption && <p className="doc-code-caption">{tr(b.caption)}</p>}
          </div>
        </section>
      );
    case "signatures":
      return (
        <section className="doc-block doc-sigs">
          {b.lines.map((l) => (
            <div key={l.name + l.role} className="doc-sig">
              <div className="doc-sig-line" />
              <p>{tr(l.name)}</p>
              <p className="doc-sig-role">{tr(l.role)}</p>
            </div>
          ))}
        </section>
      );
  }
}

export function DocumentSheet({ model, sheetRef }: { model: DocModel; sheetRef?: React.Ref<HTMLElement> }) {
  const tr = useT();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DOC_CSS }} />
      <article ref={sheetRef} className="doc-sheet" aria-label={tr(model.title)}>
        <header className="doc-head">
          <div>
            <p className="doc-issuer-name doc-display">{tr(model.issuer.name)}</p>
            {model.issuer.lines.map((l) => (
              <p key={l} className="doc-issuer-line">
                {tr(l)}
              </p>
            ))}
          </div>
          <div className="doc-meta">
            <h1 className="doc-title doc-display">{tr(model.title)}</h1>
            <p className="doc-number">{model.number}</p>
            <p>{tr("Issued {value}", { value: formatDate(model.issuedAt) })}</p>
          </div>
        </header>
        {model.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={model.photo.url} alt={tr("Applicant photo")} className="float-right ml-4 h-28 w-24 rounded border border-[var(--color-line)] object-cover" />
        )}
        {model.recipient && (
          <div className="doc-recipient">
            <p className="doc-rname">{tr(model.recipient.name)}</p>
            {model.recipient.lines.map((l) => (
              <p key={l}>{tr(l)}</p>
            ))}
          </div>
        )}
        {model.blocks.map((b, i) => (
          <Block key={i} b={b} />
        ))}
        <footer className="doc-foot">
          <p>{tr(model.footnote)}</p>
          <p>{model.number}</p>
        </footer>
      </article>
    </>
  );
}

// ---------------------------------------------------------------------------
// Print and download
// ---------------------------------------------------------------------------

/** Saves the rendered sheet as a standalone HTML file. The backend replaces this with a PDF. */
export function saveHtmlCopy(node: HTMLElement, filename: string, title: string) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${DOC_CSS}body{margin:0;padding:24px;background:#f8f9fa}@media print{body{padding:0;background:#fff}}</style></head><body>${node.outerHTML}</body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const actionClass =
  "inline-flex items-center gap-2 rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:text-[var(--color-ink-faint)] disabled:hover:border-[var(--color-line-strong)]";

export function PrintButton({ disabled, label = "Print" }: { disabled?: boolean; label?: string }) {
  const tr = useT();
  label = tr(label);
  return (
    <button type="button" onClick={() => window.print()} disabled={disabled} className={actionClass}>
      <Printer className="h-4 w-4" strokeWidth={1.75} />
      {tr(label)}
    </button>
  );
}

export function DownloadButton({ onDownload, disabled, label = "Download" }: { onDownload: () => void; disabled?: boolean; label?: string }) {
  const tr = useT();
  label = tr(label);
  return (
    <button type="button" onClick={onDownload} disabled={disabled} className={actionClass}>
      <Download className="h-4 w-4" strokeWidth={1.75} />
      {tr(label)}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Viewer: one document for one application, from the database
// ---------------------------------------------------------------------------

/**
 * Shows the document as the server built it, from the database, with Print
 * and a PDF download. `id` is the application (or, from the admitted-student
 * screens, the tuition account); without one, a student's most recent
 * application is used.
 */
export function DocumentViewer({ id, type, audience, backHref, backLabel }: { id?: string | null; type: DocType; audience: Audience; backHref: string; backLabel: string }) {
  const tr = useT();
  void audience;
  const subjects = useDocumentSubjects();
  const subjectId = id ?? subjects.data?.[0]?.id ?? null;
  const { data: model, error, loading } = useDocumentModel(subjectId, type);
  const ref = useRef<HTMLElement>(null);

  const back = (
    <Link href={backHref} className="no-print mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
      <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
      {tr(backLabel)}
    </Link>
  );

  if (loading || (!id && subjects.loading)) return <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>;
  if (!subjectId || error || !model) {
    return (
      <>
        {tr(back)}
        <EmptyState message={`${tr(docLabel(type))} isn't available. ${error ?? ""}`} action={<Link href={backHref} className={ButtonLinkClass("secondary")}>{tr(backLabel)}</Link>} />
      </>
    );
  }

  return (
    <>
      {tr(back)}
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-bold tracking-tight text-2xl text-[var(--color-ink)]">{tr(model.title)}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {model.recipient?.name ?? ""} · {model.number}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton />
          <a href={pdfUrl(subjectId, type, true)} className={actionClass}>
            <Download className="h-4 w-4" strokeWidth={1.75} />
            {tr("Download PDF")}
          </a>
          <a href={pdfUrl(subjectId, type)} target="_blank" rel="noopener" className={actionClass}>
            <FileText className="h-4 w-4" strokeWidth={1.75} />
            {tr("Open PDF")}
          </a>
        </div>
      </div>
      <div className="print-area overflow-x-auto">
        <DocumentSheet model={model} sheetRef={ref} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Centre: every document for one application, or each of a student's
// ---------------------------------------------------------------------------

function DocumentGrid({ docs, hrefFor }: { docs: SubjectDocuments; hrefFor: (type: DocType) => string }) {
  const tr = useT();
  return (
    <ul className="grid gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2 xl:grid-cols-3">
      {docs.documents.map((d) => {
        const body = (
          <>
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold tracking-tight text-lg text-[var(--color-ink)]">{tr(d.label)}</p>
              {d.available ? (
                <FileText className="mt-1 h-5 w-5 shrink-0 text-[var(--color-brand)]" strokeWidth={1.5} />
              ) : (
                <Lock className="mt-1 h-4 w-4 shrink-0 text-[var(--color-ink-faint)]" strokeWidth={1.75} />
              )}
            </div>
            <p className="mt-1.5 text-sm text-[var(--color-ink-soft)]">{tr(d.description)}</p>
            <p className={`mt-4 text-sm ${d.available ? "text-[var(--color-ink)] underline underline-offset-4" : "text-[var(--color-ink-faint)]"}`}>{d.available ? tr("Open to print or download") : d.reason}</p>
          </>
        );
        return (
          <li key={d.type} className="bg-[var(--color-surface)]">
            {d.available ? (
              <Link href={hrefFor(d.type)} className="block h-full px-5 py-5 transition-colors hover:bg-[var(--color-paper)]">
                {tr(body)}
              </Link>
            ) : (
              <div className="h-full px-5 py-5 opacity-75" aria-disabled>
                {tr(body)}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** One application's documents (staff), at `${basePath}/${type}`. */
export function DocumentCentre({ id, basePath }: { id: string; audience?: Audience; basePath: string }) {
  const tr = useT();
  const { data, error, loading } = useSubjectDocuments(id);
  if (loading) return <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>;
  if (!data) return <EmptyState message={error ?? tr("These documents aren't available.")} />;
  return (
    <>
      <p className="-mt-4 mb-6 text-sm text-[var(--color-ink-soft)]">
        {tr(data.studentName)}
        {data.registrationNo ? `, ${data.registrationNo}` : ""}{tr(", {institutionName}, application {applicationId} ({status})", { institutionName: data.institutionName, applicationId: data.applicationId, status: data.status })}
      </p>
      <DocumentGrid docs={data} hrefFor={(t) => `${basePath}/${t}`} />
    </>
  );
}

/** A student's documents, one section per institution they applied to. */
export function StudentDocumentCentre({ basePath }: { basePath: string }) {
  const tr = useT();
  const { data, error, loading } = useDocumentSubjects();
  if (loading) return <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>;
  if (error) return <EmptyState message={tr(error)} />;
  if (!data?.length) return <EmptyState message={tr("No documents yet. They appear once you add an institution to your application.")} />;
  return (
    <div className="space-y-10">
      {data.map((s) => (
        <section key={s.id}>
          <h2 className="mb-1 font-semibold tracking-tight text-xl text-[var(--color-ink)]">{tr(s.institutionName)}</h2>
          <p className="mb-4 text-sm text-[var(--color-ink-soft)]">
            {tr("Application {applicationId} · {statusLabel}", { applicationId: s.applicationId, statusLabel: s.statusLabel })}
          </p>
          <StudentGrid id={s.id} basePath={basePath} />
        </section>
      ))}
    </div>
  );
}

function StudentGrid({ id, basePath }: { id: string; basePath: string }) {
  const tr = useT();
  const { data } = useSubjectDocuments(id);
  if (!data) return <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>;
  return <DocumentGrid docs={data} hrefFor={(t) => `${basePath}/${t}?for=${encodeURIComponent(id)}`} />;
}
