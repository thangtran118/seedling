import type { ListenerSummary } from "@/lib/access/listeners";
import { TREND_WEEKS, type PersonalStats } from "@/lib/access/stats";
import { addDays } from "@/lib/domain";
import { ColumnChart } from "./charts";
import { Card, Empty, Section, StatTile, weekDelta } from "./kit";
import { ListenerRows } from "./listener-card";

const ddmm = (key: string) => `${key.slice(8)}/${key.slice(5, 7)}`;

// One person's week and trend: "Thống kê" for a member, and the leader's page for each member.
export function PersonalStatsView({
  st,
  listeners,
  now,
  emptyListeners,
}: {
  st: PersonalStats;
  listeners: ListenerSummary[];
  now: Date;
  emptyListeners: string;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile label="Ca đã đi tuần này" value={st.doneThisWeek} sub={weekDelta(st.doneThisWeek, st.doneLastWeek)} />
        <StatTile label="Ca đã hẹn" value={st.plannedAhead} sub="từ giờ trở đi" />
        <StatTile label="Chiên đồng hành" value={st.linkedListeners} />
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

        <Section title={`Chiên đồng hành (${listeners.length})`}>
          {listeners.length ? <ListenerRows items={listeners} now={now} /> : <Empty>{emptyListeners}</Empty>}
        </Section>
      </div>
    </>
  );
}
