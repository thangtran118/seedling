import Link from "next/link";
import type { ReactNode } from "react";
import { daysBetween, isClosedStage, LESSONS, lessonProgress, type Stage } from "@/lib/domain";
import { LessonDots, StageBadge } from "./kit";

type ListenerLike = {
  id: string;
  name: string;
  age: number | null;
  stage: Stage;
  lessons: number[];
  owners?: string[];
};

// One line under the dots: how far, and what comes next (not for báptem / từ chối).
export function ProgressNote({ lessons, stage }: { lessons: number[]; stage: Stage }) {
  const { latest, count, next } = lessonProgress(lessons);
  return (
    <p className="text-xs text-muted">
      {latest === null ? (
        "Chưa nghe mảnh nào"
      ) : (
        <>
          {count}/{LESSONS.length} mảnh
          {!isClosedStage(stage) &&
            (next !== null ? (
              <>
                {" "}
                · kế tiếp <b className="text-ink">mảnh {next}</b>
              </>
            ) : (
              " · đã nghe đủ"
            ))}
        </>
      )}
    </p>
  );
}

// Same layout as the listener page's main card: name and status on top, age, then the mảnh.
export function ListenerCard({ l, footer }: { l: ListenerLike; footer?: ReactNode }) {
  return (
    <Link
      href={`/nguoi-nghe/${l.id}`}
      className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-muted/50 active:bg-line/30"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-lg font-bold leading-tight text-ink">{l.name}</span>
        <StageBadge stage={l.stage} />
      </div>
      <span className="text-sm text-muted">{l.age === null ? "Chưa rõ tuổi" : `${l.age} tuổi`}</span>
      <div className="mt-1 flex flex-col gap-1">
        <LessonDots heard={l.lessons} closed={isClosedStage(l.stage)} />
        <ProgressNote lessons={l.lessons} stage={l.stage} />
      </div>
      {l.owners && (
        <p className="mt-1 truncate border-t border-line pt-1.5 text-sm text-muted">
          Đồng hành: <span className="font-medium text-ink">{l.owners.length ? l.owners.join(", ") : "chưa có"}</span>
        </p>
      )}
      {footer}
    </Link>
  );
}

export function ListenerRow({ l, now = new Date() }: { l: ListenerLike & { lastDoneAt?: Date | null }; now?: Date }) {
  const { next } = lessonProgress(l.lessons);
  const days = l.lastDoneAt ? daysBetween(new Date(l.lastDoneAt), now) : null;
  return (
    <Link
      href={`/nguoi-nghe/${l.id}`}
      className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-sunken/60 active:bg-line/30"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-ink">{l.name}</span>
          <StageBadge stage={l.stage} />
        </div>
        <LessonDots heard={l.lessons} closed={isClosedStage(l.stage)} />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        {isClosedStage(l.stage) ? (
          <span className="text-xs text-muted">
            {l.lessons.length}/{LESSONS.length} mảnh
          </span>
        ) : next !== null ? (
          <span className="text-sm text-muted">
            kế tiếp <b className="text-base tabular-nums text-ink">M{next}</b>
          </span>
        ) : (
          <span className="text-sm font-semibold text-done">Đã nghe đủ</span>
        )}
        {!isClosedStage(l.stage) && (
          <span className="text-xs text-muted">
            {days === null ? "chưa có ca" : days === 0 ? "gặp hôm nay" : `${days} ngày trước`}
          </span>
        )}
      </div>
    </Link>
  );
}

// Rows in one bordered card, the list form used on the home and stats pages.
export function ListenerRows({ items, now }: { items: (ListenerLike & { lastDoneAt?: Date | null })[]; now?: Date }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {items.map((l) => (
        <ListenerRow key={l.id} l={l} now={now} />
      ))}
    </div>
  );
}
