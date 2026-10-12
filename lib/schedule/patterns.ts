// Design Ref: §6.2 — 근무 패턴 정의 (코드 상수)
// Plan: 작업 7 — 패턴 1~5의 순환 내용
import type { DayKind, PatternId, TimeRange, TimedShiftKind } from "../types";

export interface PatternDefinition {
  /** 화면 표시 이름 */
  label: string;
  /**
   * 하루씩 반복되는 순환 (패턴 시작일 = 순환의 첫째 날).
   * 패턴 5(일근)는 순환이 없고 요일·공휴일로 정한다 → null
   */
  cycle: readonly DayKind[] | null;
}

/** PRD 1장 근무 패턴 표 */
export const PATTERNS: Record<PatternId, PatternDefinition> = {
  1: {
    label: "패턴 1",
    cycle: ["주간", "야간", "심야", "비번", "휴무", "주간", "야간", "비번", "비번", "휴무"],
  },
  2: {
    label: "패턴 2",
    cycle: ["주간", "야간", "비번", "휴무"],
  },
  3: {
    label: "패턴 3",
    cycle: ["주간", "주간", "주간", "야간", "비번", "야간", "비번", "야간", "비번"],
  },
  4: {
    label: "패턴 4",
    cycle: ["당직", "휴무", "비번"],
  },
  5: {
    label: "패턴 5 (일근)",
    cycle: null,
  },
};

/** 패턴 5(일근) 근무시간: 평일 09:00~18:00 고정 (규칙 13) */
export const DAY_SHIFT_FIXED_TIME: TimeRange = { start: "09:00", end: "18:00" };

/** 달력에 쓰는 한 글자 표시 */
export const DAY_KIND_SHORT: Record<DayKind, string> = {
  주간: "주",
  야간: "야",
  심야: "심",
  당직: "당",
  일근: "일",
  비번: "비",
  휴무: "휴",
};

const TIMED_KINDS: readonly TimedShiftKind[] = ["주간", "야간", "심야"];

/**
 * 그 패턴에서 시작·종료 시간을 입력받아야 하는 근무 종류 (등록 3단계용).
 * 당직·일근은 시간 입력이 없으므로 빠진다 (규칙 12·13).
 */
export function timedKindsInPattern(pattern: PatternId): TimedShiftKind[] {
  const cycle = PATTERNS[pattern].cycle ?? [];
  return TIMED_KINDS.filter((kind) => cycle.includes(kind));
}
