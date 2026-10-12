// Design Ref: §5.2 ④·⑥ — 휴일 여부는 근무를 시작한 날로, 휴일은 하루 8시간까지
// Plan: 작업 11 — 휴일 판정 (규칙 6·15)
import { isWeekend } from "../time";
import type { DateString } from "../types";

/** 휴일 하루 인정 한도 = 8시간 = 10분 칸 48개 (규칙 6) */
export const HOLIDAY_DAILY_CAP_SLOTS = 48;

/**
 * 그 날짜가 휴일(토·일·공휴일)인지.
 * 날을 넘긴 근무는 시작한 날로 판단하므로, 근무의 시작 날짜를 넘긴다 (규칙 6).
 * 예) 금요일 시작 야간 → 평일, 토요일 시작 야간 → 일요일 새벽까지 전체가 휴일
 */
export function isRestDay(date: DateString, holidays: ReadonlySet<DateString>): boolean {
  return isWeekend(date) || holidays.has(date);
}

/** 휴일 하루 8시간 나누기 결과 */
export interface HolidayCapSplit {
  /** 휴일로 인정하는 칸 (처음 8시간) */
  holiday: number[];
  /** 8시간을 넘은 칸 → 평일과 똑같이 계산 (야간은 야간, 평시는 주 40시간 누적) */
  overflow: number[];
}

/**
 * 휴일에 시작한 근무들(정규·추가 근무·교육출장)의 근무 칸을 모두 합쳐,
 * 근무한 순서대로 처음 8시간은 휴일, 넘는 시간은 overflow로 나눈다 (규칙 6).
 * 칸은 식사 공제 후 남은 칸이며, 모두 같은 시작 날짜 기준(00:00부터 지난 분)이다.
 */
export function capHolidaySlots(slotsOfDay: readonly number[]): HolidayCapSplit {
  const sorted = [...slotsOfDay].sort((a, b) => a - b);
  return {
    holiday: sorted.slice(0, HOLIDAY_DAILY_CAP_SLOTS),
    overflow: sorted.slice(HOLIDAY_DAILY_CAP_SLOTS),
  };
}
