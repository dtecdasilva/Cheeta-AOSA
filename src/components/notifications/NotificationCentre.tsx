"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Archive, ArchiveRestore, ArrowLeft, Bell, CheckCheck, Mail, MailOpen, MessageSquare, Monitor } from "lucide-react";
import { Card, CardHeader, DescriptionList, EmptyState, TableFrame, Td, Th } from "@/components/ui";
import { ButtonLinkClass, SecondaryButton } from "@/components/Form";
import { DateRangeFilter, FilterBar, FilterSelect, Pager, ResultCount, SearchField, StatStrip, ToneBadge, usePaged } from "@/components/admin/ui";
import {
  CATEGORIES,
  CATEGORY_META,
  CHANNEL_LABELS,
  HISTORY_LABELS,
  useNotifications,
  type Audience,
  type CentreNotification,
  type Channel,
  type NotificationCategory,
} from "@/lib/notifications/center";
import { EMPTY_RANGE, inRange, matchesSearch, type DateRange } from "@/lib/admin/filters";
import { useHydrated } from "@/lib/admin/store";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

export function CategoryBadge({ category }: { category: NotificationCategory }) {
  const tr = useT();
  const m = CATEGORY_META[category];
  return <ToneBadge tone={m.tone}>{tr(m.label)}</ToneBadge>;
}

const CHANNEL_ICONS: Record<Channel, typeof Mail> = { IN_APP: Monitor, EMAIL: Mail, SMS: MessageSquare };

function ChannelIcons({ n }: { n: CentreNotification }) {
  const tr = useT();
  return (
    <span className="inline-flex items-center gap-1.5 text-[var(--color-ink-faint)]">
      {n.deliveries.map((d) => {
        const Icon = CHANNEL_ICONS[d.channel];
        const failed = d.status === "FAILED";
        return (
          <span key={d.channel} title={`${tr(CHANNEL_LABELS[d.channel])}: ${failed ? "failed" : d.status.toLowerCase()}`} className={failed ? "text-[var(--color-danger)]" : undefined}>
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            <span className="sr-only">
              {tr(CHANNEL_LABELS[d.channel])} {failed ? "failed" : d.status.toLowerCase()}
            </span>
          </span>
        );
      })}
    </span>
  );
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string, hydrated: boolean) {
  if (hydrated) {
    const now = new Date();
    const today = dayKey(now.toISOString());
    const yesterday = dayKey(new Date(now.getTime() - 86_400_000).toISOString());
    const k = dayKey(iso);
    if (k === today) return "Today";
    if (k === yesterday) return "Yesterday";
  }
  return formatDate(iso);
}

