"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Plus } from "lucide-react";
import { Card, CardHeader, DescriptionList, EmptyState, PageHeading, TableFrame, Td, Th } from "@/components/ui";
import { ButtonLinkClass, Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextArea, TextInput } from "@/components/Form";
import { ActiveBadge, FilterBar, FilterSelect, Pager, ResultCount, SearchField, StatStrip, usePaged } from "@/components/admin/ui";
import { CategoryBadge } from "@/components/notifications/NotificationCentre";
import { ChannelBadge, TemplatePreview } from "@/components/admin/templates/TemplatePreview";
import { CATEGORIES, CATEGORY_META, CHANNEL_LABELS, type Channel } from "@/lib/notifications/center";
import {
  CHANNEL_LIMITS,
  EVENT_INDEX,
  PLACEHOLDERS,
  SAMPLE_PROFILES,
  TEMPLATE_EVENTS,
  activeConflict,
  eventLabel,
  placeholdersIn,
  renderText,
  smsInfo,
  templateStore,
  type NotificationTemplate,
} from "@/lib/admin/templates";
import { matchesSearch } from "@/lib/admin/filters";
import { newId, useHydrated } from "@/lib/admin/store";
import { formatDate, formatDateTime } from "@/lib/utils";

const BASE = "/admin/notifications/templates";
const CHANNELS: Channel[] = ["EMAIL", "SMS", "IN_APP"];
const PLACEHOLDER_LABEL = new Map(PLACEHOLDERS.map((p) => [p.key, p.label]));

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function TemplateList() {
  const templates = templateStore.useItems();
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [gapsOnly, setGapsOnly] = useState(false);

  // Events that nothing active covers on any channel.
  const uncovered = TEMPLATE_EVENTS.filter((e) => !templates.some((t) => t.event === e.key && t.status === "ACTIVE"));

  const filtered = useMemo(
    () =>
      [...templates]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .filter(
          (t) =>
            (!channel || t.channel === channel) &&
            (!category || EVENT_INDEX.get(t.event)?.category === category) &&
            (!status || t.status === status) &&
            matchesSearch(search, [t.name, t.code, eventLabel(t.event), t.subject, t.body])
        ),
    [templates, channel, category, status, search]
  );
  const { slice, page, pages, setPage } = usePaged(filtered, 20);

  const perChannel = (c: Channel) => {
    const list = templates.filter((t) => t.channel === c);
    return { value: list.filter((t) => t.status === "ACTIVE").length, detail: `active of ${list.length}` };
  };

  return (
    <>
      <PageHeading
        title="Notification templates"
        description="The wording of every email, SMS and in-app message. One active template per event and channel."
        actions={
          <Link href={`${BASE}/new`} className={ButtonLinkClass("primary")}>
            <Plus className="h-4 w-4" strokeWidth={2} />
            Create template
          </Link>
        }
      />
      <StatStrip
        columns={4}
        stats={[
          { label: "Email", ...perChannel("EMAIL") },
          { label: "SMS", ...perChannel("SMS") },
          { label: "In-app", ...perChannel("IN_APP") },
          {
            label: "Events with no active template",
            value: uncovered.length,
            detail: uncovered.length ? (
              <button type="button" onClick={() => setGapsOnly((v) => !v)} className="underline underline-offset-4">
                {gapsOnly ? "Hide list" : "Show which"}
              </button>
            ) : (
              "Every event is covered"
            ),
          },
        ]}
      />

      {gapsOnly && uncovered.length > 0 && (
        <Card className="mt-4">
          <p className="mb-2 text-sm text-[var(--color-ink)]">Nothing is sent for these events until a template is activated:</p>
          <ul className="flex flex-wrap gap-2">
            {uncovered.map((e) => (
              <li key={e.key}>
                <Link href={`${BASE}/new?event=${encodeURIComponent(e.key)}`} className="inline-flex items-center gap-1 border border-[var(--color-line)] px-2 py-1 text-sm text-[var(--color-ink)] hover:bg-[var(--color-paper)]">
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                  {e.label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6">
        <FilterBar
          active={!!(search || channel || category || status)}
          onClear={() => {
            setSearch("");
            setChannel("");
            setCategory("");
            setStatus("");
          }}
        >
          <SearchField value={search} onChange={setSearch} placeholder="Name, code, event or wording" />
          <FilterSelect label="Channel" value={channel} onChange={setChannel} options={CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))} />
          <FilterSelect label="Category" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_META[c].label }))} />
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />
        </FilterBar>
      </div>

      <ResultCount shown={filtered.length} total={templates.length} noun="templates" />
      {filtered.length === 0 ? (
        <EmptyState message="No templates match these filters." />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>Template</Th>
              <Th>Channel</Th>
              <Th>Sent when</Th>
              <Th>Status</Th>
              <Th>Last changed</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {slice.map((t) => {
              const ev = EVENT_INDEX.get(t.event);
              return (
                <tr key={t.id}>
                  <Td>
                    <Link href={`${BASE}/${t.id}`} className="text-[var(--color-ink)] underline-offset-4 hover:underline">
                      {t.name}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-[var(--color-ink-faint)]">{t.code}</p>
                  </Td>
                  <Td>
                    <ChannelBadge channel={t.channel} />
                  </Td>
                  <Td>
                    <p className="text-[var(--color-ink)]">{eventLabel(t.event)}</p>
                    {ev && (
                      <div className="mt-1">
                        <CategoryBadge category={ev.category} />
                      </div>
                    )}
                  </Td>
                  <Td>
                    <ActiveBadge active={t.status === "ACTIVE"} />
                  </Td>
                  <Td className="whitespace-nowrap">
                    {formatDate(t.updatedAt)}
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">Version {t.version}</p>
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <Link href={`${BASE}/${t.id}`} className="mr-4 text-sm text-[var(--color-ink)] underline underline-offset-4">
                      Preview
                    </Link>
                    <Link href={`${BASE}/${t.id}/edit`} className="text-sm text-[var(--color-ink-soft)] underline underline-offset-4 hover:text-[var(--color-ink)]">
                      Edit
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableFrame>
      )}
      <Pager page={page} pages={pages} setPage={setPage} />
    </>
  );
}

// ---------------------------------------------------------------------------
// View + preview
// ---------------------------------------------------------------------------

function SampleSwitch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">Sample data</span>
      <SelectInput value={value} onChange={(e) => onChange(e.target.value)}>
        {SAMPLE_PROFILES.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </SelectInput>
    </label>
  );
}

function sampleValues(key: string) {
  return (SAMPLE_PROFILES.find((p) => p.key === key) ?? SAMPLE_PROFILES[0]).values;
}

export function TemplateView({ id }: { id: string }) {
  const hydrated = useHydrated();
  const templates = templateStore.useItems();
  const t = templates.find((x) => x.id === id);
  const [sample, setSample] = useState(SAMPLE_PROFILES[0].key);
  const [notice, setNotice] = useState("");
  const [confirmSwap, setConfirmSwap] = useState(false);

  if (!t) {
    if (!hydrated) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;
    return (
      <EmptyState
        message="This template doesn't exist."
        action={
          <Link href={BASE} className={ButtonLinkClass("secondary")}>
            Back to templates
          </Link>
        }
      />
    );
  }

  const ev = EVENT_INDEX.get(t.event);
  const conflict = activeConflict(templates, t);
  const used = placeholdersIn(`${t.subject}\n${t.body}`);

  function setActive(active: boolean, swap = false) {
    const now = new Date().toISOString();
    if (active && conflict && swap) {
      templateStore.update(conflict.id, { status: "INACTIVE", updatedAt: now });
    }
    templateStore.update(t!.id, { status: active ? "ACTIVE" : "INACTIVE", updatedAt: now });
    setConfirmSwap(false);
    setNotice(
      active
        ? swap && conflict
          ? `${t!.name} is now active. ${conflict.name} was deactivated.`
          : `${t!.name} is now active.`
        : `${t!.name} deactivated. Nothing is sent for “${eventLabel(t!.event)}” by ${CHANNEL_LABELS[t!.channel]} until another template is activated.`
    );
  }

  return (
    <>
      <Link href={BASE} className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        All templates
      </Link>
      <PageHeading
        title={t.name}
        description={`${t.code} · version ${t.version} · changed ${formatDateTime(t.updatedAt)} by ${t.updatedBy}`}
        actions={
          <>
            <Link href={`${BASE}/new?from=${t.id}`} className={ButtonLinkClass("secondary")}>
              <Copy className="h-4 w-4" strokeWidth={1.75} />
              Duplicate
            </Link>
            <Link href={`${BASE}/${t.id}/edit`} className={ButtonLinkClass("primary")}>
              Edit
            </Link>
          </>
        }
      />

      {notice && (
        <p role="status" className="mb-4 border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success)]">
          {notice}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-6">
          <Card padded={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <ChannelBadge channel={t.channel} />
                <ActiveBadge active={t.status === "ACTIVE"} />
              </div>
              {t.status === "ACTIVE" ? (
                <button type="button" onClick={() => setActive(false)} className="text-sm text-[var(--color-danger)] underline underline-offset-4">
                  Deactivate
                </button>
              ) : conflict && !confirmSwap ? (
                <button type="button" onClick={() => setConfirmSwap(true)} className="text-sm text-[var(--color-success)] underline underline-offset-4">
                  Activate
                </button>
              ) : !conflict ? (
                <button type="button" onClick={() => setActive(true)} className="text-sm text-[var(--color-success)] underline underline-offset-4">
                  Activate
                </button>
              ) : null}
            </div>
            {confirmSwap && conflict && (
              <div className="border-b border-[var(--color-line)] bg-[var(--color-amber-soft)] px-5 py-3 text-sm">
                <p className="text-[var(--color-ink)]">
                  <Link href={`${BASE}/${conflict.id}`} className="underline underline-offset-4">
                    {conflict.name}
                  </Link>{" "}
                  is the active {CHANNEL_LABELS[t.channel]} template for this event. Only one can be active.
                </p>
                <div className="mt-2 flex gap-4">
                  <button type="button" onClick={() => setActive(true, true)} className="font-medium text-[var(--color-ink)] underline underline-offset-4">
                    Activate this one instead
                  </button>
                  <button type="button" onClick={() => setConfirmSwap(false)} className="text-[var(--color-ink-soft)] underline underline-offset-4">
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <DescriptionList
              items={[
                { label: "Sent when", value: eventLabel(t.event) },
                { label: "Category", value: ev ? <CategoryBadge category={ev.category} /> : "—" },
                { label: "Recipient", value: ev ? (ev.audience === "student" ? "Student" : ev.audience === "institution" ? "Institution staff" : "Administrators") : "—" },
                ...(t.channel !== "SMS" ? [{ label: t.channel === "EMAIL" ? "Subject" : "Title", value: <span className="font-mono text-xs">{t.subject}</span> }] : []),
                { label: "Placeholders used", value: used.length ? used.map((k) => PLACEHOLDER_LABEL.get(k) ?? k).join(", ") : "None" },
                { label: "Notes", value: t.notes || "—" },
                { label: "Created", value: formatDateTime(t.createdAt) },
              ]}
            />
          </Card>
          <Card padded={false}>
            <CardHeader title="Template text" description="Placeholders in double braces are filled in when the message is sent." />
            <pre className="overflow-x-auto whitespace-pre-wrap px-5 py-4 font-mono text-xs leading-relaxed text-[var(--color-ink)]">{t.body}</pre>
          </Card>
        </div>

        <Card padded={false} className="self-start">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-line)] px-5 py-3.5">
            <p className="font-[var(--font-display)] text-base text-[var(--color-ink)]">Preview</p>
            <div className="w-full sm:w-72">
              <SampleSwitch value={sample} onChange={setSample} />
            </div>
          </div>
          <div className="p-5">
            <TemplatePreview channel={t.channel} subject={t.subject} body={t.body} values={sampleValues(sample)} category={ev?.category} />
          </div>
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Create / edit
// ---------------------------------------------------------------------------

type Draft = Pick<NotificationTemplate, "name" | "code" | "channel" | "event" | "subject" | "body" | "status" | "notes">;
type Errors = Partial<Record<keyof Draft, string>>;

const EMPTY: Draft = { name: "", code: "", channel: "EMAIL", event: "", subject: "", body: "", status: "INACTIVE", notes: "" };

export function TemplateFormScreen({ id, fromId, event }: { id?: string; fromId?: string; event?: string }) {
  const hydrated = useHydrated();
  const templates = templateStore.useItems();
  const initial = id ? templates.find((t) => t.id === id) : undefined;
  const source = fromId ? templates.find((t) => t.id === fromId) : undefined;

  if (!hydrated) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;
  if (id && !initial) {
    return (
      <EmptyState
        message="This template doesn't exist."
        action={
          <Link href={BASE} className={ButtonLinkClass("secondary")}>
            Back to templates
          </Link>
        }
      />
    );
  }

  const start: Draft = initial
    ? { ...initial }
    : source
      ? { ...source, name: `${source.name} (copy)`, code: `${source.code}-COPY`, status: "INACTIVE" }
      : { ...EMPTY, event: event && EVENT_INDEX.has(event) ? event : "" };

  return (
    <>
      <Link href={initial ? `${BASE}/${initial.id}` : BASE} className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        {initial ? initial.name : "All templates"}
      </Link>
      <PageHeading
        title={initial ? `Edit ${initial.name}` : "Create template"}
        description={initial ? `Saving creates version ${initial.version + 1}.` : "Write the message once; placeholders are filled in for each recipient."}
      />
      <TemplateForm key={initial?.id ?? source?.id ?? "new"} initial={initial} start={start} />
    </>
  );
}

function TemplateForm({ initial, start }: { initial?: NotificationTemplate; start: Draft }) {
  const router = useRouter();
  const [form, setForm] = useState<Draft>(start);
  const [errors, setErrors] = useState<Errors>({});
  const [sample, setSample] = useState(SAMPLE_PROFILES[0].key);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastField = useRef<"subject" | "body">("body");

  const ev = EVENT_INDEX.get(form.event);
  const allowed = new Set(ev?.placeholders ?? []);
  const sampleSet = sampleValues(sample);
  // Only the event's own placeholders are filled in, so ones that won't
  // work for this event show up in red in the preview.
  const values = ev ? Object.fromEntries(Object.entries(sampleSet).filter(([k]) => allowed.has(k))) : sampleSet;
  const hasSubject = form.channel !== "SMS";

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  }

  function insert(key: string) {
    const token = `{{${key}}}`;
    const target = hasSubject && lastField.current === "subject" ? "subject" : "body";
    const el = target === "subject" ? subjectRef.current : bodyRef.current;
    const text = form[target];
    const startPos = el?.selectionStart ?? text.length;
    const endPos = el?.selectionEnd ?? text.length;
    const next = text.slice(0, startPos) + token + text.slice(endPos);
    set(target, next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = startPos + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  // Live checks shown under the fields as warnings.
  const used = placeholdersIn(`${hasSubject ? form.subject : ""}\n${form.body}`);
  const unknown = used.filter((k) => !PLACEHOLDER_LABEL.has(k));
  const notForEvent = ev ? used.filter((k) => PLACEHOLDER_LABEL.has(k) && !allowed.has(k)) : [];
  const sms = form.channel === "SMS" ? smsInfo(renderText(form.body, values)) : null;
  const conflict = activeConflict(templateStore.getAll(), { id: initial?.id ?? "", event: form.event, channel: form.channel });

  function validate(): Errors {
    const e: Errors = {};
    const code = form.code.trim();
    if (!form.name.trim()) e.name = "Enter a name administrators will recognise.";
    if (!code) e.code = "Enter a code.";
    else if (!/^[A-Z0-9-]+$/.test(code)) e.code = "Use capital letters, digits and hyphens only, for example ADM-OFFER-EMAIL.";
    else if (templateStore.getAll().some((t) => t.id !== initial?.id && t.code === code)) e.code = "Another template already uses this code.";
    if (!form.event) e.event = "Choose when this message is sent.";
    if (hasSubject) {
      const limit = form.channel === "EMAIL" ? CHANNEL_LIMITS.subjectEmail : CHANNEL_LIMITS.titleInApp;
      if (!form.subject.trim()) e.subject = form.channel === "EMAIL" ? "Enter a subject line." : "Enter a title.";
      else if (form.subject.length > limit) e.subject = `Keep it to ${limit} characters or fewer (now ${form.subject.length}).`;
    }
    if (!form.body.trim()) e.body = "Write the message.";
    else if (unknown.length) e.body = `Unknown placeholder${unknown.length > 1 ? "s" : ""}: ${unknown.map((k) => `{{${k}}}`).join(", ")}. Pick from the list instead.`;
    else if (notForEvent.length) e.body = `${notForEvent.map((k) => `{{${k}}}`).join(", ")} ${notForEvent.length > 1 ? "aren't" : "isn't"} available for “${ev!.label}”.`;
    else if (form.channel === "IN_APP" && form.body.length > CHANNEL_LIMITS.bodyInApp) e.body = `In-app messages are limited to ${CHANNEL_LIMITS.bodyInApp} characters (now ${form.body.length}).`;
    else if (sms && sms.segments > CHANNEL_LIMITS.smsMaxSegments) e.body = `This SMS would be sent as ${sms.segments} messages. Shorten it to ${CHANNEL_LIMITS.smsMaxSegments} or fewer.`;
    if (form.status === "ACTIVE" && conflict) e.status = `${conflict.name} is already active for this event by ${CHANNEL_LABELS[form.channel]}. Save this as inactive, then activate it from its page to swap.`;
    return e;
  }

  function save() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    const now = new Date().toISOString();
    const fields = {
      name: form.name.trim(),
      code: form.code.trim(),
      channel: form.channel,
      event: form.event,
      subject: hasSubject ? form.subject.trim() : "",
      body: form.body.trim(),
      status: form.status,
      notes: form.notes.trim(),
      updatedAt: now,
      updatedBy: "Chantal Biya-Fouda",
    };
    if (initial) {
      templateStore.update(initial.id, { ...fields, version: initial.version + 1 });
      router.push(`${BASE}/${initial.id}`);
    } else {
      const created: NotificationTemplate = { ...fields, id: newId("tpl"), version: 1, createdAt: now };
      templateStore.add(created);
      router.push(`${BASE}/${created.id}`);
    }
  }

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <div className="space-y-6">
        <Card>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Template name" required error={errors.name}>
              <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Offer of admission" />
            </Field>
            <Field label="Code" required error={errors.code} hint="Used to trace sent messages back to this template.">
              <TextInput value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="ADM-OFFER-EMAIL" className="font-mono" />
            </Field>
            <Field label="Channel" required>
              <SelectInput value={form.channel} onChange={(e) => set("channel", e.target.value as Channel)}>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {CHANNEL_LABELS[c]}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Sent when" required error={errors.event}>
              <SelectInput value={form.event} onChange={(e) => set("event", e.target.value)}>
                <option value="">Select an event…</option>
                {CATEGORIES.map((c) => (
                  <optgroup key={c} label={CATEGORY_META[c].label}>
                    {TEMPLATE_EVENTS.filter((ev) => ev.category === c).map((ev) => (
                      <option key={ev.key} value={ev.key}>
                        {ev.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </SelectInput>
            </Field>
          </div>
        </Card>

        <Card>
          <div className="space-y-5">
            {hasSubject && (
              <Field label={form.channel === "EMAIL" ? "Subject line" : "Title"} required error={errors.subject}>
                <TextInput
                  ref={subjectRef}
                  value={form.subject}
                  onFocus={() => (lastField.current = "subject")}
                  onChange={(e) => set("subject", e.target.value)}
                />
              </Field>
            )}
            <Field
              label="Message"
              required
              error={errors.body}
              hint={
                form.channel === "SMS"
                  ? "Plain text. Accented letters such as ï and dashes (—) make SMS messages shorter."
                  : form.channel === "IN_APP"
                    ? `Up to ${CHANNEL_LIMITS.bodyInApp} characters. Leave a blank line between paragraphs.`
                    : "Plain text. Leave a blank line between paragraphs."
              }
            >
              <TextArea
                ref={bodyRef}
                rows={form.channel === "SMS" ? 4 : 10}
                value={form.body}
                onFocus={() => (lastField.current = "body")}
                onChange={(e) => set("body", e.target.value)}
                className="font-mono text-sm"
              />
            </Field>

            <div>
              <p className="mb-2 text-sm text-[var(--color-ink-soft)]">
                Insert a placeholder {hasSubject ? "into the subject or message, wherever the cursor was" : "at the cursor"}
              </p>
              {!ev ? (
                <p className="text-xs text-[var(--color-ink-faint)]">Choose when this message is sent to see the placeholders available.</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {ev.placeholders.map((k) => (
                    <li key={k}>
                      <button
                        type="button"
                        onClick={() => insert(k)}
                        title={`{{${k}}}`}
                        className={`border px-2 py-1 text-xs transition-colors ${
                          used.includes(k)
                            ? "border-[var(--color-brass)] bg-[var(--color-brass-soft)] text-[var(--color-ink)]"
                            : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink)]"
                        }`}
                      >
                        {PLACEHOLDER_LABEL.get(k)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Status" error={errors.status} hint={conflict && form.status !== "ACTIVE" ? `${conflict.name} is currently active for this event.` : undefined}>
              <SelectInput value={form.status} onChange={(e) => set("status", e.target.value as Draft["status"])}>
                <option value="ACTIVE">Active — send this wording</option>
                <option value="INACTIVE">Inactive — draft or retired</option>
              </SelectInput>
            </Field>
            <Field label="Notes" hint="Optional. For administrators only.">
              <TextInput value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </div>

          {errorCount > 0 && (
            <div className="mt-5">
              <FormError>Fix the {errorCount === 1 ? "field" : `${errorCount} fields`} marked above to save.</FormError>
            </div>
          )}
          <div className="mt-6 flex items-center gap-3 border-t border-[var(--color-line)] pt-5">
            <PrimaryButton type="submit">{initial ? "Save changes" : "Create template"}</PrimaryButton>
            <SecondaryButton type="button" onClick={() => router.push(initial ? `${BASE}/${initial.id}` : BASE)}>
              Cancel
            </SecondaryButton>
          </div>
        </Card>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <Card padded={false}>
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-line)] px-5 py-3.5">
            <p className="font-[var(--font-display)] text-base text-[var(--color-ink)]">Live preview</p>
            <div className="w-full sm:w-72">
              <SampleSwitch value={sample} onChange={setSample} />
            </div>
          </div>
          <div className="p-5">
            <TemplatePreview channel={form.channel} subject={hasSubject ? form.subject : ""} body={form.body} values={values} category={ev?.category} />
            {(unknown.length > 0 || notForEvent.length > 0) && (
              <p className="mt-3 text-xs text-[var(--color-danger)]">Placeholders highlighted in red won&apos;t be filled in.</p>
            )}
          </div>
        </Card>
      </div>
    </form>
  );
}
