// Design Ref: §4.2 — 결과 3줄(기본 초과·야간·휴일)과 고정 안내 문구. 휴일 줄에는 8시간을 1일로 환산한 일수를 함께 보여 준다
// Plan: 작업 23 — 결과 화면 (규칙 1·17). 계산은 monthly.ts가 하고, 여기서는 화면에 보여 줄 줄만 만든다.
// 합계(sum)는 계산 엔진과 시험에는 남아 있지만 화면에는 보이지 않는다.
import { formatDuration } from "../time";
import type { Breakdown } from "./allocate";

/** 결과 아래에 항상 표시하는 안내 문구 (PRD 규칙 17, 문장 그대로) */
export const RESULT_DISCLAIMER = "참고용 계산이며, 최종 확정은 소속 관서 집계 기준을 따릅니다";

/** 휴일은 8시간을 1일로 환산해 보여 준다 (분) */
export const HOLIDAY_DAY_MINUTES = 8 * 60;

/** 휴일 분 → 일수 문구 (예: 2880분 → "(6일)", 720분 → "(1.5일)", 10분 → "(0.02일)"). 소수 둘째 자리까지, 끝의 0은 뺀다 */
export function formatHolidayDays(minutes: number): string {
  const days = Number((minutes / HOLIDAY_DAY_MINUTES).toFixed(2));
  return `(${days}일)`;
}

export interface ResultRow {
  key: "basic" | "night" | "holiday";
  label: string;
  /** 줄 이름 밑에 작게 쓰는 설명 */
  hint: string;
  minutes: number;
  /** 화면에 보여 줄 시간 (예: "12시간 30분") */
  text: string;
  /** 시간 옆에 작게 덧붙일 말. 휴일 줄만 일수(예: "(6일)")가 있다 */
  note?: string;
}

/** 결과는 항상 이 3줄이다 (규칙 1): 기본 초과 · 야간 · 휴일(일수 병기) */
export function resultRows(total: Breakdown): ResultRow[] {
  const row = (key: ResultRow["key"], label: string, hint: string, minutes: number): ResultRow => ({
    key,
    label,
    hint,
    minutes,
    text: formatDuration(minutes),
  });
  return [
    row("basic", "기본 초과", "주 기준시간을 넘은 근무", total.basic),
    row("night", "야간", "22:00~06:00 근무", total.night),
    { ...row("holiday", "휴일", "토·일·공휴일 근무 (하루 8시간까지)", total.holiday), note: formatHolidayDays(total.holiday) },
  ];
}
