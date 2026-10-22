import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/access/current-user";
import type { SessionUser } from "@/lib/access/auth";
import { listListeners } from "@/lib/access/listeners";
import { ACTIVITY_DAYS, areaStats, myStats, TREND_WEEKS, type MemberActivity } from "@/lib/access/stats";
import { addDays, daysBetween, STALLED_AFTER_DAYS, STATUS_LABEL, type DisplayStatus } from "@/lib/domain";
import { BarList, ColumnChart } from "@/app/ui/charts";
import { Card, Empty, LessonDots, Loading, PageHeader, Section, StatTile, StatusBadge, weekDelta } from "@/app/ui/kit";
import { PersonalStatsView } from "@/app/ui/personal-stats";

export const metadata: Metadata = { title: "Thống kê · Seedling" };

export default function StatsPage() {
  return (
    <>
      <PageHeader title="Thống kê" />
      <Suspense fallback={<Loading />}>
        <Stats />
      </Suspense>
    </>
  );
}

// Members see their own numbers; the area leader sees the area and each member.
async function Stats() {
  const user = await requireUser();
  const now = new Date();
  return user.role === "area_leader" ? <AreaStatsView user={user} now={now} /> : <MyStats user={user} now={now} />;
}

async function MyStats({ user, now }: { user: SessionUser; now: Date }) {
  const [st, listeners] = await Promise.all([myStats(user, now), listListeners(user)]);
  return (
    <PersonalStatsView
      st={st}
      listeners={listeners.filter((l) => l.linked)}
      now={now}
      emptyListeners="Bạn chưa đồng hành với chiên nào."
    />
  );
}

const STATUS_ORDER: DisplayStatus[] = ["moi_quen", "goi_mo", "dang_hoc", "baptem", "tu_choi"];
const ddmm = (key: string) => `${key.slice(8)}/${key.slice(5, 7)}`;

