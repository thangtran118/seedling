import type { ListenerStats, MonthStats } from "@/lib/access/stats";
import { formatMonth } from "@/lib/domain";
import { Empty, StatTile } from "./kit";

// Share of the month's listeners; null when there are none.
export const rate = (n: number, total: number) => (total ? Math.round((n / total) * 100) : null);
export const pct = (r: number | null) => (r === null ? "—" : `${r}%`);

function versus(cur: number, prev: number, unit = "") {
  const d = cur - prev;
  return d === 0 ? "bằng tháng trước" : `${d > 0 ? "+" : ""}${d}${unit} so với tháng trước`;
}

function rateSub(n: number, total: number, prev: MonthStats, key: "heard" | "baptized") {
  const cur = rate(n, total);
  const before = rate(prev[key], prev.total);
  const share = `${n}/${total} chiên`;
  if (cur === null || before === null) return share;
  return `${share} · ${versus(cur, before, " điểm %")}`;
}

// The four numbers: total, new this month, heard the truth (reached mảnh 1), báptem — each against last month.
export function StatsTiles({ st, size = "md" }: { st: ListenerStats; size?: "sm" | "md" }) {
  const { current: c, previous: p } = st;
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
      <StatTile size={size} label="Tổng số chiên" value={c.total} sub={versus(c.total, p.total)} />
      <StatTile size={size} label="Chiên mới tháng này" value={c.added} sub={`tháng trước ${p.added}`} />
      <StatTile
        size={size}
        label="Tỉ lệ nghe lẽ thật"
        value={pct(rate(c.heard, c.total))}
        sub={rateSub(c.heard, c.total, p, "heard")}
      />
      <StatTile
        size={size}
        label="Tỉ lệ báptem"
        value={pct(rate(c.baptized, c.total))}
        sub={rateSub(c.baptized, c.total, p, "baptized")}
      />
    </div>
  );
}

// Every month since the first listener, newest first.
export function StatsHistory({ history }: { history: MonthStats[] }) {
  if (history.length === 0) return <Empty>Chưa có dữ liệu.</Empty>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-sunken text-left text-xs text-muted">
          <tr>
            <th className="px-3 py-2 font-semibold">Tháng</th>
            <th className="px-3 py-2 text-right font-semibold">Tổng</th>
            <th className="px-3 py-2 text-right font-semibold">Mới</th>
            <th className="px-3 py-2 text-right font-semibold">Nghe lẽ thật</th>
            <th className="px-3 py-2 text-right font-semibold">Báptem</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line tabular-nums">
          {history.map((m) => (
            <tr key={m.month}>
              <td className="whitespace-nowrap px-3 py-2 text-ink">{formatMonth(m.month)}</td>
              <td className="px-3 py-2 text-right text-ink">{m.total}</td>
              <td className="px-3 py-2 text-right text-ink">{m.added}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right text-ink">
                {pct(rate(m.heard, m.total))} <span className="text-xs text-muted">({m.heard})</span>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right text-ink">
                {pct(rate(m.baptized, m.total))} <span className="text-xs text-muted">({m.baptized})</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
