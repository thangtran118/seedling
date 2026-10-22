import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/access/current-user";
import { listListeners, type ListenerSummary } from "@/lib/access/listeners";
import { homeOverview, listAreaSessionsBetween, type SessionListItem } from "@/lib/access/sessions";
import { areaStats, myStats } from "@/lib/access/stats";
import type { SessionUser } from "@/lib/access/auth";
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
import { AccountMenu } from "@/app/ui/account-menu";
import { AutoRefresh } from "@/app/ui/auto-refresh";
import { ButtonLink, Empty, Fab, Loading, Section, StatTile, weekDelta } from "@/app/ui/kit";
import { ListenerRows } from "@/app/ui/listener-card";
import { LiveSessionCard, SessionCard } from "@/app/ui/session-card";

// Phone first: one column in order of what people open the app for — my week, what is happening today,
// what is planned next, and where each of my chiên stands. Wide screens split it in two columns.
const PLANNED_DAYS = 7;
const MY_LISTENERS_SHOWN = 8;

export default function HomePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const user = await requireUser();
  const now = new Date();
  const today = dayKey(now);
  const tomorrow = addDays(today, 1);
  // Include sessions that started late last night and are still inside their live window.
  const from = new Date(Math.min(dayStart(today).getTime(), now.getTime() - SESSION_LIVE_MS));
  const [{ overdue }, todays, ahead, mine, listeners] = await Promise.all([
    homeOverview(user),
    listAreaSessionsBetween(user, from, dayStart(tomorrow)),
    listAreaSessionsBetween(user, dayStart(tomorrow), dayStart(addDays(tomorrow, PLANNED_DAYS))),
    myStats(user, now),
    listListeners(user),
  ]);
  const isLeader = user.role === "area_leader";
  const live = todays.filter((s) => sessionPhase(s.state, s.startsAt, now) === "live");
  const rest = todays.filter((s) => sessionPhase(s.state, s.startsAt, now) !== "live");
  const next = todays.find((s) => sessionPhase(s.state, s.startsAt, now) === "upcoming");
  // Sessions still inside their live window show under "Hôm nay", not as "chưa ghi kết quả".
  const late = overdue.filter((s) => sessionPhase(s.state, s.startsAt, now) === "overdue");
  const planned = ahead.filter((s) => s.state === "planned");
  const myListeners = sortForAttention(listeners.filter((l) => l.linked));

  return (
    <>
      <AutoRefresh />
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm capitalize text-muted">{formatDayLong(today)}</p>
          <h1 className="truncate text-2xl font-bold tracking-tight text-ink">Chào {user.name}</h1>
        </div>
        <AccountMenu name={user.name} role={isLeader ? "Khu vực trưởng" : "Thánh đồ"} />
      </header>

      <Section
        title="Tuần này của tôi"
        aside={
          <Link href="/thong-ke" className="text-sm font-medium text-accent">
            Thống kê →
          </Link>
        }
      >
        <div className="grid grid-cols-3 gap-2 md:max-w-2xl md:gap-3">
          <StatTile
            size="sm"
            label="Ca đã đi"
            value={mine.doneThisWeek}
            sub={weekDelta(mine.doneThisWeek, mine.doneLastWeek)}
            href="/thong-ke"
          />
          <StatTile size="sm" label="Mảnh đã chia sẻ" value={mine.lessonsThisWeek} sub="trong tuần" href="/thong-ke" />
          <StatTile size="sm" label="Ca đã hẹn" value={mine.plannedAhead} sub="từ giờ trở đi" href="/lich" />
        </div>
        {isLeader && (
          <Suspense fallback={null}>
            <AreaLine user={user} now={now} />
          </Suspense>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-6">
          <Section
            title={live.length ? `Hôm nay · ${live.length} đang diễn ra` : "Hôm nay"}
            aside={<span className="text-xs text-muted">tự cập nhật mỗi phút</span>}
          >
            {live.length > 0 && (
              <div className={`grid gap-3 ${live.length > 1 ? "md:grid-cols-2" : ""}`}>
                {live.map((s) => (
                  <LiveSessionCard key={s.id} s={s} now={now} />
                ))}
              </div>
            )}
            {rest.length > 0 && (
              <div className="flex flex-col gap-2">
                {rest.map((s) => (
                  <SessionCard key={s.id} s={s} now={now} showDate={false} />
                ))}
              </div>
            )}
            {todays.length === 0 ? (
              <Empty>Hôm nay khu vực chưa có ca nào.</Empty>
            ) : (
              live.length === 0 &&
              next && (
                <p className="text-sm text-muted">
                  Ca kế tiếp lúc <b className="text-ink">{formatTime(next.startsAt)}</b>, còn{" "}
                  {formatDuration(new Date(next.startsAt).getTime() - now.getTime())}.
                </p>
              )
            )}
          </Section>

          {late.length > 0 && (
            <Section title={`Cần ghi kết quả (${late.length})`}>
              <div className="flex flex-col gap-2">
                {late.map((s) => (
                  <SessionCard key={s.id} s={s} now={now} note="Bấm để ghi kết quả" />
                ))}
              </div>
            </Section>
          )}

          <Section
            title={`Đã hẹn · ${PLANNED_DAYS} ngày tới`}
            aside={
              <span className="flex gap-4 text-sm font-medium text-accent">
                <Link href="/ca/hen">Hẹn ca +</Link>
                <Link href="/lich">Mở lịch →</Link>
              </span>
            }
          >
            {planned.length ? (
              <PlannedByDay sessions={planned} tomorrow={tomorrow} now={now} />
            ) : (
              <Empty>Chưa có ca nào được hẹn trong {PLANNED_DAYS} ngày tới.</Empty>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <div className="hidden grid-cols-2 gap-3 md:grid">
            <ButtonLink href="/ca/ghi">Ghi ca vừa xong</ButtonLink>
            <ButtonLink href="/ca/hen" variant="secondary">
              Hẹn ca
            </ButtonLink>
          </div>

          <Section
            title={myListeners.length ? `Chiên của tôi (${myListeners.length})` : "Chiên của tôi"}
            aside={
              <Link href="/nguoi-nghe" className="text-sm font-medium text-accent">
                Xem tất cả →
              </Link>
            }
          >
            {myListeners.length ? (
              <ListenerRows items={myListeners.slice(0, MY_LISTENERS_SHOWN)} now={now} />
            ) : (
              <Empty>Bạn chưa đồng hành với chiên nào.</Empty>
            )}
          </Section>
        </div>
      </div>

      <Fab href="/ca/ghi">Ghi ca</Fab>
    </>
  );
}

// Open listeners first, longest without a session on top; báptem / từ chối last.
function sortForAttention(ls: ListenerSummary[]) {
  const closed = (l: ListenerSummary) => l.status === "baptem" || l.status === "tu_choi";
  const last = (l: ListenerSummary) => (l.lastDoneAt ? new Date(l.lastDoneAt).getTime() : 0);
  return [...ls].sort((a, b) => Number(closed(a)) - Number(closed(b)) || last(a) - last(b));
}

function PlannedByDay({ sessions, tomorrow, now }: { sessions: SessionListItem[]; tomorrow: string; now: Date }) {
  const days = new Map<string, SessionListItem[]>();
  for (const s of sessions) {
    const k = dayKey(s.startsAt);
    days.set(k, [...(days.get(k) ?? []), s]);
  }
  return (
    <div className="flex flex-col gap-3">
      {[...days].map(([k, list]) => (
        <div key={k} className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-ink">
            {k === tomorrow ? "Ngày mai" : WEEKDAY_SHORT[weekdayIndex(k)]}
            <span className="font-normal text-muted">
              {" "}
              · {k.slice(8)}/{k.slice(5, 7)}
            </span>
          </h3>
          {list.map((s) => (
            <SessionCard key={s.id} s={s} now={now} showDate={false} compact />
          ))}
        </div>
      ))}
    </div>
  );
}

// Leader: one line of area numbers under their own week; the full dashboard is on /thong-ke.
async function AreaLine({ user, now }: { user: SessionUser; now: Date }) {
  const st = await areaStats(user, now);
  const active = st.members.filter((m) => m.doneThisWeek > 0).length;
  return (
    <Link
      href="/thong-ke"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-sm text-muted transition-colors hover:border-muted/50 md:max-w-2xl"
    >
      <span className="font-semibold text-ink">Khu vực</span>
      <span>
        <b className="tabular-nums text-ink">{st.doneThisWeek}</b> ca tuần này
      </span>
      <span>
        <b className="tabular-nums text-ink">{active}</b>/{st.members.length} người có đi
      </span>
      {st.overdue > 0 && (
        <span className="text-late">
          ▲ <b className="tabular-nums">{st.overdue}</b> chưa ghi KQ
        </span>
      )}
      {st.stalled.length > 0 && (
        <span className="text-late">
          ▲ <b className="tabular-nums">{st.stalled.length}</b> chiên cần quan tâm
        </span>
      )}
    </Link>
  );
}
