// Client-safe domain types, labels and pure rules. No database access here.

export const TIME_ZONE = "Asia/Ho_Chi_Minh";
export const LESSONS = [1, 2, 3, 4, 5, 6, 7] as const;
// No caps on people per session: 2-4 người trudo and 1-2 chiên is only what a session usually looks like.

export type ManualStatus = "moi_quen" | "goi_mo" | "baptem" | "tu_choi";
export type DisplayStatus = ManualStatus | "dang_hoc";
// Stored state. Whether a session is upcoming, in progress or completed follows from its start time (sessionPhase).
export type SessionState = "planned" | "cancelled";

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  moi_quen: "Mới quen",
  goi_mo: "Gợi mở",
  dang_hoc: "Đang học",
  baptem: "Báptem",
  tu_choi: "Từ chối",
};

// Design doc, Luật trạng thái: baptem/tu_choi are never changed automatically; otherwise any heard
// lesson means "Đang học"; otherwise the manual status (mới quen / gợi mở) shows.
export function displayStatus(manual: ManualStatus, lessonsHeard: readonly number[]): DisplayStatus {
  if (manual === "baptem" || manual === "tu_choi") return manual;
  return lessonsHeard.length > 0 ? "dang_hoc" : manual;
}

// The mảnh to share next: the smallest lesson not heard yet (null when all 7 are done).
export function nextLesson(lessonsHeard: readonly number[]): number | null {
  return LESSONS.find((l) => !lessonsHeard.includes(l)) ?? null;
}

// "Đang ở mảnh mấy": progress is sequential — reaching mảnh N means 1..N-1 are done too, so only the
// highest lesson reached matters. `lessonsHeard` is expected to already be that contiguous 1..N run
// (see lessonsHeardFor), so this is just naming its edges.
export function lessonProgress(lessonsHeard: readonly number[]) {
  const latest = lessonsHeard.length ? Math.max(...lessonsHeard) : null;
  return { latest, count: latest ?? 0, next: nextLesson(lessonsHeard) };
}

export function ageFromBirthYear(birthYear: number | null, now = new Date()): number | null {
  return birthYear ? now.getFullYear() - birthYear : null;
}

// Whole days elapsed, never negative (a session a few minutes "in the future" counts as today).
export function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
}

const dateTimeFmt = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export const formatDateTime = (d: Date | string) => dateTimeFmt.format(new Date(d));
export const formatDate = (d: Date | string) => dateFmt.format(new Date(d));

// Value for <input type="datetime-local"> in Vietnam time, and the inverse.
export function toLocalInputValue(d: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function fromLocalInputValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+07:00`); // Vietnam has no DST
  return Number.isNaN(d.getTime()) ? null : d;
}

// Default times land on a quarter hour.
export function floorToQuarterHour(d: Date): Date {
  const q = 15 * 60 * 1000;
  return new Date(Math.floor(d.getTime() / q) * q);
}

// ---------- session phases & calendar (Vietnam is UTC+7 all year, no DST) ----------

// A session is "in progress" for this long after its start; after that, unless cancelled, it is completed
// automatically and counts in the listening history. Nobody records a result.
export const SESSION_LIVE_MS = 2 * 60 * 60 * 1000;

export type SessionPhase = "upcoming" | "live" | "done" | "cancelled";

export function sessionPhase(state: SessionState, startsAt: Date | string, now = new Date()): SessionPhase {
  if (state === "cancelled") return "cancelled";
  const start = new Date(startsAt).getTime();
  if (now.getTime() < start) return "upcoming";
  return now.getTime() < start + SESSION_LIVE_MS ? "live" : "done";
}

// Upcoming or in progress: people can still join, leave, edit or cancel it.
export const isOpenPhase = (phase: SessionPhase) => phase === "upcoming" || phase === "live";

export const PHASE_LABEL: Record<SessionPhase, string> = {
  upcoming: "Chưa bắt đầu",
  live: "Đang diễn ra",
  done: "Hoàn thành",
  cancelled: "Đã hủy",
};

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY = /^\d{4}-\d{2}$/;

// "YYYY-MM-DD" of the Vietnam calendar day containing d.
export const dayKey = (d: Date | string) => new Date(new Date(d).getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
export const dayStart = (key: string) => new Date(`${key}T00:00:00+07:00`);
export const addDays = (key: string, n: number) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
// Monday = 0 … Sunday = 6
export const weekdayIndex = (key: string) => (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7;
export const weekStart = (key: string) => addDays(key, -weekdayIndex(key));
// Stats weeks run Sunday to Saturday (Sunday is the first day), unlike the Monday-first calendar.
export const sundayWeekStart = (key: string) => addDays(key, -((weekdayIndex(key) + 1) % 7));
// "Đạt" a week: at least this many sessions (buổi trudo) in it.
export const WEEKLY_SESSION_GOAL = 8;

export const parseDayKey = (v: string | undefined) =>
  v && DAY_KEY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : null;
export const parseMonthKey = (v: string | undefined) =>
  v && MONTH_KEY.test(v) && Number(v.slice(5)) >= 1 && Number(v.slice(5)) <= 12 ? v : null;

export function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

// Whole weeks (Monday first) covering the month: 4 to 6 rows of 7 day keys.
export function monthGrid(month: string): string[][] {
  const first = weekStart(`${month}-01`);
  const last = addDays(`${addMonths(month, 1)}-01`, -1);
  const weeks: string[][] = [];
  for (let k = first; k <= last; k = addDays(k, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(k, i)));
  return weeks;
}

export const WEEKDAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const timeFmt = new Intl.DateTimeFormat("vi-VN", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const dayLongFmt = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
});
export const formatTime = (d: Date | string) => timeFmt.format(new Date(d));
export const formatDayLong = (key: string) => dayLongFmt.format(new Date(`${key}T12:00:00+07:00`));
export const formatMonth = (month: string) => `Tháng ${Number(month.slice(5))}, ${month.slice(0, 4)}`;

// "35 phút", "1 giờ 20 phút": elapsed or remaining time for live and soon-starting sessions.
export function formatDuration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} phút`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}
