import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/access/current-user";
import { listAreaSessionsBetween, listAreaUpcoming, type SessionListItem } from "@/lib/access/sessions";
import {
  addDays,
  addMonths,
  dayKey,
  dayStart,
  formatDayLong,
  formatMonth,
  formatTime,
  isOpenPhase,
  monthGrid,
  parseDayKey,
  parseMonthKey,
  sessionPhase,
  WEEKDAY_SHORT,
  type SessionPhase,
} from "@/lib/domain";
import { AutoRefresh } from "@/app/ui/auto-refresh";
import {
  ButtonLink,
  Empty,
  Fab,
  FabStack,
  HeaderAction,
  Loading,
  PageHeader,
  PhaseLegend,
  PhaseMark,
  Section,
} from "@/app/ui/kit";
import { firstParam } from "@/app/ui/load";
import { SessionCard } from "@/app/ui/session-card";

export const metadata: Metadata = { title: "Lịch khu vực · Seedling" };

export default function CalendarPage(props: PageProps<"/lich">) {
  return (
    <>
      <PageHeader
        title="Lịch khu vực"
        actionDesktopOnly
        action={<HeaderAction href="/ca/hen">+ Đặt lịch trudo</HeaderAction>}
      />
      <Suspense fallback={<Loading />}>
        <Calendar searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

const href = (month: string, day: string) => `/lich?thang=${month}&ngay=${day}`;

function joinNote(s: SessionListItem, phase: SessionPhase) {
  if (!isOpenPhase(phase)) return undefined;
  return s.isMember ? "Bạn đã tham gia" : undefined; // the card carries the "Tham gia" button otherwise
}

async function Calendar({ searchParams }: { searchParams: PageProps<"/lich">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const now = new Date();
  const today = dayKey(now);
  const askedMonth = parseMonthKey(firstParam(sp.thang));
  const askedDay = parseDayKey(firstParam(sp.ngay));
  const month = askedMonth ?? askedDay?.slice(0, 7) ?? today.slice(0, 7);
  const selected = askedDay && askedDay.startsWith(month) ? askedDay : today.startsWith(month) ? today : `${month}-01`;

  const weeks = monthGrid(month);
  const first = weeks[0][0];
  const last = weeks[weeks.length - 1][6];
  const [sessions, upcoming] = await Promise.all([
    listAreaSessionsBetween(user, dayStart(first), dayStart(addDays(last, 1))),
    listAreaUpcoming(user),
  ]);

  const byDay = new Map<string, SessionListItem[]>();
  for (const s of sessions) {
    const k = dayKey(s.startsAt);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  const inMonth = sessions.filter((s) => dayKey(s.startsAt).startsWith(month));
  const count = (p: SessionPhase) => inMonth.filter((s) => sessionPhase(s.state, s.startsAt, now) === p).length;
  const agenda = byDay.get(selected) ?? [];
  // Booking from the calendar starts on the day being looked at (a past day falls back to the usual default).
  const planHref = selected >= today ? `/ca/hen?ngay=${selected}` : "/ca/hen";
  const planLabel = selected > today ? `Đặt lịch ${selected.slice(8)}/${selected.slice(5, 7)}` : "Đặt lịch trudo";
  const next = upcoming.filter((s) => sessionPhase(s.state, s.startsAt, now) === "upcoming").slice(0, 6);

  return (
    <>
      <AutoRefresh />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Link
              href={href(addMonths(month, -1), `${addMonths(month, -1)}-01`)}
              aria-label="Tháng trước"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink"
            >
              <Chevron dir="left" />
            </Link>
            <h2 className="min-w-36 text-center text-lg font-bold text-ink">{formatMonth(month)}</h2>
            <Link
              href={href(addMonths(month, 1), `${addMonths(month, 1)}-01`)}
              aria-label="Tháng sau"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink"
            >
              <Chevron dir="right" />
            </Link>
            {!(month === today.slice(0, 7) && selected === today) && (
              <Link
                href={href(today.slice(0, 7), today)}
                className="ml-auto inline-flex h-9 items-center rounded-full border border-line px-3 text-sm text-ink hover:bg-sunken"
              >
                Hôm nay
              </Link>
            )}
          </div>

          <p className="text-sm text-muted">
            <b className="text-ink">{inMonth.length}</b> ca trong tháng · {count("done")} hoàn thành ·{" "}
            {count("upcoming")} chưa bắt đầu
            {count("live") > 0 && <> · {count("live")} đang diễn ra</>}
            {count("cancelled") > 0 && <> · {count("cancelled")} đã hủy</>}
          </p>

          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="grid grid-cols-7 border-b border-line bg-sunken text-center text-xs font-semibold text-muted">
              {WEEKDAY_SHORT.map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            {weeks.map((week) => (
              <div key={week[0]} className="grid grid-cols-7 border-b border-line last:border-b-0">
                {week.map((k) => (
                  <DayCell
                    key={k}
                    day={k}
                    month={month}
                    sessions={byDay.get(k) ?? []}
                    isToday={k === today}
                    isSelected={k === selected}
                    now={now}
                  />
                ))}
              </div>
            ))}
          </div>
          <PhaseLegend phases={["upcoming", "live", "done", "cancelled"]} />
        </section>

        <div className="flex flex-col gap-6">
          <Section title={formatDayLong(selected)}>
            {agenda.length ? (
              agenda.map((s) => {
                const phase = sessionPhase(s.state, s.startsAt, now);
                return <SessionCard key={s.id} s={s} now={now} showDate={false} note={joinNote(s, phase)} />;
              })
            ) : (
              <Empty>Không có ca nào trong ngày này.</Empty>
            )}
            {/* Phones book this day from the floating button. */}
            {selected >= today && agenda.length === 0 && (
              <div className="hidden md:block">
                <ButtonLink href={planHref} variant="secondary">
                  {planLabel}
                </ButtonLink>
              </div>
            )}
          </Section>

          <Section title="Sắp tới trong khu vực">
            {next.length ? (
              next.map((s) => <SessionCard key={s.id} s={s} now={now} note={joinNote(s, "upcoming")} />)
            ) : (
              <Empty>Chưa có ca nào được hẹn.</Empty>
            )}
          </Section>
        </div>
      </div>
      <FabStack>
        <Fab href={planHref}>{planLabel}</Fab>
      </FabStack>
    </>
  );
}

function DayCell({
  day,
  month,
  sessions,
  isToday,
  isSelected,
  now,
}: {
  day: string;
  month: string;
  sessions: SessionListItem[];
  isToday: boolean;
  isSelected: boolean;
  now: Date;
}) {
  const outside = !day.startsWith(month);
  const phases = sessions.map((s) => sessionPhase(s.state, s.startsAt, now));
  const hasLive = phases.includes("live");
  return (
    <Link
      href={href(month, day)}
      scroll={false}
      aria-label={`${day.slice(8)}/${day.slice(5, 7)}: ${sessions.length} ca${hasLive ? ", có ca đang diễn ra" : ""}`}
      aria-current={isSelected ? "date" : undefined}
      className={`flex min-h-16 flex-col gap-1 border-r border-line p-1.5 last:border-r-0 md:min-h-28 md:p-2 ${
        isSelected ? "bg-accent/10" : "hover:bg-sunken"
      } ${outside ? "opacity-45" : ""} ${hasLive ? "ring-2 ring-inset ring-live/60" : ""}`}
    >
      <span
        className={`inline-flex h-6 w-6 items-center justify-center self-center rounded-full text-sm tabular-nums md:self-start ${
          isToday ? "bg-accent font-bold text-on-accent" : isSelected ? "font-bold text-accent" : "text-ink"
        }`}
      >
        {Number(day.slice(8))}
      </span>

      {/* Phones: one mark per session. */}
      {sessions.length > 0 && (
        <span className="flex flex-wrap items-center justify-center gap-1 md:hidden">
          {phases.slice(0, 4).map((p, i) => (
            <PhaseMark key={i} phase={p} />
          ))}
          {sessions.length > 4 && <span className="text-[10px] leading-none text-muted">+{sessions.length - 4}</span>}
        </span>
      )}

      {/* Wider screens: time and listener of the first sessions. */}
      <span className="hidden flex-col gap-0.5 md:flex">
        {sessions.slice(0, 3).map((s, i) => (
          <span
            key={s.id}
            className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] leading-tight ${
              phases[i] === "live" ? "bg-live/10 font-semibold text-ink" : "text-ink"
            } ${phases[i] === "cancelled" ? "text-muted line-through" : ""}`}
          >
            <PhaseMark phase={phases[i]} />
            <span className="tabular-nums text-muted">{formatTime(s.startsAt)}</span>
            <span className="truncate">{s.listeners[0]?.name}</span>
          </span>
        ))}
        {sessions.length > 3 && <span className="px-1 text-[11px] text-muted">+{sessions.length - 3} ca nữa</span>}
      </span>
    </Link>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d={dir === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
