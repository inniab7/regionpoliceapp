// Design Ref: §6.2 — 근무 패턴 정의 (코드 상수)
// Plan: 작업 7 — 패턴 1~5의 순환 내용
import type { CustomCycleKind, DayKind, PatternId, Profile, TimeRange, TimedShiftKind } from "../types";

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
  // 6: 순환은 사용자가 만든다(등록 정보의 customCycle). profileCycle()로 읽는다
  6: {
    label: "패턴 6 (직접 만들기)",
    cycle: null,
  },
};

/** 등록 정보의 순환. 일근(5)처럼 순환이 없거나 직접 만든 순환이 비었으면 null */
export function profileCycle(profile: Pick<Profile, "pattern" | "customCycle">): readonly DayKind[] | null {
  if (profile.pattern === 6) return profile.customCycle && profile.customCycle.length > 0 ? profile.customCycle : null;
  return PATTERNS[profile.pattern].cycle;
}

/** 직접 만든 순환에 근무하는 날(주간·야간·일근)이 하나라도 있는지 */
export function hasWorkDay(cycle: readonly CustomCycleKind[]): boolean {
  return cycle.some((k) => k === "주간" || k === "야간" || k === "일근");
}

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

/**
 * 당직 기본 시간: 09:00 시작, 종료 = 시작이므로 다음 날 09:00까지 24시간 (규칙 11·12).
 * 사용자가 등록 때 시작 시각을 10분 단위로 바꿀 수 있다 (종료는 늘 시작과 같다).
 */
export const DUTY_DEFAULT_TIME: TimeRange = { start: "09:00", end: "09:00" };

/**
 * 등록 때 고르는 시작 시(時) 선택지 (PRD 흐름 ⓪).
 * 형사·수사·사고조사·교통관리·교통안전의 야간은 이 제한 없이 10분 단위로 자유롭게 고른다 (규칙 10).
 */
export const START_HOUR_CHOICES: Record<"주간" | "야간" | "심야", readonly number[]> = {
  주간: [6, 7, 8, 9],
  야간: [17, 18, 19],
  심야: [20, 21, 22],
};

/** 등록 화면이 처음에 채워 두는 근무시간 (사용자가 바꿀 수 있다) */
export const DEFAULT_SHIFT_TIMES: Record<TimedShiftKind, TimeRange> = {
  주간: { start: "09:00", end: "18:00" },
  야간: { start: "18:00", end: "09:00" },
  심야: { start: "22:00", end: "06:00" },
  당직: DUTY_DEFAULT_TIME,
  일근: DAY_SHIFT_FIXED_TIME, // 직접 만든 패턴(6)에서만 쓰며, 시작·종료를 바꿀 수 있다
};

const TIMED_KINDS: readonly TimedShiftKind[] = ["주간", "야간", "심야", "당직", "일근"];

/**
 * 그 패턴에서 시간을 입력받아야 하는 근무 종류 (등록 3단계용).
 * 일근은 09:00~18:00 고정이라 빠진다 (규칙 13). 당직은 시작 시각만 받는다 (규칙 12).
 */
export function timedKindsInPattern(pattern: PatternId, customCycle?: readonly DayKind[]): TimedShiftKind[] {
  // 직접 만든 패턴(6)은 순환에 들어 있는 주간·야간·일근의 시간을 받는다
  const cycle = pattern === 6 ? (customCycle ?? []) : (PATTERNS[pattern].cycle ?? []);
  return TIMED_KINDS.filter((kind) => cycle.includes(kind));
}
