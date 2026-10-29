import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/access/current-user";
import { listAreaSessionsBetween, type SessionListItem } from "@/lib/access/sessions";
import {
  addDays,
  dayKey,
  dayStart,
  formatDayLong,
  formatDuration,
  formatTime,
  isOpenPhase,
  SESSION_LIVE_MS,
  sessionPhase,
  WEEKDAY_SHORT,
  weekdayIndex,
} from "@/lib/domain";
import { AccountMenu } from "@/app/ui/account-menu";
import { AutoRefresh } from "@/app/ui/auto-refresh";
import { Empty, Fab, FabStack, HeaderAction, Loading, Section, TextLink } from "@/app/ui/kit";
import { firstParam } from "@/app/ui/load";
import { SessionCard } from "@/app/ui/session-card";

// Sessions only, phone first: what is happening now, the rest of today, then the coming days. Numbers live on
// /thong-ke and listeners on /nguoi-nghe, so the first screen on a phone is the next session to go to.
const PLANNED_DAYS = 7;

export default function HomePage(props: PageProps<"/">) {
  return (
    <Suspense fallback={<Loading />}>
      <Home searchParams={props.searchParams} />
    </Suspense>
  );
}

// "Bấm để tham gia" under a session the viewer can still join; nothing once they are in it.
function joinNote(s: SessionListItem, now: Date) {
  if (!isOpenPhase(sessionPhase(s.state, s.startsAt, now))) return undefined;
  return !s.isMember && s.canJoin ? "Bấm để tham gia" : undefined;
}

async function Home({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const user = await requireUser();
  const onlyMine = firstParam((await searchParams)["cua-toi"]) === "1";
  const now = new Date();
  const today = dayKey(now);
  const tomorrow = addDays(today, 1);
  // Include sessions that started late last night and are still inside their live window.
  const from = new Date(Math.min(dayStart(today).getTime(), now.getTime() - SESSION_LIVE_MS));
  const [todaysAll, aheadAll] = await Promise.all([
    listAreaSessionsBetween(user, from, dayStart(tomorrow)),
    listAreaSessionsBetween(user, dayStart(tomorrow), dayStart(addDays(tomorrow, PLANNED_DAYS))),
  ]);
  const plannedAll = aheadAll.filter((s) => s.state === "planned");
  const mine = (s: SessionListItem) => s.isMember;
  const todays = onlyMine ? todaysAll.filter(mine) : todaysAll;
  const planned = onlyMine ? plannedAll.filter(mine) : plannedAll;
  const live = todays.filter((s) => sessionPhase(s.state, s.startsAt, now) === "live");
  const next = todays.find((s) => sessionPhase(s.state, s.startsAt, now) === "upcoming");
  const mineCount = todaysAll.filter(mine).length + plannedAll.filter(mine).length;
  const allCount = todaysAll.length + plannedAll.length;
  const isLeader = user.role === "area_leader";

  return (
    <>
      <AutoRefresh />
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm capitalize text-muted">{formatDayLong(today)}</p>
          <h1 className="truncate text-2xl font-bold tracking-tight text-ink">Chào {user.name}</h1>
        </div>
        <AccountMenu name={user.name} role={isLeader ? "Khu vực trưởng" : "Thánh đồ"} />
        {/* md+: the phone's floating buttons and account menu are hidden; same spot and style as on /lich. */}
        <div className="hidden shrink-0 gap-2 md:flex">
          <HeaderAction href="/nguoi-nghe/moi" variant="secondary">
            + Thêm chiên
          </HeaderAction>
          <HeaderAction href="/ca/hen">+ Đặt lịch trudo</HeaderAction>
        </div>
      </header>

      <nav aria-label="Lọc ca" className="flex gap-2">
        <FilterChip href="/" on={!onlyMine} label="Cả khu vực" count={allCount} />
        <FilterChip href="/?cua-toi=1" on={onlyMine} label="Ca của tôi" count={mineCount} />
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title={live.length ? `Hôm nay · ${live.length} đang diễn ra` : "Hôm nay"}>
          {todays.length > 0 ? (
            <div className="flex flex-col gap-2">
              {todays.map((s) => (
                <SessionCard key={s.id} s={s} now={now} showDate={false} note={joinNote(s, now)} />
              ))}
            </div>
          ) : (
            <Empty>{onlyMine ? "Hôm nay bạn không có ca nào." : "Hôm nay khu vực chưa có ca nào."}</Empty>
          )}
          {live.length === 0 && next && (
            <p className="text-sm text-muted">
              Ca kế tiếp lúc <b className="text-ink">{formatTime(next.startsAt)}</b>, còn{" "}
              {formatDuration(new Date(next.startsAt).getTime() - now.getTime())}.
            </p>
          )}
        </Section>

        <Section
          title={`Sắp tới · ${PLANNED_DAYS} ngày`}
          aside={
            <Link href="/lich" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent">
              Mở lịch →
            </Link>
          }
        >
          {planned.length ? (
            <PlannedByDay sessions={planned} tomorrow={tomorrow} now={now} />
          ) : (
            <Empty action={<TextLink href="/ca/hen">+ Đặt lịch trudo</TextLink>}>
              {onlyMine
                ? `Bạn chưa có ca nào trong ${PLANNED_DAYS} ngày tới.`
                : `Chưa có ca nào được hẹn trong ${PLANNED_DAYS} ngày tới.`}
            </Empty>
          )}
        </Section>
      </div>

      <FabStack>
        <Fab href="/ca/hen">Đặt lịch trudo</Fab>
        <Fab href="/nguoi-nghe/moi" secondary>
          Thêm chiên
        </Fab>
      </FabStack>
    </>
  );
}

function FilterChip({ href, on, label, count }: { href: string; on: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={on ? "true" : undefined}
      className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm transition-colors ${
        on ? "bg-accent font-semibold text-on-accent" : "border border-line bg-surface text-ink hover:bg-sunken"
      }`}
    >
      {label}
      <span className={`tabular-nums ${on ? "opacity-80" : "text-muted"}`}>{count}</span>
    </Link>
  );
}

// Day headings stick under the thumb while scrolling a long week on a phone.
function PlannedByDay({ sessions, tomorrow, now }: { sessions: SessionListItem[]; tomorrow: string; now: Date }) {
  const days = new Map<string, SessionListItem[]>();
  for (const s of sessions) {
    const k = dayKey(s.startsAt);
    days.set(k, [...(days.get(k) ?? []), s]);
  }
  return (
    <div className="flex flex-col gap-3">
      {[...days].map(([k, list]) => (
        <section key={k} className="flex flex-col gap-1.5">
          <h3 className="sticky top-0 z-[5] -mx-4 bg-bg/95 px-4 py-1.5 text-sm font-semibold text-ink backdrop-blur md:mx-0 md:px-0">
            {k === tomorrow ? "Ngày mai" : WEEKDAY_SHORT[weekdayIndex(k)]}
            <span className="font-normal text-muted">
              {" "}
              · {k.slice(8)}/{k.slice(5, 7)} · {list.length} ca
            </span>
          </h3>
          {list.map((s) => (
            <SessionCard key={s.id} s={s} now={now} showDate={false} compact note={joinNote(s, now)} />
          ))}
        </section>
      ))}
    </div>
  );
}