function timeOf(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

type ReadFilter = "all" | "unread" | "read";

// ---------------------------------------------------------------------------
// Centre + list
// ---------------------------------------------------------------------------

export function NotificationCentre({ audience, basePath }: { audience: Audience; basePath: string }) {
  const tr = useT();
  const { inbox, all, unreadCount, markRead, markUnread, archive, markAllRead } = useNotifications(audience);
  const hydrated = useHydrated();
  const [category, setCategory] = useState<NotificationCategory | "">("");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [importantOnly, setImportantOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  const filtered = useMemo(
    () =>
      inbox.filter(
        (n) =>
          (!category || n.category === category) &&
          (readFilter === "all" || (readFilter === "unread" ? !n.readAt : !!n.readAt)) &&
          (!importantOnly || n.important) &&
          matchesSearch(search, [n.title, n.summary, n.body, n.reference, n.institutionName])
      ),
    [inbox, category, readFilter, importantOnly, search]
  );
  const { slice, page, pages, setPage } = usePaged(filtered, 15);

  const unreadInView = filtered.filter((n) => !n.readAt);
  const importantUnread = inbox.filter((n) => n.important && !n.readAt).length;
  const archivedCount = all.length - inbox.length;
  const weekAgo = hydrated ? Date.now() - 7 * 86_400_000 : 0;
  const thisWeek = hydrated ? inbox.filter((n) => new Date(n.createdAt).getTime() >= weekAgo).length : null;

  const unreadBy = (c: NotificationCategory) => inbox.filter((n) => n.category === c && !n.readAt).length;
  const countBy = (c: NotificationCategory) => inbox.filter((n) => n.category === c).length;

  // Group the current page by day, newest first.
  const groups: { label: string; items: CentreNotification[] }[] = [];
  slice.forEach((n) => {
    const label = dayLabel(n.createdAt, hydrated);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  });

  return (
    <>
      <StatStrip
        columns={4}
        stats={[
          { label: tr("Unread"), value: unreadCount, detail: unreadCount ? tr("Newest first below") : tr("You're all caught up") },
          { label: tr("Important and unread"), value: importantUnread, detail: tr("Need your attention") },
          { label: tr("Received this week"), value: thisWeek ?? "—" },
          { label: tr("Archived"), value: archivedCount, detail: <Link href={`${basePath}/history`} className="underline underline-offset-4">{tr("See history")}</Link> },
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label={tr("Notification categories")} className="self-start overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
          <ul className="divide-y divide-[var(--color-line)]">
            <CategoryLink label={tr("All notifications")} count={inbox.length} unread={unreadCount} current={category === ""} onClick={() => setCategory("")} />
            {CATEGORIES.map((c) => (
              <CategoryLink key={c} label={tr(CATEGORY_META[c].label)} count={countBy(c)} unread={unreadBy(c)} current={category === c} onClick={() => setCategory(c)} />
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div role="radiogroup" aria-label={tr("Show")} className="flex overflow-hidden rounded-lg border border-[var(--color-line-strong)]">
                {(["all", "unread", "read"] as ReadFilter[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={readFilter === r}
                    onClick={() => setReadFilter(r)}
                    className={`rounded-none px-3 py-2 text-sm capitalize transition-colors ${
                      readFilter === r
                        ? "bg-[var(--color-brand-soft)] font-medium text-[var(--color-ink)]"
                        : "text-[var(--color-ink-soft)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    {tr(r)}
                  </button>
                ))}
              </div>
              <label className="inline-flex items-center gap-2 pb-2 text-sm text-[var(--color-ink-soft)]">
                <input type="checkbox" checked={importantOnly} onChange={(e) => setImportantOnly(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
                {tr("Important only")}
              </label>
            </div>
            <div className="w-full sm:w-72">
              <SearchField value={search} onChange={setSearch} placeholder={tr("Search notifications")} wide={false} />
            </div>
          </div>

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <ResultCount shown={filtered.length} total={inbox.length} noun={tr("notifications")} />
            <div className="flex items-center gap-4 text-sm">
              {unreadInView.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    markAllRead(unreadInView.map((n) => n.id));
                    setNotice(tr("{count} marked as read.", { count: unreadInView.length }));
                  }}
                  className="inline-flex items-center gap-1.5 text-[var(--color-ink)] underline underline-offset-4"
                >
                  <CheckCheck className="h-4 w-4" strokeWidth={1.75} />
                  {tr("Mark")}{" "}{category || readFilter !== "all" || search || importantOnly ? "these" : "all"}{" "}{tr("as read")}
                </button>
              )}
              <Link href={`${basePath}/history`} className="text-[var(--color-ink-soft)] underline underline-offset-4 hover:text-[var(--color-ink)]">
                {tr("Notification history")}
              </Link>
            </div>
          </div>

          {notice && (
            <p role="status" className="mb-3 rounded-lg border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success-strong)]">
              {tr(notice)}
            </p>
          )}

          {filtered.length === 0 ? (
            <EmptyState
              message={
                inbox.length === 0
                  ? tr("You have no notifications yet.")
                  : readFilter === "unread" && !category && !search && !importantOnly
                    ? tr("No unread notifications. You're all caught up.")
                    : tr("No notifications match these filters.")
              }
            />
          ) : (
            <div className="space-y-5">
              {groups.map((g) => (
                <section key={g.label + g.items[0].id} aria-label={tr(g.label)}>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">{tr(g.label)}</h3>
                  <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
                    {g.items.map((n) => (
                      <NotificationRow
                        key={n.id}
                        n={n}
                        href={`${basePath}/${n.id}`}
                        onToggleRead={() => {
                          if (n.readAt) markUnread(n.id);
                          else markRead(n.id);
                          setNotice("");
                        }}
                        onArchive={() => {
                          archive(n.id);
                          setNotice(tr("“{title}” archived. Find it in notification history.", { title: tr(n.title) }));
                        }}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          <Pager page={page} pages={pages} setPage={setPage} />
        </div>
      </div>
    </>
  );
}

function CategoryLink({ label, count, unread, current, onClick }: { label: string; count: number; unread: number; current: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={current}
        className={`relative flex w-full items-center justify-between gap-2 rounded-none px-4 py-2.5 text-left text-sm transition-colors ${
          current
            ? "bg-[var(--color-brand-soft)] font-medium text-[var(--color-ink)]"
            : "text-[var(--color-ink-soft)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink)]"
        }`}
      >
        {current && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-[var(--color-brand)]" />}
        <span>{label}</span>
        <span className="flex items-center gap-2 text-xs tabular-nums">
          {unread > 0 && (
            <span className="min-w-5 rounded-full bg-[var(--color-brand)] px-1.5 py-0.5 text-center text-[10px] font-semibold text-white" title={`${unread} unread`}>
              {unread}
            </span>
          )}
          <span className="text-[var(--color-ink-faint)]">{count}</span>
        </span>
      </button>
    </li>
  );
}

function NotificationRow({
  n,
  href,
  onToggleRead,
  onArchive,
}: {
  n: CentreNotification;
  href: string;
  onToggleRead: () => void;
  onArchive: () => void;
}) {
  const tr = useT();
  const unread = !n.readAt;
  return (
    <li className={`group relative flex items-start gap-3 px-4 py-3.5 ${unread ? "bg-[var(--color-surface)]" : "bg-[var(--color-paper)]/40"}`}>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? "bg-[var(--color-brand)]" : "bg-transparent"}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={n.category} />
          {n.important && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-danger)]">
              <AlertCircle className="h-3.5 w-3.5" strokeWidth={2} />
              {tr("Important")}
            </span>
          )}
          <span className="ml-auto text-xs tabular-nums text-[var(--color-ink-faint)]">{timeOf(n.createdAt)}</span>
        </div>
        <Link href={href} className="mt-1.5 block after:absolute after:inset-0">
          <span className={`block text-sm ${unread ? "font-semibold text-[var(--color-ink)]" : "text-[var(--color-ink-soft)]"}`}>
            {unread && <span className="sr-only">{tr("Unread:")}{" "}</span>}
            {tr(n.title)}
          </span>
          <span className="mt-0.5 block text-sm text-[var(--color-ink-soft)]">{tr(n.summary)}</span>
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--color-ink-faint)]">
          {n.institutionName && <span>{tr(n.institutionName)}</span>}
          {n.reference && <span className="tabular-nums">{n.reference}</span>}
          <ChannelIcons n={n} />
        </div>
      </div>
      <div className="relative z-10 flex shrink-0 items-center gap-1">
        <IconButton label={unread ? tr("Mark as read") : tr("Mark as unread")} onClick={onToggleRead}>
          {unread ? <MailOpen className="h-4 w-4" strokeWidth={1.75} /> : <Mail className="h-4 w-4" strokeWidth={1.75} />}
        </IconButton>
        <IconButton label={tr("Archive")} onClick={onArchive}>
          <Archive className="h-4 w-4" strokeWidth={1.75} />
        </IconButton>
      </div>
    </li>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="p-1.5 text-[var(--color-ink-faint)] transition-colors hover:bg-[var(--color-paper)] hover:text-[var(--color-ink)]"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export function NotificationDetail({ audience, basePath, id }: { audience: Audience; basePath: string; id: string }) {
  const tr = useT();
  const router = useRouter();
  const hydrated = useHydrated();
  const { all, loaded, markRead, markUnread, archive, restore } = useNotifications(audience);
  const n = all.find((x) => x.id === id);
  const [openedUnread, setOpenedUnread] = useState(false);
  const handled = useRef<string | null>(null);

  // Opening a notification reads it. Done once per notification, after
  // hydration, so a "Mark as unread" click here isn't immediately undone.
  const found = !!n;
  useEffect(() => {
    if (!hydrated || !found || handled.current === id) return;
    handled.current = id;
    if (n && !n.readAt) {
      markRead(id);
      setOpenedUnread(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, found, id, markRead]);

  if (!n) {
    if (!hydrated || !loaded) return <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>;
    return (
      <EmptyState
        message={tr("This notification doesn't exist or belongs to someone else.")}
        action={
          <Link href={basePath} className={ButtonLinkClass("secondary")}>
            {tr("Back to notifications")}
          </Link>
        }
      />
    );
  }

  const paragraphs = n.body.split(/\n\s*\n/);

  return (
    <>
      <Link href={basePath} className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        {tr("All notifications")}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card padded={false}>
          <div className="border-b border-[var(--color-line)] px-6 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={n.category} />
              {n.important && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-danger)]">
                  <AlertCircle className="h-3.5 w-3.5" strokeWidth={2} />
                  {tr("Important")}
                </span>
              )}
              {n.archivedAt && <ToneBadge tone="neutral">{tr("Archived")}</ToneBadge>}
            </div>
            <h2 className="mt-3 font-bold tracking-tight text-2xl text-[var(--color-ink)]">{tr(n.title)}</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-faint)]">{formatDateTime(n.createdAt)}</p>
          </div>
          <div className="space-y-3 px-6 py-5 text-[15px] leading-relaxed text-[var(--color-ink)]">
            {paragraphs.map((p, i) => (
              <p key={i}>{tr(p)}</p>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-line)] px-6 py-4">
            {n.action && (
              <Link href={n.action.href} className={ButtonLinkClass("primary")}>
                {tr(n.action.label)}
              </Link>
            )}
            <SecondaryButton type="button" onClick={() => (n.readAt ? markUnread(n.id) : markRead(n.id))}>
              {n.readAt ? tr("Mark as unread") : tr("Mark as read")}
            </SecondaryButton>
            {n.archivedAt ? (
              <SecondaryButton type="button" onClick={() => restore(n.id)}>
                <ArchiveRestore className="h-4 w-4" strokeWidth={1.75} />
                {tr("Restore to inbox")}
              </SecondaryButton>
            ) : (
              <SecondaryButton
                type="button"
                onClick={() => {
                  archive(n.id);
                  router.push(basePath);
                }}
              >
                <Archive className="h-4 w-4" strokeWidth={1.75} />
                {tr("Archive")}
              </SecondaryButton>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card padded={false}>
            <CardHeader title={tr("Details")} />
            <DescriptionList
              items={[
                { label: tr("Category"), value: CATEGORY_META[n.category].label },
                { label: tr("Status"), value: n.archivedAt ? tr("Archived") : n.readAt ? tr("Read") : tr("Unread") },
                { label: tr("Read"), value: n.readAt ? formatDateTime(n.readAt) : tr("Not yet") },
                ...(n.reference ? [{ label: tr("Reference"), value: n.reference }] : []),
                ...(n.institutionName ? [{ label: tr("Institution"), value: n.institutionName }] : []),
                ...(n.templateCode ? [{ label: tr("Template"), value: n.templateCode }] : []),
              ]}
            />
          </Card>
          <Card padded={false}>
            <CardHeader title={tr("Delivery")} description={tr("Where this message was sent.")} />
            <ul className="divide-y divide-[var(--color-line)]">
              {n.deliveries.map((d) => (
                <li key={d.channel} className="px-5 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--color-ink)]">{tr(CHANNEL_LABELS[d.channel])}</span>
                    <ToneBadge tone={d.status === "FAILED" ? "danger" : d.status === "SENT" ? "info" : d.status === "DELIVERED" ? "success" : "neutral"}>
                      {{ FAILED: "Failed", SENT: "Sent", DELIVERED: "Delivered", QUEUED: "Sending", SKIPPED: "Not sent" }[d.status]}
                    </ToneBadge>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                    {tr(d.to)} · {formatDateTime(d.at)}
                  </p>
                  {d.detail && <p className="mt-0.5 text-xs text-[var(--color-danger)]">{tr(d.detail)}</p>}
                </li>
              ))}
            </ul>
          </Card>
          <Card padded={false}>
            <CardHeader title={tr("History")} />
            <ol className="px-5 py-4">
              {[...n.history].reverse().map((h, i) => (
                <li key={i} className="relative border-l border-[var(--color-line)] pb-4 pl-4 last:pb-0">
                  <span className={`absolute -left-[4px] top-1.5 h-2 w-2 rounded-full ${h.kind === "FAILED" ? "bg-[var(--color-danger)]" : "bg-[var(--color-ink-faint)]"}`} />
                  <p className="text-sm text-[var(--color-ink)]">
                    {tr(HISTORY_LABELS[h.kind])}
                    {h.channel ? ` — ${tr(CHANNEL_LABELS[h.channel])}` : ""}
                  </p>
                  <p className="text-xs text-[var(--color-ink-faint)]">{formatDateTime(h.at)}</p>
                  {h.note && <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{tr(h.note)}</p>}
                </li>
              ))}
            </ol>
          </Card>
          {openedUnread && <p className="text-xs text-[var(--color-ink-faint)]">{tr("Marked as read when you opened it.")}</p>}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export function NotificationHistory({ audience, basePath }: { audience: Audience; basePath: string }) {
  const tr = useT();
  const { all, restore, archive } = useNotifications(audience);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [state, setState] = useState("");
  const [channel, setChannel] = useState("");
  const [delivery, setDelivery] = useState("");
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);

  const filtered = useMemo(
    () =>
      all.filter(
        (n) =>
          (!category || n.category === category) &&
          (!state || (state === "archived" ? !!n.archivedAt : state === "unread" ? !n.readAt && !n.archivedAt : !!n.readAt && !n.archivedAt)) &&
          (!channel || n.deliveries.some((d) => d.channel === channel)) &&
          (!delivery || (delivery === "failed" ? n.deliveries.some((d) => d.status === "FAILED") : n.deliveries.every((d) => d.status !== "FAILED"))) &&
          inRange(n.createdAt, range) &&
          matchesSearch(search, [n.title, n.summary, n.reference, n.institutionName, n.templateCode])
      ),
    [all, category, state, channel, delivery, range, search]
  );
  const { slice, page, pages, setPage } = usePaged(filtered, 20);
  const active = !!(search || category || state || channel || delivery || range.from || range.to);
  const failed = all.filter((n) => n.deliveries.some((d) => d.status === "FAILED")).length;

  return (
    <>
      <Link href={basePath} className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        {tr("Notification centre")}
      </Link>

      <StatStrip
        columns={4}
        stats={[
          { label: tr("All notifications"), value: all.length },
          { label: tr("In inbox"), value: all.filter((n) => !n.archivedAt).length },
          { label: tr("Archived"), value: all.filter((n) => n.archivedAt).length },
          { label: tr("With a failed delivery"), value: failed, detail: failed ? tr("Email or SMS didn't arrive") : undefined },
        ]}
      />

      <div className="mt-6">
        <FilterBar
          active={active}
          onClear={() => {
            setSearch("");
            setCategory("");
            setState("");
            setChannel("");
            setDelivery("");
            setRange(EMPTY_RANGE);
          }}
        >
          <SearchField value={search} onChange={setSearch} placeholder={tr("Title, reference, institution or template")} />
          <FilterSelect label={tr("Category")} value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_META[c].label }))} />
          <FilterSelect
            label={tr("State")}
            value={state}
            onChange={setState}
            options={[
              { value: "unread", label: tr("Unread") },
              { value: "read", label: tr("Read") },
              { value: "archived", label: tr("Archived") },
            ]}
          />
          <FilterSelect label={tr("Sent by")} value={channel} onChange={setChannel} options={(Object.keys(CHANNEL_LABELS) as Channel[]).map((c) => ({ value: c, label: tr(CHANNEL_LABELS[c]) }))} />
          <FilterSelect
            label={tr("Delivery")}
            value={delivery}
            onChange={setDelivery}
            options={[
              { value: "ok", label: tr("All delivered") },
              { value: "failed", label: tr("Something failed") },
            ]}
          />
          <DateRangeFilter value={range} onChange={setRange} label={tr("Received")} />
        </FilterBar>
      </div>

      <ResultCount shown={filtered.length} total={all.length} noun={tr("notifications")} />
      {filtered.length === 0 ? (
        <EmptyState message={tr("No notifications match these filters.")} />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>{tr("Received")}</Th>
              <Th>{tr("Notification")}</Th>
              <Th>{tr("Category")}</Th>
              <Th>{tr("Delivery")}</Th>
              <Th>{tr("Read")}</Th>
              <Th>
                <span className="sr-only">{tr("Actions")}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {slice.map((n) => (
              <tr key={n.id} className={n.archivedAt ? "text-[var(--color-ink-soft)]" : undefined}>
                <Td className="whitespace-nowrap tabular-nums">{formatDateTime(n.createdAt)}</Td>
                <Td>
                  <Link href={`${basePath}/${n.id}`} className="text-[var(--color-ink)] underline-offset-4 hover:underline">
                    {tr(n.title)}
                  </Link>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{[n.reference, n.institutionName].filter(Boolean).join(" · ") || n.summary}</p>
                </Td>
                <Td>
                  <CategoryBadge category={n.category} />
                </Td>
                <Td>
                  <ul className="space-y-0.5 text-xs">
                    {n.deliveries.map((d) => (
                      <li key={d.channel} className={d.status === "FAILED" ? "text-[var(--color-danger)]" : "text-[var(--color-ink-soft)]"}>
                        {tr(CHANNEL_LABELS[d.channel])}: {d.status === "FAILED" ? "failed" : d.status.toLowerCase()}
                      </li>
                    ))}
                  </ul>
                </Td>
                <Td className="whitespace-nowrap text-xs">
                  {n.readAt ? formatDateTime(n.readAt) : <span className="font-medium text-[var(--color-ink)]">{tr("Unread")}</span>}
                  {n.archivedAt && <p className="mt-0.5 text-[var(--color-ink-faint)]">{tr("Archived {value}", { value: formatDate(n.archivedAt) })}</p>}
                </Td>
                <Td className="whitespace-nowrap text-right">
                  {n.archivedAt ? (
                    <button type="button" onClick={() => restore(n.id)} className="text-sm text-[var(--color-ink)] underline underline-offset-4">
                      {tr("Restore")}
                    </button>
                  ) : (
                    <button type="button" onClick={() => archive(n.id)} className="text-sm text-[var(--color-ink-soft)] underline underline-offset-4 hover:text-[var(--color-ink)]">
                      {tr("Archive")}
                    </button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
      <Pager page={page} pages={pages} setPage={setPage} />
    </>
  );
}

/** Sidebar badge: unread count for a portal. */
export function useUnreadCount(audience: Audience) {
  return useNotifications(audience).unreadCount;
}

export { Bell as NotificationIcon };
