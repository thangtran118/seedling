import { Suspense } from "react";
import Link from "next/link";
import { listRegionAreas } from "@/lib/access/areas";
import { requireUser } from "@/lib/access/current-user";
import { listSessionsBetween, type SessionListItem } from "@/lib/access/sessions";
import {
  addDays,
  dayKey,
  dayStart,
  formatDayLong,
  formatDuration,
  formatTime,
  SESSION_LIVE_MS,
  sessionPhase,
  WEEKDAY_SHORT,
  weekdayIndex,
} from "@/lib/domain";
import { AutoRefresh } from "@/app/ui/auto-refresh";
import { Empty, Fab, FabStack, HeaderAction, Loading, Section, TextLink } from "@/app/ui/kit";
import { resolveView, sessionInView, viewCounts, viewQuery, ViewTabs } from "@/app/ui/area-scope";
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

async function Home({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const now = new Date();
  const today = dayKey(now);
  const tomorrow = addDays(today, 1);
  // Include sessions that started late last night and are still inside their live window.
  const from = new Date(Math.min(dayStart(today).getTime(), now.getTime() - SESSION_LIVE_MS));
  const [todaysAll, aheadAll, areas] = await Promise.all([
    listSessionsBetween(user, from, dayStart(tomorrow)),
    listSessionsBetween(user, dayStart(tomorrow), dayStart(addDays(tomorrow, PLANNED_DAYS))),
    listRegionAreas(user),
  ]);
  // Default: the viewer's own area, cross-area sessions it is part of included.
  const scope = resolveView(user, areas, { xem: firstParam(sp.xem), kv: firstParam(sp.kv) }, "khu-vuc");
  const plannedAll = aheadAll.filter((s) => s.state === "planned");
  const todays = todaysAll.filter((s) => sessionInView(scope, s));
  const planned = plannedAll.filter((s) => sessionInView(scope, s));
  const live = todays.filter((s) => sessionPhase(s.state, s.startsAt, now) === "live");
  const next = todays.find((s) => sessionPhase(s.state, s.startsAt, now) === "upcoming");
  const counts = viewCounts(user, areas, scope, [...todaysAll, ...plannedAll], sessionInView);

  return (
    <>
      <AutoRefresh />
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm capitalize text-muted">{formatDayLong(today)}</p>
          <h1 className="truncate text-2xl font-bold tracking-tight text-ink">CPN {user.name}</h1>
        </div>
        {/* md+: the phone's floating buttons are hidden; same spot and style as on /lich. */}
        <div className="hidden shrink-0 gap-2 md:flex">
          <HeaderAction href="/nguoi-nghe/moi" variant="secondary">
            + Thêm chiên
          </HeaderAction>
          <HeaderAction href="/ca/hen">+ Đặt lịch trudo</HeaderAction>
        </div>
      </header>

      <figure className="border-l-2 border-accent pl-3">
        <blockquote className="text-sm italic text-ink">
          Nầy, ta đến mau chóng, và đem phần thưởng theo với ta, để trả cho mỗi người tùy theo công-việc họ làm.
        </blockquote>
        <figcaption className="mt-1 text-xs text-muted">Khải huyền 22:12</figcaption>
      </figure>

      <ViewTabs user={user} areas={areas} scope={scope} counts={counts} href={(n) => `/${viewQuery(scope, n)}`} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title={live.length ? `Hôm nay · ${live.length} đang diễn ra` : "Hôm nay"}>
          {todays.length > 0 ? (
            <div className="flex flex-col gap-2">
              {todays.map((s) => (
                <SessionCard key={s.id} s={s} now={now} showDate={false} />
              ))}
            </div>
          ) : (
            <Empty>
              {scope.view === "cua-toi"
                ? "Hôm nay bạn không có ca nào."
                : `Hôm nay ${scope.view === "khu-vuc" ? "khu vực" : "địa vực"} chưa có ca nào.`}
            </Empty>
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
            // -my-3.5: keep the 44px tap target without making this header taller than "Hôm nay"'s, so both
            // columns start on the same line on desktop.
            <Link href="/lich" className="-my-3.5 inline-flex min-h-11 items-center text-sm font-semibold text-accent">
              Mở lịch →
            </Link>
          }
        >
          {planned.length ? (
            <PlannedByDay sessions={planned} tomorrow={tomorrow} now={now} />
          ) : (
            <Empty action={<TextLink href="/ca/hen">+ Đặt lịch trudo</TextLink>}>
              {scope.view === "cua-toi"
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
            <SessionCard key={s.id} s={s} now={now} showDate={false} />
          ))}
        </section>
      ))}
    </div>
  );
}
