import Link from "next/link";
import type { ReactNode } from "react";
import { LESSONS, lessonProgress, type DisplayStatus } from "@/lib/domain";
import { LessonDots, StatusBadge } from "./kit";

type ListenerLike = {
  id: string;
  name: string;
  age: number | null;
  status: DisplayStatus;
  lessons: number[];
  owners?: string[];
};

const closed = (s: DisplayStatus) => s === "baptem" || s === "tu_choi";

// The lesson a listener has reached, as the biggest thing on the card: "MẢNH 4".
export function LessonBlock({
  lessons,
  status,
  size = "md",
}: {
  lessons: number[];
  status: DisplayStatus;
  size?: "md" | "lg";
}) {
  const { latest } = lessonProgress(lessons);
  const box = size === "lg" ? "h-24 w-24 rounded-2xl" : "h-16 w-16 rounded-xl";
  const num = size === "lg" ? "text-5xl" : "text-3xl";
  const tone =
    latest === null
      ? "bg-sunken text-muted"
      : closed(status)
        ? "bg-line/60 text-ink"
        : "bg-done text-white dark:text-[#0f1a14]";
  return (
    <div
      className={`flex shrink-0 flex-col items-center justify-center ${box} ${tone}`}
      aria-label={latest === null ? "Chưa nghe mảnh nào" : `Đã nghe đến mảnh ${latest}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Mảnh</span>
      <span className={`${num} font-bold leading-none tabular-nums`}>{latest ?? "–"}</span>
    </div>
  );
}

// One line under the dots: what comes next (not for báptem / từ chối).
export function ProgressNote({ lessons, status }: { lessons: number[]; status: DisplayStatus }) {
  const { latest, count, next } = lessonProgress(lessons);
  if (closed(status)) {
    return (
      <p className="text-xs text-muted">
        {count}/{LESSONS.length} mảnh
      </p>
    );
  }
  return (
    <p className="text-xs text-muted">
      {latest === null ? (
        "Chưa nghe mảnh nào"
      ) : (
        <>
          {count}/{LESSONS.length} mảnh
          {next !== null ? (
            <>
              {" "}
              · kế tiếp <b className="text-ink">mảnh {next}</b>
            </>
          ) : (
            " · đã nghe đủ"
          )}
        </>
      )}
    </p>
  );
}

export function ListenerCard({
  l,
  footer,
  flagged = false,
}: {
  l: ListenerLike;
  footer?: ReactNode;
  flagged?: boolean;
}) {
  return (
    <Link
      href={`/nguoi-nghe/${l.id}`}
      className={`flex gap-3.5 rounded-2xl border bg-surface p-3.5 transition-colors hover:border-muted/50 active:bg-line/30 ${
        flagged ? "border-late/50" : "border-line"
      }`}
    >
      <LessonBlock lessons={l.lessons} status={l.status} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-lg font-bold leading-tight text-ink">{l.name}</span>
          <StatusBadge status={l.status} />
        </div>
        <span className={`text-base leading-tight ${l.age === null ? "text-muted" : "font-semibold text-ink"}`}>
          {l.age === null ? "Chưa rõ tuổi" : `${l.age} tuổi`}
        </span>
        <div className="mt-1 flex flex-col gap-1">
          <LessonDots heard={l.lessons} />
          <ProgressNote lessons={l.lessons} status={l.status} />
        </div>
        {l.owners && (
          <p className="mt-1 truncate border-t border-line pt-1.5 text-sm text-muted">
            Đồng hành: <span className="font-medium text-ink">{l.owners.length ? l.owners.join(", ") : "chưa có"}</span>
          </p>
        )}
        {footer}
      </div>
    </Link>
  );
}
