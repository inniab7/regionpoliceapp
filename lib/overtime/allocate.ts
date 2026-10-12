// Design Ref: §5.2 ⑥ — 주 누적·항목 배분 (휴일 > 야간 > 기본 초과)
// Plan: 작업 12 — 항목 배분 (규칙 4·6·7·8·12)
// 순수 함수: 하루씩 날짜 순서대로 받은 근무를 10분 칸 단위로 한 항목에만 넣는다.
import { accumulationWeekEnd, accumulationWeekStart } from "../schedule/generate";
import { addDays, isWeekend } from "../time";
import type { DateString } from "../types";
import { capHolidaySlots } from "./holiday";
import { applyMealDeduction } from "./meal";
import { isNightSlot } from "./night";
import type { Shift } from "./shift";

/** 하루 기준시간 = 8시간. 주 기준시간 = 평일(월~금, 공휴일 제외) 수 × 8시간 (규칙 4) */
export const DAILY_BASE_MINUTES = 8 * 60;
/** 휴가(연가·병가)일·당직일을 주 누적에 넣는 시간 = 8시간 (규칙 4·12) */
export const CREDIT_DAY_MINUTES = 8 * 60;

/**
 * 그 날짜가 속한 주의 기준시간(분) (규칙 4).
 * 주(일~토, 달이 바뀌면 1일부터·말일까지) 안의 평일 중 공휴일이 아닌 날 × 8시간.
 * 예) 공휴일 없는 주 40시간, 수요일 공휴일 32시간, 2026-10-01(목)~03(토) 16시간
 * 토·일과 겹친 공휴일은 빼지 않는다 (평일이 아니므로).
 */
export function weeklyBaseMinutes(date: DateString, holidays: ReadonlySet<DateString>): number {
  const end = accumulationWeekEnd(date);
  let workdays = 0;
  for (let d = accumulationWeekStart(date); d <= end; d = addDays(d, 1)) {
    if (!isWeekend(d) && !holidays.has(d)) workdays++;
  }
  return workdays * DAILY_BASE_MINUTES;
}

const SLOT = 10;

/** 하루 입력 */
export interface DayWork {
  date: DateString;
  /** 토·일·공휴일인지 (근무를 시작한 날 기준, 규칙 6) */
  restDay: boolean;
  /** 휴가(연가·병가) 또는 당직이라 주 누적에 8시간만 넣는 날 (결과 4줄에는 없음) */
  creditDay: boolean;
  /** 그날 시작한 근무들 (정규·교육출장·추가 근무). 식사 공제 전 */
  shifts: Shift[];
}

/** 결과 항목별 분 */
export interface Breakdown {
  /** 기본 초과 */
  basic: number;
  /** 야간 */
  night: number;
  /** 휴일 */
  holiday: number;
}

/** 하루 결과 (달력·검증용) */
export interface DayBreakdown extends Breakdown {
  date: DateString;
  /** 식사 공제 후 실제 근무한 분 */
  workedMinutes: number;
  /** 그날이 끝났을 때 주 누적(분) */
  weekAccumulated: number;
  /** 그 주의 기준시간(분) */
  weekBase: number;
}

export interface AllocationResult {
  total: Breakdown & { sum: number };
  days: DayBreakdown[];
}

/**
 * 날짜 순서대로 받은 하루하루의 근무를 항목에 나눈다.
 * - 휴일에 시작한 근무: 그날 합산 처음 8시간은 휴일, 넘는 시간은 평일처럼 (규칙 6)
 * - 평일(과 휴일 8시간 초과분): 모든 칸을 주 누적에 더하고, 야간 칸은 야간,
 *   누적이 그 주 기준시간(평일 수 × 8시간)을 넘긴 평시 칸만 기본 초과 (규칙 4·5·7)
 * - 휴가·당직일: 주 누적에 8시간만 더하고 결과에는 넣지 않는다 (규칙 4·12)
 * - 주 누적은 일~토, 달이 바뀌면 새로 센다 (규칙 8)
 * holidays: 실제 공휴일 (주 기준시간에서 평일 공휴일을 빼는 데 쓴다)
 */
export function allocate(
  days: readonly DayWork[],
  holidays: ReadonlySet<DateString> = new Set(),
): AllocationResult {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const result: DayBreakdown[] = [];
  let currentWeek = "";
  let acc = 0;
  let base = 0;

  for (const day of sorted) {
    const week = accumulationWeekStart(day.date);
    if (week !== currentWeek) {
      currentWeek = week;
      acc = 0;
      base = weeklyBaseMinutes(day.date, holidays);
    }

    const out: DayBreakdown = {
      date: day.date,
      basic: 0,
      night: 0,
      holiday: 0,
      workedMinutes: 0,
      weekAccumulated: 0,
      weekBase: base,
    };

    // 휴가·당직: 하루 시작에 8시간을 주 누적에 넣는다
    if (day.creditDay) acc += CREDIT_DAY_MINUTES;

    // 그날 시작한 근무를 식사 공제 후 시간 순서대로 모은다
    const worked = day.shifts.flatMap((s) => applyMealDeduction(s).worked).sort((a, b) => a - b);
    out.workedMinutes = worked.length * SLOT;

    // 휴일이면 처음 8시간은 휴일, 나머지는 평일처럼
    let weekdaySlots = worked;
    if (day.restDay) {
      const { holiday, overflow } = capHolidaySlots(worked);
      out.holiday = holiday.length * SLOT;
      weekdaySlots = overflow;
    }

    for (const slot of weekdaySlots) {
      const over = acc >= base;
      acc += SLOT;
      if (isNightSlot(slot)) out.night += SLOT;
      else if (over) out.basic += SLOT;
    }

    out.weekAccumulated = acc;
    result.push(out);
  }

  const total = result.reduce(
    (t, d) => ({ basic: t.basic + d.basic, night: t.night + d.night, holiday: t.holiday + d.holiday }),
    { basic: 0, night: 0, holiday: 0 },
  );
  return { total: { ...total, sum: total.basic + total.night + total.holiday }, days: result };
}
