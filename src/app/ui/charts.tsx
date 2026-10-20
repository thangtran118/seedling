// Small, dependency-free charts for the leader dashboard. Single series each, so no legend: the title names it.
// Bars: one hue, 4px rounded data end on the baseline side, 2px gaps; hover tooltips via <title>, values in ink.

export function ColumnChart({
  data,
  label,
  highlightLast = false,
}: {
  data: { key: string; label: string; value: number; tooltip: string }[];
  label: string; // accessible name of the chart
  highlightLast?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
  return (
    <figure aria-label={label} className="flex flex-col gap-2">
      <div className="relative flex h-36 items-end gap-[2px] border-b border-line">
        {/* recessive gridline at the max */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" aria-hidden />
        <span className="absolute -top-0.5 right-0 -translate-y-full text-[10px] tabular-nums text-muted">{max}</span>
        {data.map((d, i) => {
          const showValue = i === peak || (highlightLast && i === data.length - 1);
          const current = highlightLast && i === data.length - 1;
          return (
            <div key={d.key} className="group relative flex h-full flex-1 flex-col items-center justify-end">
              {showValue && <span className="mb-0.5 text-xs font-semibold tabular-nums text-ink">{d.value}</span>}
              <div
                className={`w-full max-w-10 rounded-t-[4px] transition-opacity group-hover:opacity-80 ${
                  current ? "bg-done" : "bg-done/55"
                }`}
                style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0 }}
              />
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-bg group-hover:block"
              >
                {d.tooltip}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-[2px]">
        {data.map((d) => (
          <span key={d.key} className="flex-1 text-center text-[10px] tabular-nums text-muted">
            {d.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th>{d.label}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

// Horizontal bars with the label and value as text: reads as a table, compares like a chart.
export function BarList({
  rows,
  total,
  label,
}: {
  rows: { key: string; label: string; value: number; muted?: boolean }[];
  total?: number; // denominator for the bar length; defaults to the largest value
  label: string;
}) {
  const max = Math.max(1, total ?? Math.max(...rows.map((r) => r.value)));
  return (
    <ul aria-label={label} className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-1" title={`${r.label}: ${r.value}`}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-ink">{r.label}</span>
            <span className="font-semibold tabular-nums text-ink">
              {r.value}
              {total !== undefined && <span className="font-normal text-muted"> / {total}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-sunken">
            <div
              className={`h-full rounded-full ${r.muted ? "bg-muted/50" : "bg-done"}`}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
