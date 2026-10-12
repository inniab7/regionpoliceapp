// Design Ref: §5.2 ③ — 근무 1회를 10분 칸으로 나눈다
// Plan: 작업 8 — 근무 1회 시간 계산 (규칙 8·11)
// 순수 함수: 저장소·현재 시각을 쓰지 않는다.
// 식사 공제(작업 9)·야간(작업 10)·휴일(작업 11)은 이 10분 칸 위에서 계산한다.
import { diffDays, parseTime, shiftDurationMinutes, TIME_STEP_MINUTES } from "../time";
import type { DateString, TimeRange } from "../types";

/** 근무 1회 */
export interface Shift {
  /** 근무를 시작한 날짜. 자정·월말을 넘겨도 근무 전체가 이 날짜의 근무다 (규칙 8) */
  date: DateString;
  start: string;
  end: string;
  /** 근무 길이(분). 종료 = 시작이면 1440 (규칙 11) */
  durationMinutes: number;
  /**
   * 10분 칸의 시작 시각들. 시작 날짜 00:00부터 지난 분으로 적는다.
   * 다음 날로 넘어간 칸은 1440 이상 (예: 18:00~09:00 → 1080, 1090, …, 1970)
   */
  slots: number[];
  /** [식사시간 공제] 체크. 값이 없으면 체크된 것으로 본다 (규칙 3) */
  mealDeduct: boolean;
}

/** 근무 1회 만들기 결과: 성공 / 잘못된 입력(재입력 안내) */
export type ShiftResult = { ok: true; shift: Shift } | { ok: false; error: "INVALID_TIME" };

/**
 * 근무 날짜와 시작·종료로 근무 1회를 만든다.
 * - 종료 < 시작이면 다음 날 끝나는 근무 1회
 * - 종료 = 시작이면 24시간 근무
 * - 시각이 비었거나 형식·10분 단위가 틀리면 INVALID_TIME (규칙 11)
 */
export function buildShift(date: DateString, range: TimeRange): ShiftResult {
  const duration = shiftDurationMinutes(range.start, range.end);
  if (duration === null) return { ok: false, error: "INVALID_TIME" };

  const startMinute = parseTime(range.start)!;
  const slots: number[] = [];
  for (let m = startMinute; m < startMinute + duration; m += TIME_STEP_MINUTES) slots.push(m);

  return {
    ok: true,
    shift: {
      date,
      start: range.start,
      end: range.end,
      durationMinutes: duration,
      slots,
      mealDeduct: range.mealDeduct ?? true,
    },
  };
}

/** 10분 칸이 시작 날짜 기준 몇째 날인지 (0 = 시작한 날, 1 = 다음 날) */
export function slotDayOffset(slot: number): number {
  return Math.floor(slot / 1440);
}

/** 10분 칸의 하루 중 시각(분, 0~1439) */
export function slotMinuteOfDay(slot: number): number {
  return slot % 1440;
}

// ─── 겹침 검사 (추가 근무는 정해진 근무시간 밖만, 규칙 14) ──────

/** 근무 1회를 날짜와 상관없는 하나의 시간축(1970-01-01 00:00부터 지난 분)에 놓은 구간 */
export interface Interval {
  from: number;
  to: number;
}

/** 근무 1회의 구간 [시작, 끝) */
export function shiftInterval(shift: Shift): Interval {
  const base = diffDays("1970-01-01", shift.date) * 1440;
  const from = base + shift.slots[0];
  return { from, to: from + shift.durationMinutes };
}

/** 두 근무가 1분이라도 겹치는지 (끝과 시작이 맞닿는 것은 겹침이 아님) */
export function shiftsOverlap(a: Shift, b: Shift): boolean {
  const x = shiftInterval(a);
  const y = shiftInterval(b);
  return x.from < y.to && y.from < x.to;
}
