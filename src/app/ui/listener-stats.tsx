import Link from "next/link";
import type { MemberMonthRow, MonthStats, Overview, PersonalStats } from "@/lib/access/stats";
import { WEEKLY_SESSION_GOAL } from "@/lib/domain";
import { Empty, StatTile } from "./kit";

// Share of the month's listeners; null when there are none.
export const rate = (n: number, total: number) => (total ? Math.round((n / total) * 100) : null);
export const pct = (r: number | null) => (r === null ? "—" : `${r}%`);

// Home page: the four listener numbers for one month (total, new, heard the truth, báptem).
export function StatsTiles({ m, size = "md" }: { m: MonthStats; size?: "sm" | "md" }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
      <StatTile size={size} label="Tổng số chiên" value={m.total} />
      <StatTile size={size} label="Chiên mới tháng này" value={m.added} />
      <StatTile
        size={size}
        label="Tỉ lệ nghe lẽ thật"
        value={pct(rate(m.heard, m.total))}
        sub={`${m.heard}/${m.total} chiên`}
      />
      <StatTile
        size={size}
        label="Tỉ lệ báptem"
        value={pct(rate(m.baptized, m.total))}
        sub={`${m.baptized}/${m.total} chiên`}
      />
    </div>
  );
}

// Stats page: this week's sessions, then the listeners (new this month, shared the truth, báptem rate). The streak
// tile shows only for one person.
export function OverviewTiles({ st }: { st: Overview | PersonalStats }) {
  const streak = "streakWeeks" in st;
  return (
    <div className={`grid grid-cols-2 gap-2 md:gap-3 ${streak ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
      <StatTile label="Buổi trudo tuần này" value={st.sessionsThisWeek} />
      {streak && (
        <StatTile
          label={`Tuần liên tiếp đạt ${WEEKLY_SESSION_GOAL}+ buổi`}
          value={st.streakWeeks}
          sub={st.streakWeeks ? "tuần" : `tuần này còn ${Math.max(0, WEEKLY_SESSION_GOAL - st.sessionsThisWeek)} buổi`}
        />
      )}
      <StatTile label="Chiên mới tháng này" value={st.newThisMonth} sub="có thông tin liên lạc" />
      <StatTile label="Đã chia sẻ lẽ thật" value={st.sharedTruth} sub={`đã vào mảnh, trên ${st.total} chiên`} />
      <StatTile
        label="Tỉ lệ báptem"
        value={pct(rate(st.baptized, st.total))}
        sub={`${st.baptized}/${st.total} chiên`}
      />
    </div>
  );
}

// Everyone in the area this month, ranked by báptem, then sessions, then new listeners. Rows link to the member's
// page for the area leader only.
export function MemberMonthTable({
  rows,
  viewerId,
  linkRows,
}: {
  rows: MemberMonthRow[];
  viewerId: string;
  linkRows: boolean;
}) {
  if (rows.length === 0) return <Empty>Khu vực chưa có thành viên.</Empty>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-sunken text-left text-xs text-muted">
          <tr>
            <th className="w-8 px-3 py-2 text-right font-semibold">#</th>
            <th className="px-3 py-2 font-semibold">Thánh đồ</th>
            <th className="px-3 py-2 text-right font-semibold">Báptem</th>
            <th className="px-3 py-2 text-right font-semibold">Buổi trudo</th>
            <th className="px-3 py-2 text-right font-semibold">Chiên mới</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line tabular-nums">
          {rows.map((r, i) => {
            const name = `${r.name}${r.id === viewerId ? " (bạn)" : ""}`;
            return (
              <tr key={r.id} className={r.id === viewerId ? "bg-accent/5" : ""}>
                <td className="px-3 py-2 text-right text-muted">{i + 1}</td>
                <td className="max-w-40 truncate px-3 py-2 font-medium text-ink">
                  {linkRows ? (
                    <Link href={`/thong-ke/thanh-vien/${r.id}`} className="hover:underline">
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-ink">{r.baptized}</td>
                <td className="px-3 py-2 text-right text-ink">{r.sessions}</td>
                <td className="px-3 py-2 text-right text-ink">{r.newListeners}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
