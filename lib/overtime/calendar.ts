// Design Ref: §4.2 — 근무표 달력: 일~토 줄에 맞춰 그 달 1일~말일만 채우고 다른 달 칸은 비운다
// Plan: 작업 20 — 근무표 달력 (달 이동 포함)
// 순수 함수: 화면은 이 결과를 그리기만 한다.
import { dayOfWeek, datesInMonth } from "../time";
import type { DateString } from "../types";

/** 달력 한 줄(일~토) = 7칸. 그 달이 아닌 칸은 null */
export type WeekRow = (DateString | null)[];

/** 그 달 달력의 줄들. 1일 앞과 말일 뒤의 빈 칸은 null (다른 달 날짜는 보여 주지 않는다) */
export function monthGrid(year: number, month: number): WeekRow[] {
  const dates = datesInMonth(year, month);
  const leading = dayOfWeek(dates[0]); // 일요일이면 0칸
  const cells: WeekRow = [...Array<null>(leading).fill(null), ...dates];
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: WeekRow[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export interface YearMonth {
  year: number;
  month: number;
}

/** 달을 앞뒤로 옮긴다 (1월에서 이전이면 작년 12월) */
export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** "YYYY-MM-DD" → 그 날짜의 연·월 */
export function yearMonthOf(date: DateString): YearMonth {
  const [year, month] = date.split("-").map(Number);
  return { year, month };
}

/** 화면 표시용 (예: "2026년 10월") */
export function monthLabel({ year, month }: YearMonth): string {
  return `${year}년 ${month}월`;
}

export function isSameMonth(a: YearMonth, b: YearMonth): boolean {
  return a.year === b.year && a.month === b.month;
}
