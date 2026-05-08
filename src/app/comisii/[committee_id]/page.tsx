import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Dateline } from "@/components/dateline";
import { YearSparkbar } from "@/components/year-sparkbar";
import { env } from "@/env";
import {
  agendaOutcomeLabel,
  committeeKindLabel,
  formatCount,
  formatDate,
  pluralRo,
} from "@/lib/format";
import { committeePage } from "@/lib/search";
import type { CommitteePagePayload, MoCommitteeMeeting } from "@/lib/types";

// Committee profile pages are citation-grade archive entries: stable URL,
// ISR 1h, JSON-LD `GovernmentOrganization` so the page is harvestable as a
// public registry record. The committee_id is minted upstream by the
// monitorul-ii pipeline and is stable across re-extractions.
export const revalidate = 3600;
export const dynamicParams = true;

interface RouteParams {
  committee_id: string;
}

interface PageProps {
  params: Promise<RouteParams>;
  searchParams: Promise<{ year?: string | string[] }>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseYearParam(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1990 || n > 2100) return undefined;
  return n;
}

// Next.js 16 leaves percent-encoded UTF-8 in dynamic route params verbatim
// (e.g. `%C8%9B` for `ț` arrives as the literal escape sequence rather than
// the decoded character). Committee IDs are diacritic-bearing slugs like
// `comisia-pentru-buget-finanțe-și-bănci`, so a non-decoded param fails the
// `term: { committee_id }` exact-match query and the page 404s. Decoding here
// is safe: ASCII slugs are no-ops; malformed sequences fall back to the raw
// string so a hand-crafted URL can't crash the route.
function decodeIdParam(raw: string): string {
  if (!raw.includes("%")) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { committee_id: rawId } = await params;
  const committeeId = decodeIdParam(rawId);
  const payload = await committeePage(committeeId);
  const canonical = `/comisii/${encodeURIComponent(committeeId)}`;
  if (!payload) {
    return { title: "Comisie neidentificată", alternates: { canonical } };
  }
  const lifespan = activeLifespan(payload);
  const title = `${payload.name}${lifespan ? ` · ${lifespan}` : ""}`;
  const description =
    payload.totalMeetings > 0
      ? `${payload.name}: ${formatCount(payload.totalMeetings)} ${pluralRo(
          payload.totalMeetings,
          "ședință",
          "ședințe",
          "de ședințe",
        ).replace(/^\d+\s/, "")} indexate din Monitorul Oficial al României, Partea a II-a.`
      : `${payload.name} — fișă în registrul comisiilor extras din Monitorul Oficial al României, Partea a II-a.`;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { title, description, type: "website", locale: "ro_RO", url: canonical },
  };
}

