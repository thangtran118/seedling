import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/access/current-user";
import { homeOverview, listAreaSessionsBetween } from "@/lib/access/sessions";
import { areaStats } from "@/lib/access/stats";
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
} from "@/lib/domain";
import { AutoRefresh } from "@/app/ui/auto-refresh";
import { ButtonLink, Empty, Loading, PhaseLegend, Section, StatTile } from "@/app/ui/kit";
import { LogoutButton } from "@/app/ui/logout-button";
import { ThemeSwitcher } from "@/app/ui/theme";
import { LiveSessionCard, SessionCard } from "@/app/ui/session-card";

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
  // Include sessions that started late last night and are still inside their live window.
  const from = new Date(Math.min(dayStart(today).getTime(), now.getTime() - SESSION_LIVE_MS));
  const [{ upcoming, overdue }, todays] = await Promise.all([
    homeOverview(user),
    listAreaSessionsBetween(user, from, dayStart(addDays(today, 1))),
  ]);
  const live = todays.filter((s) => sessionPhase(s.state, s.startsAt, now) === "live");
  const next = todays.find((s) => sessionPhase(s.state, s.startsAt, now) === "upcoming");
  const isLeader = user.role === "area_leader";
  // Sessions still inside their live window show in the hero, not as "chưa ghi kết quả".
  const late = overdue.filter((s) => sessionPhase(s.state, s.startsAt, now) === "overdue");

  return (
    <>
      <AutoRefresh />
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm capitalize text-muted">{formatDayLong(today)}</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Chào {user.name}</h1>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-sm md:hidden">
          <ThemeSwitcher />
          <Link href="/doi-mat-khau" className="text-muted underline underline-offset-4">
            Đổi mật khẩu
          </Link>
          <LogoutButton className="text-muted underline underline-offset-4" />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <Section
            title={live.length ? `Đang diễn ra (${live.length})` : "Đang diễn ra"}
            aside={<span className="text-xs text-muted">tự cập nhật mỗi phút</span>}
          >
            {live.length ? (
              <div className={`grid gap-3 ${live.length > 1 ? "md:grid-cols-2" : ""}`}>
                {live.map((s) => (
                  <LiveSessionCard key={s.id} s={s} now={now} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-sm text-muted">
                Chưa có ca nào đang diễn ra.
                {next && (
                  <>
                    {" "}
                    Ca kế tiếp lúc <b className="text-ink">{formatTime(next.startsAt)}</b>, còn{" "}
                    {formatDuration(new Date(next.startsAt).getTime() - now.getTime())}.
                  </>
                )}
              </div>
            )}
          </Section>

          {/* Phones: recording stays one thumb away, right under what is happening now. */}
          <div className="lg:hidden">
            <QuickActions />
          </div>

          <Section
            title="Hôm nay trong khu vực"
            aside={
              <Link href="/lich" className="text-sm font-medium text-accent">
                Mở lịch →
              </Link>
            }
          >
            {todays.length ? (
              <>
                <PhaseLegend phases={["live", "upcoming", "overdue", "done", "cancelled"]} />
                <div className="flex flex-col gap-2">
                  {todays.map((s) => (
                    <SessionCard key={s.id} s={s} now={now} showDate={false} />
                  ))}
                </div>
              </>
            ) : (
              <Empty>Hôm nay khu vực chưa có ca nào.</Empty>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <div className="hidden lg:block">
            <QuickActions />
          </div>

          {isLeader && (
            <Suspense fallback={null}>
              <LeaderGlance user={user} now={now} />
            </Suspense>
          )}

          {late.length > 0 && (
            <Section title="Ca của bạn chưa ghi kết quả">
              {late.map((s) => (
                <SessionCard key={s.id} s={s} now={now} note="Bấm để ghi kết quả" />
              ))}
            </Section>
          )}

          <Section title="Ca sắp tới của bạn">
            {upcoming.length ? (
              upcoming.map((s) => <SessionCard key={s.id} s={s} now={now} />)
            ) : (
              <Empty>Chưa có ca nào. Xem lịch khu vực để tham gia.</Empty>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <ButtonLink href="/ca/ghi">Ghi ca vừa xong</ButtonLink>
      <ButtonLink href="/ca/hen" variant="secondary">
        Hẹn ca
      </ButtonLink>
    </div>
  );
}

async function LeaderGlance({ user, now }: { user: SessionUser; now: Date }) {
  const st = await areaStats(user, now);
  const delta = st.doneThisWeek - st.doneLastWeek;
  return (
    <Section
      title="Khu vực tuần này"
      aside={
        <Link href="/thong-ke" className="text-sm font-medium text-accent">
          Thống kê →
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Ca đã đi"
          value={st.doneThisWeek}
          sub={delta === 0 ? "bằng tuần trước" : `${delta > 0 ? "+" : ""}${delta} so với tuần trước`}
        />
        <StatTile label="Ca đang hẹn" value={st.plannedAhead} sub="từ giờ trở đi" href="/lich" />
        <StatTile label="Chưa ghi kết quả" value={st.overdue} alert={st.overdue > 0} sub="ca đã qua giờ" />
        <StatTile
          label="Cần quan tâm"
          value={st.stalled.length}
          alert={st.stalled.length > 0}
          sub={`trên ${st.openListeners} chiên`}
          href="/chung-lai"
        />
      </div>
    </Section>
  );
}
