// Design Ref: §6.1 — 등록 입력값을 Profile로 만들고 기기에 저장한다 (첫 등록과 [변경] 공통)
// Plan: 작업 19 — 등록 완료와 [변경]
// 순수 함수: 저장소는 호출하는 쪽에서 넘긴다 (시험에서는 메모리 저장소).
import { needsMealChoice } from "../overtime/meal";
import { DEFAULT_SHIFT_TIMES, timedKindsInPattern } from "../schedule/patterns";
import type { CustomCycleKind, DateString, Department, IsoDateTime, PatternId, Profile, TimeRange, TimedShiftKind } from "../types";
import type { KeyValueStore } from "./keyValueStore";
import { addProfile, createEmptyData, loadData, saveData } from "./store";

/**
 * 첫 등록의 적용일. 등록한 날이 아니라 아주 먼 과거로 두어,
 * 달 중간에 등록해도 그 달 1일부터 (지난 달도) 근무표가 계산되게 한다 (규칙 16).
 */
export const FIRST_PROFILE_EFFECTIVE_FROM: DateString = "2000-01-01";

/** 등록 화면에서 모은 입력값 */
export interface ProfileInput {
  effectiveFrom: DateString;
  agency: string;
  department: Department;
  team: string;
  pattern: PatternId;
  /** 패턴 5는 쓰지 않는다 */
  patternStartDate: string;
  /** 직접 만든 패턴(6)의 순환. 다른 패턴에서는 무시한다 */
  customCycle?: readonly CustomCycleKind[];
  shiftTimes: Partial<Record<TimedShiftKind, TimeRange>>;
}

/** 입력값을 저장할 Profile로 정리한다: 공백 정리, 패턴에 없는 근무 종류 버림, 패턴 5는 시작일 없음 */
export function buildProfile(input: ProfileInput): Profile {
  const shiftTimes: Profile["shiftTimes"] = {};
  for (const kind of timedKindsInPattern(input.pattern, input.customCycle)) {
    const range = input.shiftTimes[kind] ?? DEFAULT_SHIFT_TIMES[kind];
    // 당직은 24시간 근무라 종료 = 시작 (규칙 11·12)
    const end = kind === "당직" ? range.start : range.end;
    const normalized: TimeRange = { start: range.start, end };
    // [식사시간 공제] 체크는 평시가 1시간 미만인 근무에서만 의미가 있다 (규칙 3)
    if (needsMealChoice(normalized)) normalized.mealDeduct = range.mealDeduct ?? true;
    shiftTimes[kind] = normalized;
  }
  return {
    effectiveFrom: input.effectiveFrom,
    agency: input.agency.trim(),
    department: input.department,
    team: input.team.trim(),
    pattern: input.pattern,
    ...(input.pattern !== 5 ? { patternStartDate: input.patternStartDate } : {}),
    ...(input.pattern === 6 ? { customCycle: [...(input.customCycle ?? [])] } : {}),
    shiftTimes,
  };
}

/** 등록 결과 */
export type RegisterResult = "ok" | "corrupt" | "save-failed";

/**
 * 등록 정보를 기기에 저장한다 (같은 적용일이 있으면 바꿔 끼운다).
 * 저장된 데이터가 망가져 있으면 지우지 않고 "corrupt"를 돌려준다 —
 * 사용자가 새로 등록하겠다고 분명히 한 경우(replaceCorrupt)에만 새 데이터로 바꾼다.
 */
export function registerProfile(
  store: KeyValueStore,
  profile: Profile,
  now: IsoDateTime,
  options: { replaceCorrupt?: boolean } = {},
): RegisterResult {
  const loaded = loadData(store);
  let base;
  if (loaded.kind === "ok") base = loaded.data;
  else if (loaded.kind === "empty" || options.replaceCorrupt) base = createEmptyData(now);
  else return "corrupt";
  return saveData(store, addProfile(base, profile)) ? "ok" : "save-failed";
}