export default async function CommitteeProfilePage({ params, searchParams }: PageProps) {
  const { committee_id: rawId } = await params;
  const committeeId = decodeIdParam(rawId);
  const sp = await searchParams;
  const requestedYear = parseYearParam(firstParam(sp.year));
  const payload = await committeePage(committeeId, { year: requestedYear });
  if (!payload) notFound();
  const lifespan = activeLifespan(payload);
  const meetingsHeading = payload.selectedYear
    ? `Ședințe din ${payload.selectedYear}`
    : "Ședințe înregistrate";

  return (
    <article className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-10">
      <CommitteeJsonLd payload={payload} />

      <Dateline
        parts={[
          "Registrul comisiilor",
          committeeKindLabel(payload.kind),
          payload.jointWith && payload.jointWith.length > 0 ? "comună" : null,
          lifespan,
        ]}
      />

      <header className="mt-6 border-b border-border pb-8">
        <h1 className="font-display text-4xl leading-tight text-ink-16 sm:text-5xl">
          {payload.name}
        </h1>
        {payload.jointWith && payload.jointWith.length > 0 ? (
          <p className="mt-3 max-w-prose text-base leading-relaxed text-ink-30">
            Ședință comună cu: {payload.jointWith.join(", ")}
          </p>
        ) : null}
        <CommitteeMeta payload={payload} />
      </header>

      {payload.yearlyCounts.length > 0 && payload.selectedYear ? (
        <section className="mt-10" aria-labelledby="ani">
          <h2 id="ani" className="label-mono mb-4 text-ink-30">
            Ani
          </h2>
          <YearSparkbar
            yearlyCounts={payload.yearlyCounts}
            selectedYear={payload.selectedYear}
            hrefForYear={(year) =>
              `/comisii/${encodeURIComponent(payload.committeeId)}?year=${year}`
            }
            navAriaLabel="Selectează anul ședințelor"
            countNoun={{ one: "ședință", few: "ședințe", many: "de ședințe" }}
          />
        </section>
      ) : null}

      <section className="mt-12" aria-labelledby="sedinte">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="sedinte" className="label-mono text-ink-30">
            {meetingsHeading}
          </h2>
          {payload.meetingsInYear > 0 ? (
            <span className="font-mono-meta text-xs text-ink-45" data-tabular-nums="">
              {pluralRo(payload.meetingsInYear, "ședință", "ședințe", "de ședințe")}
            </span>
          ) : null}
        </div>
        {payload.meetings.length === 0 ? (
          <EmptyMeetings selectedYear={payload.selectedYear} />
        ) : (
          <MeetingsList meetings={payload.meetings} />
        )}
      </section>
    </article>
  );
}

function activeLifespan(payload: CommitteePagePayload): string | null {
  const from = payload.firstMeetingDate ? payload.firstMeetingDate.slice(0, 4) : null;
  const to = payload.lastMeetingDate ? payload.lastMeetingDate.slice(0, 4) : null;
  if (!from && !to) return null;
  if (!from || !to) return from ?? to;
  return from === to ? from : `${from}–${to}`;
}

