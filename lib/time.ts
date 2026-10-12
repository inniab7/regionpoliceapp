// Design Ref: §5.2 — 모든 시간은 분 단위 정수, 날짜는 한국 시간(KST) 기준
// Plan: 작업 4 — 시각 ↔ 분 변환, 10분 단위 검사, 날짜·요일 계산
// 이 파일의 함수는 모두 순수 함수다. 현재 시각이 필요하면 호출하는 쪽에서 Date를 넘긴다(CLAUDE.md 8장).
import type { DateString, TimeString } from "./types";

/** 하루 = 1440분 */
export const MINUTES_PER_DAY = 24 * 60;

/** 입력·계산 단위 = 10분 (규칙 9) */
export const TIME_STEP_MINUTES = 10;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

// ─── 시각 ───────────────────────────────────────────────

/** "HH:MM" → 자정부터 지난 분(0~1439). 형식이 틀리면 null */
export function parseTime(time: TimeString): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 자정부터 지난 분 → "HH:MM". 하루를 넘거나 음수면 하루 안으로 접는다 (예: 1500 → "01:00") */
export function formatTime(minutes: number): TimeString {
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** 10분 단위인지 (예: 18:10은 맞고 18:15는 아님) */
export function isTenMinuteStep(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes % TIME_STEP_MINUTES === 0;
}

/** 입력 시각이 "HH:MM" 형식이면서 10분 단위인지 */
export function isValidShiftTime(time: TimeString): boolean {
  const m = parseTime(time);
  return m !== null && isTenMinuteStep(m);
}

/**
 * 근무 1회의 길이(분). 규칙 11:
 * - 종료 > 시작: 같은 날 끝남
 * - 종료 < 시작: 다음 날 끝남
 * - 종료 = 시작: 24시간 근무
 * 시각이 잘못되었거나 10분 단위가 아니면 null (재입력 안내용)
 */
export function shiftDurationMinutes(start: TimeString, end: TimeString): number | null {
  if (!isValidShiftTime(start) || !isValidShiftTime(end)) return null;
  const s = parseTime(start)!;
  const e = parseTime(end)!;
  if (e === s) return MINUTES_PER_DAY;
  return e > s ? e - s : e + MINUTES_PER_DAY - s;
}

/** 분 → "○시간 ○○분" (결과 4줄 표시용, 예: 750 → "12시간 30분", 2400 → "40시간 00분") */
export function formatDuration(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  return `${sign}${Math.floor(abs / 60)}시간 ${String(abs % 60).padStart(2, "0")}분`;
}

// ─── 날짜 ───────────────────────────────────────────────
// 날짜는 "YYYY-MM-DD" 문자열로만 다룬다. 내부 계산은 UTC 기준 일수로 해서 기기 시간대의 영향을 받지 않는다.

/** "YYYY-MM-DD"가 실제로 있는 날짜인지 (예: 2026-02-30은 아님) */
export function isValidDate(date: DateString): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
}

/** 날짜 → 1970-01-01부터 지난 일수 */
function toDayNumber(date: DateString): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** 1970-01-01부터 지난 일수 → 날짜 */
function fromDayNumber(dayNumber: number): DateString {
  const dt = new Date(dayNumber * MS_PER_DAY);
  return formatDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** 연·월·일 → "YYYY-MM-DD" */
export function formatDate(year: number, month: number, day: number): DateString {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 날짜에 n일 더하기 (음수면 빼기) */
export function addDays(date: DateString, days: number): DateString {
  return fromDayNumber(toDayNumber(date) + days);
}

/** b - a 일수 (예: diffDays("2026-10-01", "2026-10-06") = 5) */
export function diffDays(a: DateString, b: DateString): number {
  return toDayNumber(b) - toDayNumber(a);
}

/** 요일 번호 (0 = 일요일 … 6 = 토요일) */
export function dayOfWeek(date: DateString): number {
  // 1970-01-01은 목요일(4)
  return (((toDayNumber(date) + 4) % 7) + 7) % 7;
}

/** 요일 한 글자 ("일"~"토") */
export function weekdayLabel(date: DateString): string {
  return WEEKDAY_LABELS[dayOfWeek(date)];
}

/** 토·일인지 (공휴일은 lib/holidays에서 따로 판단) */
export function isWeekend(date: DateString): boolean {
  const w = dayOfWeek(date);
  return w === 0 || w === 6;
}

/** 그 날짜가 속한 주의 일요일 (한 주 = 일~토, 규칙 4) */
export function weekStart(date: DateString): DateString {
  return addDays(date, -dayOfWeek(date));
}

/** 그 달의 일수 (윤년 포함) */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 그 달의 모든 날짜 (1일 ~ 말일) */
export function datesInMonth(year: number, month: number): DateString[] {
  return Array.from({ length: daysInMonth(year, month) }, (_, i) => formatDate(year, month, i + 1));
}

/** 날짜의 "YYYY-MM" (근무 시작 달 판단용, 규칙 8) */
export function monthOf(date: DateString): string {
  return date.slice(0, 7);
}

/** 넘겨받은 시각을 한국 시간 기준 오늘 날짜로 (기기 시간대와 관계없이) */
export function todayInKst(now: Date): DateString {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return formatDate(kst.getUTCFullYear(), kst.getUTCMonth() + 1, kst.getUTCDate());
}

/** 화면 표시용 짧은 날짜 (예: "10/6(화)") */
export function formatShortDate(date: DateString): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}/${d}(${weekdayLabel(date)})`;
}