async function AreaStatsView({ user, now }: { user: SessionUser; now: Date }) {
  const [st, mine] = await Promise.all([areaStats(user, now), myStats(user, now)]);
  const activeMembers = st.members.filter((m) => m.doneThisWeek > 0).length;
  const totalListeners = STATUS_ORDER.reduce((n, s) => n + st.statusCounts[s], 0);

  return (
    <>
      <p className="-mt-3 text-sm text-muted">Chỉ đếm ca đã đi. Không chứa thông tin riêng tư.</p>

      <Section
        title={`Thành viên tuần này · ${activeMembers}/${st.members.length} có đi ca`}
        aside={
          <span className="text-xs text-muted">
            Của tôi: <b className="tabular-nums text-ink">{mine.doneThisWeek}</b> ca
          </span>
        }
      >
        <MemberWeekList members={st.members} now={now} />
      </Section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Ca đã đi tuần này" value={st.doneThisWeek} sub={weekDelta(st.doneThisWeek, st.doneLastWeek)} />
        <StatTile label="Ca đang hẹn" value={st.plannedAhead} sub="từ giờ trở đi" href="/lich" />
        <StatTile
          label="Chưa ghi kết quả"
          value={st.overdue}
          alert={st.overdue > 0}
          sub="ca đã qua giờ, chưa hoàn thành"
          href="/lich"
        />
        <StatTile label={`Mảnh đã chia sẻ`} value={st.lessonsRecent} sub={`${ACTIVITY_DAYS} ngày qua`} />
        <StatTile
          label="Chiên cần quan tâm"
          value={st.stalled.length}
          alert={st.stalled.length > 0}
          sub={`quá ${STALLED_AFTER_DAYS} ngày, trên ${st.openListeners} đang theo`}
          href="/chung-lai"
        />
        <StatTile
          label="Thánh đồ có đi ca"
          value={
            <>
              {activeMembers}
              <span className="text-lg font-semibold text-muted">/{st.members.length}</span>
            </>
          }
          sub="tuần này"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-4 p-4">
          <h2 className="text-sm font-semibold text-ink">Ca đã đi mỗi tuần · {TREND_WEEKS} tuần gần nhất</h2>
          <ColumnChart
            label={`Số ca đã đi mỗi tuần, ${TREND_WEEKS} tuần gần nhất`}
            highlightLast
            data={st.weekly.map((w, i) => ({
              key: w.weekStart,
              label: i === st.weekly.length - 1 ? "Tuần này" : ddmm(w.weekStart),
              value: w.done,
              tooltip: `${ddmm(w.weekStart)}–${ddmm(addDays(w.weekStart, 6))}: ${w.done} ca`,
            }))}
          />
        </Card>

        <Card className="flex flex-col gap-4 p-4">
          <h2 className="text-sm font-semibold text-ink">Chiên theo trạng thái · {totalListeners} người</h2>
          <BarList
            label="Số chiên theo trạng thái"
            rows={STATUS_ORDER.map((s) => ({
              key: s,
              label: STATUS_LABEL[s],
              value: st.statusCounts[s],
              muted: s === "tu_choi",
            }))}
          />
        </Card>

        <Card className="flex flex-col gap-4 p-4">
          <h2 className="text-sm font-semibold text-ink">Độ phủ từng mảnh · trên {st.openListeners} người đang theo</h2>
          <BarList
            label="Số chiên đang theo đã nghe từng mảnh"
            total={st.openListeners}
            rows={st.lessonReach.map((r) => ({ key: String(r.lesson), label: `Mảnh ${r.lesson}`, value: r.listeners }))}
          />
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-ink">Cần quan tâm nhất</h2>
            <Link href="/chung-lai" className="text-sm font-medium text-accent">
              Xem tất cả →
            </Link>
          </div>
          {st.stalled.length === 0 ? (
            <Empty>Không ai quá {STALLED_AFTER_DAYS} ngày chưa có ca.</Empty>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {st.stalled.slice(0, 5).map((l) => (
                <li key={l.id}>
                  <Link href={`/nguoi-nghe/${l.id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{l.name}</span>
                      <span className="text-xs text-late">
                        ▲ {l.daysSince === null ? "Chưa có ca nào" : `${l.daysSince} ngày chưa có ca`}
                      </span>
                    </span>
                    <span className="hidden sm:inline">
                      <LessonDots heard={l.lessons} />
                    </span>
                    <StatusBadge status={l.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

    </>
  );
}

// Members who went quiet: nothing this week and no done session for two weeks or more.
const QUIET_AFTER_DAYS = 14;

function MemberWeekList({ members, now }: { members: MemberActivity[]; now: Date }) {
  if (members.length === 0) return <Empty>Khu vực chưa có thành viên.</Empty>;
  const max = Math.max(1, ...members.map((m) => m.doneThisWeek));
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface md:grid md:grid-cols-2 md:divide-y-0">
      {members.map((m) => {
        const days = m.lastDoneAt ? daysBetween(new Date(m.lastDoneAt), now) : null;
        const quiet = m.doneThisWeek === 0 && (days === null || days >= QUIET_AFTER_DAYS);
        return (
          <li key={m.id} className="md:border-b md:border-line md:odd:border-r">
            <Link
              href={`/thong-ke/thanh-vien/${m.id}`}
              className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-sunken/60 active:bg-line/30"
            >
              <span className="w-9 shrink-0 text-center text-2xl font-bold tabular-nums text-ink">{m.doneThisWeek}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-semibold text-ink">{m.name}</span>
                <span className="h-1.5 rounded-full bg-sunken" aria-hidden>
                  <span
                    className="block h-full rounded-full bg-done"
                    style={{ width: `${(m.doneThisWeek / max) * 100}%` }}
                  />
                </span>
                <span className="truncate text-xs text-muted">
                  tuần trước {m.doneLastWeek} · {m.linkedListeners} chiên ·{" "}
                  <span className={quiet ? "text-late" : ""}>
                    {days === null
                      ? "▲ chưa đi ca nào"
                      : days === 0
                        ? "đi hôm nay"
                        : `${quiet ? "▲ " : ""}${days} ngày trước`}
                  </span>
                </span>
              </span>
              <span className="text-muted" aria-hidden>
                ›
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
