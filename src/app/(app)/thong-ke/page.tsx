import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/access/current-user";
import { ACTIVITY_DAYS, areaStats, TREND_WEEKS } from "@/lib/access/stats";
import { addDays, daysBetween, STALLED_AFTER_DAYS, STATUS_LABEL, type DisplayStatus } from "@/lib/domain";
import { BarList, ColumnChart } from "@/app/ui/charts";
import { Card, Empty, LessonDots, Loading, PageHeader, Section, StatTile, StatusBadge } from "@/app/ui/kit";

export const metadata: Metadata = { title: "Thống kê khu vực · Seedling" };

export default function StatsPage() {
  return (
    <>
      <PageHeader title="Thống kê khu vực" />
      <Suspense fallback={<Loading />}>
        <Stats />
      </Suspense>
    </>
  );
}

const STATUS_ORDER: DisplayStatus[] = ["moi_quen", "goi_mo", "dang_hoc", "baptem", "tu_choi"];
const ddmm = (key: string) => `${key.slice(8)}/${key.slice(5, 7)}`;

async function Stats() {
  const user = await requireUser();
  if (user.role !== "area_leader") notFound();
  const now = new Date();
  const st = await areaStats(user, now);
  const delta = st.doneThisWeek - st.doneLastWeek;
  const activeMembers = st.members.filter((m) => m.doneRecent > 0).length;
  const totalListeners = STATUS_ORDER.reduce((n, s) => n + st.statusCounts[s], 0);

  return (
    <>
      <p className="-mt-3 text-sm text-muted">
        Chỉ đếm ca đã đi. Số liệu dùng cho khu vực trưởng và nhóm trưởng; không chứa thông tin riêng tư.
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Ca đã đi tuần này"
          value={st.doneThisWeek}
          sub={delta === 0 ? "bằng tuần trước" : `${delta > 0 ? "+" : ""}${delta} so với tuần trước`}
        />
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
          sub={`${ACTIVITY_DAYS} ngày qua`}
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

      <Section title={`Hoạt động thánh đồ · ${ACTIVITY_DAYS} ngày qua`}>
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-sunken text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 sm:px-4 font-semibold">Thánh đồ</th>
                <th className="px-3 py-2 sm:px-4 text-right font-semibold">Ca đã đi</th>
                <th className="px-3 py-2 sm:px-4 text-right font-semibold">Đồng hành</th>
                <th className="px-3 py-2 sm:px-4 text-right font-semibold">Gần nhất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {st.members.map((m) => {
                const days = m.lastDoneAt ? daysBetween(new Date(m.lastDoneAt), now) : null;
                const quiet = days === null || days > STALLED_AFTER_DAYS;
                return (
                  <tr key={m.id}>
                    <td className="px-3 py-2 sm:px-4.5 font-medium text-ink">{m.name}</td>
                    <td className="px-3 py-2 sm:px-4.5 text-right tabular-nums text-ink">
                      <span className="inline-flex items-center justify-end gap-2">
                        <span
                          className="hidden h-1.5 rounded-full bg-done/70 sm:inline-block"
                          style={{ width: `${Math.min(m.doneRecent, 12) * 6}px` }}
                          aria-hidden
                        />
                        {m.doneRecent}
                      </span>
                    </td>
                    <td className="px-3 py-2 sm:px-4.5 text-right tabular-nums text-ink">{m.linkedListeners}</td>
                    <td className={`px-3 py-2 sm:px-4.5 text-right ${quiet ? "text-late" : "text-muted"}`}>
                      {days === null
                        ? "▲ chưa đi ca nào"
                        : days === 0
                          ? "hôm nay"
                          : `${quiet ? "▲ " : ""}${days} ngày trước`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
