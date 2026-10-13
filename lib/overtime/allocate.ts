// Design Ref: §5.2 ⑥ — 월 누적·항목 배분 (휴일은 따로, 기본 초과는 월 기준시간 초과분, 야간은 겹쳐서 별도 표시)
// Plan: 작업 12 — 항목 배분 (규칙 4·5·6·7·12). 2026-10-13: 주 40시간 방식에서 월 기준 방식으로 바꿨다(규칙 4·5·7).
// 순수 함수: 하루씩 날짜 순서대로 받은 근무를 10분 칸 단위로 센다.
import { addDays, isWeekend } from "../time";
import type { DateString } from "../types";
import { capHolidaySlots } from "./holiday";
import { applyMealDeduction } from "./meal";
import { isNightSlot } from "./night";
import type { Shift } from "./shift";

/** 하루 기준시간 = 8시간. 월 기준시간 = 그 달 평일(월~금, 공휴일 제외) 수 × 8시간 (규칙 4) */
export const DAILY_BASE_MINUTES = 8 * 60;
/** 휴가(연가·병가)일을 그 달 근무시간에 넣는 시간 = 8시간 (규칙 4) */
export const CREDIT_DAY_MINUTES = 8 * 60;

/**
 * 그 달의 기본근무시간(분) (규칙 4): from~to(포함) 사이 평일(월~금) 중 공휴일이 아닌 날 수 × 8시간.
 * 예) 2026년 10월은 평일 22일 중 대체공휴일(5일)·한글날(9일)을 뺀 20일 → 160시간
 * 토·일과 겹친 공휴일은 빼지 않는다 (평일이 아니므로).
 */
export function monthlyBaseMinutes(from: DateString, to: DateString, holidays: ReadonlySet<DateString>): number {
  let workdays = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
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
  /** 휴가(연가·병가)라 근무 대신 그 달 근무시간에 8시간만 넣는 날 */
  creditDay: boolean;
  /** 그날 시작한 근무들 (정규·교육출장·추가 근무). 식사 공제 전 */
  shifts: Shift[];
}

/**
 * 결과 항목별 분.
 * - basic: 기본 초과 = (그 달 근무시간 − 월 기준시간)의 양수 부분. 야간 근무시간도 근무시간에 들어간다
 * - night: 야간(22:00~06:00)에 일한 시간 전체. 기본 초과와 **겹쳐서** 센다 (야간수당을 따로 받으므로 따로 표시)
 * - holiday: 휴일에 인정되는 시간(하루 8시간까지). 휴일수당으로 대체되므로 기본 초과·야간에 넣지 않는다
 */
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
  /** 식사 공제 후 실제 근무한 분 (휴일 인정 시간 포함) */
  workedMinutes: number;
  /** 그날이 끝났을 때 그 달 근무시간 누적(분). 휴일 인정 시간은 빼고, 휴가는 8시간으로 센다 */
  monthAccumulated: number;
  /** 그 달 기본근무시간(분) */
  monthBase: number;
}

export interface AllocationResult {
  total: Breakdown;
  /** 그 달 근무시간 합계(분): 휴일 인정 시간은 빼고 휴가는 8시간으로 센 값 */
  countedMinutes: number;
  /** 그 달 기본근무시간(분) */
  baseMinutes: number;
  days: DayBreakdown[];
}

/**
 * 날짜 순서대로 받은 하루하루의 근무를 항목에 나눈다.
 * - 휴일에 시작한 근무: 그날 합산 처음 8시간은 휴일(휴일수당), 넘는 시간은 평일처럼 (규칙 6)
 * - 평일(과 휴일 8시간 초과분): 모든 칸을 그 달 근무시간에 더한다. 야간 칸은 야간에도 센다 (규칙 5)
 * - 휴가일: 그 달 근무시간에 8시간만 더하고 다른 항목에는 넣지 않는다 (규칙 4)
 * - 기본 초과 = 그 달 근무시간이 월 기준시간을 넘은 만큼. 날짜별 값은 그날 늘어난 초과분이다 (규칙 4·7)
 * holidays: 실제 공휴일 (월 기준시간에서 평일 공휴일을 빼는 데 쓴다)
 * baseMinutes: 월 기준시간을 직접 정할 때 (없으면 받은 날짜 범위에서 계산)
 */
export function allocate(
  days: readonly DayWork[],
  holidays: ReadonlySet<DateString> = new Set(),
  baseMinutes?: number,
): AllocationResult {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const base =
    baseMinutes ?? (sorted.length === 0 ? 0 : monthlyBaseMinutes(sorted[0].date, sorted[sorted.length - 1].date, holidays));
  const result: DayBreakdown[] = [];
  let acc = 0;
  let overBefore = 0;

  for (const day of sorted) {
    const out: DayBreakdown = {
      date: day.date,
      basic: 0,
      night: 0,
      holiday: 0,
      workedMinutes: 0,
      monthAccumulated: 0,
      monthBase: base,
    };

    // 휴가: 8시간을 그 달 근무시간에 넣는다
    if (day.creditDay) acc += CREDIT_DAY_MINUTES;

    // 그날 시작한 근무를 식사 공제 후 시간 순서대로 모은다
    const worked = day.shifts.flatMap((s) => applyMealDeduction(s).worked).sort((a, b) => a - b);
    out.workedMinutes = worked.length * SLOT;

    // 휴일이면 처음 8시간은 휴일수당으로 대체되어 기본 근무·야간에 들어가지 않는다 (휴일 > 야간, 규칙 7)
    let counted = worked;
    if (day.restDay) {
      const { holiday, overflow } = capHolidaySlots(worked);
      out.holiday = holiday.length * SLOT;
      counted = overflow;
    }

    for (const slot of counted) {
      acc += SLOT;
      if (isNightSlot(slot)) out.night += SLOT; // 야간은 따로 세되, 근무시간에서 빠지지는 않는다
    }

    const over = Math.max(0, acc - base);
    out.basic = over - overBefore;
    overBefore = over;
    out.monthAccumulated = acc;
    result.push(out);
  }

  const total = result.reduce(
    (t, d) => ({ basic: t.basic + d.basic, night: t.night + d.night, holiday: t.holiday + d.holiday }),
    { basic: 0, night: 0, holiday: 0 },
  );
  return { total, countedMinutes: acc, baseMinutes: base, days: result };
}
