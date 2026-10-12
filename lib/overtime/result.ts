// Design Ref: §4.2 — 결과 4줄(기본 초과·야간·휴일·합계)과 고정 안내 문구
// Plan: 작업 23 — 결과 화면 (규칙 1·17). 계산은 monthly.ts가 하고, 여기서는 화면에 보여 줄 줄만 만든다.
import { formatDuration } from "../time";
import type { Breakdown } from "./allocate";

/** 결과 아래에 항상 표시하는 안내 문구 (PRD 규칙 17, 문장 그대로) */
export const RESULT_DISCLAIMER = "참고용 계산이며, 최종 확정은 소속 관서 집계 기준을 따릅니다";

export interface ResultRow {
  key: "basic" | "night" | "holiday" | "sum";
  label: string;
  /** 줄 이름 밑에 작게 쓰는 설명 */
  hint: string;
  minutes: number;
  /** 화면에 보여 줄 시간 (예: "12시간 30분") */
  text: string;
}

/** 결과는 항상 이 4줄이다 (규칙 1): 기본 초과 · 야간 · 휴일 · 합계 */
export function resultRows(total: Breakdown & { sum: number }): ResultRow[] {
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
    row("holiday", "휴일", "토·일·공휴일 근무 (하루 8시간까지)", total.holiday),
    row("sum", "합계", "세 항목의 합", total.sum),
  ];
}
