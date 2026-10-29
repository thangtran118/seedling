import Link from "next/link";
import type { MemberMonthRow, Overview, PersonalStats } from "@/lib/access/stats";
import { WEEKLY_SESSION_GOAL } from "@/lib/domain";
import { Empty, StatTile } from "./kit";

// Share of the month's listeners; null when there are none.
export const rate = (n: number, total: number) => (total ? Math.round((n / total) * 100) : null);
export const pct = (r: number | null) => (r === null ? "—" : `${r}%`);

// Stats page: this week's sessions, then the listeners (new this month, shared the truth, báptem rate). The streak
// tile shows only for one person.
export function OverviewTiles({ st }: { st: Overview | PersonalStats }) {
  const streak = "streakWeeks" in st;
  return (
    // An odd last tile spans the row on phones instead of sitting alone in half of it.
    <div
      className={`grid grid-cols-2 gap-2 md:gap-3 [&>*:last-child:nth-child(odd)]:col-span-2 md:[&>*:last-child:nth-child(odd)]:col-span-1 ${streak ? "md:grid-cols-5" : "md:grid-cols-4"}`}
    >
      <StatTile label="Buổi trudo tuần này" value={st.sessionsThisWeek} />
      {streak && (
        <StatTile
          label={`Tuần liên tiếp đạt ${WEEKLY_SESSION_GOAL}+ buổi`}
          value={st.streakWeeks}
          sub={st.streakWeeks ? "tuần" : `tuần này còn ${Math.max(0, WEEKLY_SESSION_GOAL - st.sessionsThisWeek)} buổi`}
        />
      )}
      <StatTile label="Chiên mới tháng này" value={st.newThisMonth} sub="có thông tin liên lạc" />
      <StatTile label="Đã chia sẻ lẽ thật" value={st.sharedTruth} sub={`đã bắt đầu nghe, trên ${st.total} chiên`} />
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
  viewerId: number;
  linkRows: boolean;
}) {
  if (rows.length === 0) return <Empty>Khu vực chưa có thành viên.</Empty>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full text-sm">
        <thead className="whitespace-nowrap bg-sunken text-left text-xs text-muted">
          <tr>
            <th className="hidden w-8 px-2.5 py-2 sm:px-3 text-right font-semibold sm:table-cell">#</th>
            <th className="px-2.5 py-2 sm:px-3 font-semibold">Thánh đồ</th>
            <th className="px-2.5 py-2 sm:px-3 text-right font-semibold">Báptem</th>
            <th className="px-2.5 py-2 sm:px-3 text-right font-semibold">Buổi</th>
            <th className="px-2.5 py-2 text-right font-semibold sm:px-3">Chiên mới</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line tabular-nums">
          {rows.map((r, i) => {
            const name = `${r.name}${r.id === viewerId ? " (bạn)" : ""}`;
            return (
              <tr key={r.id} className={r.id === viewerId ? "bg-accent/5" : ""}>
                <td className="hidden px-2.5 py-2 sm:px-3 text-right text-muted sm:table-cell">{i + 1}</td>
                <td className="max-w-36 truncate sm:max-w-60 px-2.5 py-2 sm:px-3 font-medium text-ink">
                  {linkRows ? (
                    <Link
                      href={`/thong-ke/thanh-vien/${r.id}`}
                      className="-my-2 inline-flex min-h-11 items-center text-accent hover:underline"
                    >
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                </td>
                <td className="px-2.5 py-2 sm:px-3 text-right font-semibold text-ink">{r.baptized}</td>
                <td className="px-2.5 py-2 sm:px-3 text-right text-ink">{r.sessions}</td>
                <td className="px-2.5 py-2 sm:px-3 text-right text-ink">{r.newListeners}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
