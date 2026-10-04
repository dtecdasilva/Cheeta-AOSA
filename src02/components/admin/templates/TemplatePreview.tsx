"use client";

import { Mail, MessageSquare, Monitor } from "lucide-react";
import { CategoryBadge } from "@/components/notifications/NotificationCentre";
import { CHANNEL_LABELS, type Channel, type NotificationCategory } from "@/lib/notifications/center";
import { renderParts, renderText, smsInfo, type RenderPart } from "@/lib/admin/templates";

export const CHANNEL_ICON: Record<Channel, typeof Mail> = { EMAIL: Mail, SMS: MessageSquare, IN_APP: Monitor };

export function ChannelBadge({ channel }: { channel: Channel }) {
  const Icon = CHANNEL_ICON[channel];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap border border-[var(--color-line)] bg-[var(--color-paper)] px-2 py-1 text-xs font-medium text-[var(--color-ink)]">
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      {CHANNEL_LABELS[channel]}
    </span>
  );
}

/** Text with filled-in placeholders underlined and unknown ones flagged. */
function Rendered({ parts }: { parts: RenderPart[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "text" ? (
          <span key={i}>{p.text}</span>
        ) : p.kind === "value" ? (
          <span key={i} className="bg-[var(--color-brass-soft)] decoration-[var(--color-brass)]" title="Filled in from sample data">
            {p.text}
          </span>
        ) : (
          <span key={i} className="bg-[var(--color-danger-soft)] font-mono text-[0.9em] text-[var(--color-danger)]" title="Unknown placeholder — it would be sent as typed">
            {p.text}
          </span>
        )
      )}
    </>
  );
}

function Paragraphs({ text, values }: { text: string; values: Record<string, string> }) {
  const paras = text.split(/\n\s*\n/);
  return (
    <div className="space-y-3">
      {paras.map((para, i) => (
        <p key={i} className="whitespace-pre-line">
          <Rendered parts={renderParts(para, values)} />
        </p>
      ))}
    </div>
  );
}

export function TemplatePreview({
  channel,
  subject,
  body,
  values,
  category,
}: {
  channel: Channel;
  subject: string;
  body: string;
  values: Record<string, string>;
  category?: NotificationCategory;
}) {
  if (!body.trim() && !subject.trim()) {
    return <p className="border border-dashed border-[var(--color-line-strong)] px-4 py-10 text-center text-sm text-[var(--color-ink-faint)]">Start writing to see a preview.</p>;
  }

  if (channel === "EMAIL") {
    return (
      <div className="border border-[var(--color-line)] bg-[var(--color-surface)] text-sm">
        <dl className="space-y-1 border-b border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3 text-xs">
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-[var(--color-ink-faint)]">From</dt>
            <dd className="text-[var(--color-ink)]">Cheeta AOSA &lt;no-reply@aosa.cheeta.cm&gt;</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-[var(--color-ink-faint)]">To</dt>
            <dd className="text-[var(--color-ink)]">{values["student.email"]}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-[var(--color-ink-faint)]">Subject</dt>
            <dd className="font-medium text-[var(--color-ink)]">{subject ? <Rendered parts={renderParts(subject, values)} /> : <em className="text-[var(--color-danger)]">No subject</em>}</dd>
          </div>
        </dl>
        <div className="px-5 py-5 leading-relaxed text-[var(--color-ink)]">
          <Paragraphs text={body} values={values} />
        </div>
        <p className="border-t border-[var(--color-line)] px-5 py-3 text-xs text-[var(--color-ink-faint)]">
          You're receiving this because you have an account on Cheeta AOSA. This mailbox isn't monitored.
        </p>
      </div>
    );
  }

  if (channel === "SMS") {
    const rendered = renderText(body, values);
    const info = smsInfo(rendered);
    return (
      <div>
        <div className="mx-auto max-w-xs border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
          <p className="mb-2 text-center text-xs font-medium text-[var(--color-ink-soft)]">CHEETA · {values["student.phone"]}</p>
          <div className="max-w-[85%] bg-[var(--color-surface)] px-3 py-2 text-sm leading-snug text-[var(--color-ink)] shadow-[0_0_0_1px_var(--color-line)]">
            <span className="whitespace-pre-line">
              <Rendered parts={renderParts(body, values)} />
            </span>
          </div>
        </div>
        <p className={`mt-3 text-center text-xs ${info.segments > 1 ? "text-[var(--color-amber)]" : "text-[var(--color-ink-faint)]"}`}>
          {info.length} characters · {info.segments} {info.segments === 1 ? "message" : "messages"} ({info.encoding}, {info.perSegment} per message)
        </p>
        {info.encoding === "Unicode" && (
          <p className="mt-1 text-center text-xs text-[var(--color-ink-faint)]">
            {info.offending.slice(0, 6).map((c) => `“${c}”`).join(" ")} {info.offending.length === 1 ? "switches" : "switch"} this SMS to Unicode, which fits fewer characters.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="border border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span className="mt-1.5 h-2 w-2 shrink-0 bg-[var(--color-brass)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {category && <CategoryBadge category={category} />}
            <span className="ml-auto text-xs text-[var(--color-ink-faint)]">Just now</span>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-[var(--color-ink)]">{subject ? <Rendered parts={renderParts(subject, values)} /> : <em className="font-normal text-[var(--color-danger)]">No title</em>}</p>
          <div className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
            <Paragraphs text={body} values={values} />
          </div>
        </div>
      </div>
      <p className="border-t border-[var(--color-line)] px-4 py-2 text-xs text-[var(--color-ink-faint)]">As it appears in the notification centre</p>
    </div>
  );
}