function CommitteeMeta({ payload }: { payload: CommitteePagePayload }) {
  const items: Array<{ label: string; value: string | null }> = [
    {
      label: "Ședințe",
      value: payload.totalMeetings > 0 ? formatCount(payload.totalMeetings) : null,
    },
    { label: "Prima ședință", value: formatDate(payload.firstMeetingDate) },
    { label: "Ultima ședință", value: formatDate(payload.lastMeetingDate) },
    { label: "Identificator", value: payload.committeeId },
  ].filter((i) => i.value);
  if (items.length === 0) return null;
  return (
    <dl className="mt-6 grid grid-cols-1 gap-x-12 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="label-mono text-ink-45">{item.label}</dt>
          <dd className="font-mono-meta mt-1 text-sm text-ink-16" data-tabular-nums="">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function MeetingsList({ meetings }: { meetings: MoCommitteeMeeting[] }) {
  return (
    <ol className="divide-y divide-border border-y border-border">
      {meetings.map((m) => (
        <MeetingRow key={m.record_id} meeting={m} />
      ))}
    </ol>
  );
}

function MeetingRow({ meeting }: { meeting: MoCommitteeMeeting }) {
  const meetingDate = formatDate(meeting.meeting_date);
  const agendaCount = meeting.agenda_items?.length ?? 0;
  const rosterCount = meeting.roster?.length ?? 0;
  const presentCount =
    meeting.roster?.filter((r) => r.status?.toLowerCase() === "present").length ?? 0;
  // First non-empty agenda title is the most informative one-liner. Outcome
  // chips for the rest fold into a count footer.
  const firstAgendaTitle =
    meeting.agenda_items?.find((a) => a.title?.trim())?.title?.trim() ?? null;
  const meta = [
    meeting.format ? meeting.format : null,
    rosterCount > 0 ? `${formatCount(presentCount)}/${formatCount(rosterCount)} prezenți` : null,
    agendaCount > 0
      ? pluralRo(
          agendaCount,
          "punct pe ordinea de zi",
          "puncte pe ordinea de zi",
          "de puncte pe ordinea de zi",
        )
      : null,
  ].filter((m): m is string => Boolean(m));
  const outcomes = aggregateOutcomes(meeting);
  // Each meeting belongs to a parent MO document (`document_id` shape:
  // `mo://YYYY/PART/ISSUE`). The dedicated `/comisie/<id>/<date>` route from
  // the architecture doc isn't shipped yet; until it is, the parent issue is
  // the closest contextual landing — same convention as the speech rows on
  // `/politicieni/[slug]`. Inert when the document_id can't be parsed.
  const parsed = parseDocumentId(meeting.document_id);
  const docHref = parsed ? `/mo/${parsed.year}/${parsed.part}/${parsed.issue}` : null;
  const body = (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <time
          className="font-mono-meta text-sm text-ink-30"
          data-tabular-nums=""
          dateTime={meeting.meeting_date ?? undefined}
        >
          {meetingDate ?? "—"}
        </time>
        {meeting.purpose ? <span className="label-mono text-ink-45">{meeting.purpose}</span> : null}
      </div>
      {firstAgendaTitle ? (
        <p
          className={
            docHref
              ? "mt-2 text-base leading-snug text-ink-16 group-hover/row:underline underline-offset-4"
              : "mt-2 text-base leading-snug text-ink-16"
          }
        >
          {firstAgendaTitle}
        </p>
      ) : null}
      {meta.length > 0 ? (
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 label-mono text-ink-45">
          {meta.map((part, i) => (
            <span key={`${i}-${part}`}>{part}</span>
          ))}
        </p>
      ) : null}
      {outcomes.length > 0 ? (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono-meta text-xs text-ink-45">
          {outcomes.map((o) => (
            <span key={o.label} data-tabular-nums="">
              {o.label}: {formatCount(o.count)}
            </span>
          ))}
        </p>
      ) : null}
    </>
  );
  return (
    <li>
      {docHref ? (
        <Link
          href={docHref}
          className="group/row block px-1 py-5 transition-colors hover:bg-paper-96"
        >
          {body}
        </Link>
      ) : (
        <div className="px-1 py-5">{body}</div>
      )}
    </li>
  );
}

// `mo://YYYY/PART/ISSUE` → routable parts. Returns null on malformed input —
// upstream invariants keep this stable, so the inert-row fallback is mostly
// defensive against partial re-indexes mid-write.
function parseDocumentId(id: string): { year: string; part: string; issue: string } | null {
  const m = id.match(/^mo:\/\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { year: m[1], part: m[2], issue: m[3] };
}

function aggregateOutcomes(meeting: MoCommitteeMeeting): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of meeting.agenda_items ?? []) {
    const label = agendaOutcomeLabel(item.outcome);
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function EmptyMeetings({ selectedYear }: { selectedYear: number | null }) {
  const message = selectedYear
    ? `Nu există ședințe înregistrate pentru anul ${selectedYear}.`
    : "Nu există ședințe înregistrate pentru această comisie.";
  return (
    <div className="border border-border bg-paper-96 px-6 py-10">
      <p className="text-sm leading-relaxed text-ink-30">{message}</p>
    </div>
  );
}

function CommitteeJsonLd({ payload }: { payload: CommitteePagePayload }) {
  const url = `${env.NEXT_PUBLIC_SITE_URL}/comisii/${encodeURIComponent(payload.committeeId)}`;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "GovernmentOrganization",
    "@id": `${url}#committee`,
    name: payload.name,
    identifier: payload.committeeId,
    url,
    inLanguage: "ro",
  };
  const kindLabel = committeeKindLabel(payload.kind);
  if (kindLabel) {
    jsonLd.description = `Comisie parlamentară (${kindLabel.toLowerCase()}).`;
  }
  if (payload.firstMeetingDate) {
    jsonLd.foundingDate = payload.firstMeetingDate;
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
