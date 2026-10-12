// Design Ref: §4.5 — 설정의 공휴일: 내장 목록 + 내가 추가한 날 − 내가 뺀 날, [날짜 추가]/[삭제]
// Plan: 작업 21 — 공휴일 편집 (규칙 15)
// 순수 함수: 원래 데이터는 바꾸지 않고 새 데이터를 돌려준다.
import { isValidDate, isWeekend } from "../time";
import type { DateString, SavedData } from "../types";
import { BUILT_IN_HOLIDAYS, effectiveHolidays } from "./kr";

/** 공휴일 목록의 한 줄 */
export interface HolidayRow {
  date: DateString;
  /** 내장 목록의 이름, 직접 추가한 날은 "직접 추가" */
  name: string;
  source: "기본" | "추가";
  /** 사용자가 뺀 날 (내장 공휴일만 뺄 수 있다. [되돌리기]로 다시 넣는다) */
  removed: boolean;
}

type HolidayData = Pick<SavedData, "holidaysAdded" | "holidaysRemoved">;

/** 그 해의 공휴일 줄들 (날짜 순). 뺀 날도 [되돌리기]를 위해 남겨 둔다 */
export function holidayRowsForYear(data: HolidayData, year: number): HolidayRow[] {
  const prefix = `${year}-`;
  const dates = new Set<DateString>([
    ...Object.keys(BUILT_IN_HOLIDAYS).filter((d) => d.startsWith(prefix)),
    ...data.holidaysAdded.filter((d) => d.startsWith(prefix)),
  ]);
  return [...dates]
    .sort()
    .map((date) => {
      const builtIn = date in BUILT_IN_HOLIDAYS;
      return {
        date,
        name: builtIn ? BUILT_IN_HOLIDAYS[date] : "직접 추가",
        source: builtIn ? "기본" : "추가",
        removed: builtIn && data.holidaysRemoved.includes(date),
      } satisfies HolidayRow;
    });
}

/** 지금 공휴일인지 (내장 + 추가 − 뺀 날) */
export function isHoliday(data: HolidayData, date: DateString): boolean {
  return effectiveHolidays(data.holidaysAdded, data.holidaysRemoved).has(date);
}

export type AddHolidayResult =
  | "added" // 새로 추가함
  | "restored" // 내장 공휴일을 뺀 적이 있어 되돌림
  | "already" // 이미 공휴일
  | "weekend" // 토·일은 지정하지 않아도 휴일이라 추가하지 않음
  | "invalid"; // 없는 날짜

/** 공휴일 날짜를 추가한다 */
export function addHoliday<T extends SavedData>(data: T, date: DateString): { data: T; result: AddHolidayResult } {
  if (!isValidDate(date)) return { data, result: "invalid" };
  if (isWeekend(date)) return { data, result: "weekend" };
  if (isHoliday(data, date)) return { data, result: "already" };

  // 내장 공휴일을 뺀 적이 있으면 되돌린다
  if (data.holidaysRemoved.includes(date)) {
    return { data: { ...data, holidaysRemoved: data.holidaysRemoved.filter((d) => d !== date) }, result: "restored" };
  }
  return { data: { ...data, holidaysAdded: [...data.holidaysAdded, date].sort() }, result: "added" };
}

/**
 * 공휴일을 뺀다. 내가 추가한 날은 목록에서 지우고, 내장 공휴일은 "뺀 날"로 표시한다.
 * 이미 공휴일이 아니면 그대로 둔다.
 */
export function removeHoliday<T extends SavedData>(data: T, date: DateString): T {
  if (data.holidaysAdded.includes(date)) {
    return { ...data, holidaysAdded: data.holidaysAdded.filter((d) => d !== date) };
  }
  if (date in BUILT_IN_HOLIDAYS && !data.holidaysRemoved.includes(date)) {
    return { ...data, holidaysRemoved: [...data.holidaysRemoved, date].sort() };
  }
  return data;
}

/** 뺀 내장 공휴일을 다시 넣는다 */
export function restoreHoliday<T extends SavedData>(data: T, date: DateString): T {
  if (!data.holidaysRemoved.includes(date)) return data;
  return { ...data, holidaysRemoved: data.holidaysRemoved.filter((d) => d !== date) };
}
