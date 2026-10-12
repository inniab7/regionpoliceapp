// Design Ref: §5.2 ① — 등록 이력(적용일별)·공휴일로 날짜별 근무를 만든다
// Plan: 작업 7 — 패턴 → 날짜별 근무 생성 (규칙 13·16)
// 순수 함수: 저장소·현재 시각을 쓰지 않는다. 공휴일 목록은 호출하는 쪽에서 넘긴다.
import { addDays, datesInMonth, diffDays, isWeekend, weekStart } from "../time";
import type { DateString, DayKind, Profile, TimeRange } from "../types";
import { DAY_SHIFT_FIXED_TIME, PATTERNS } from "./patterns";

/** 하루의 정해진 근무 (근무 변경을 반영하기 전) */
export interface PlannedDay {
  date: DateString;
  /** 그날 적용되는 등록 정보. 첫 적용일보다 앞선 날은 null */
  profile: Profile | null;
  /** 근무 종류. 등록 정보가 없는 날은 null */
  kind: DayKind | null;
  /**
   * 정해진 근무시간. 쉬는 날·당직(시간외 계산 없음, 규칙 12)은 null.
   * 근무하는 날인데 등록된 시간이 없으면 null → 계산 단계에서 재입력 안내
   */
  time: TimeRange | null;
}

/** 그 날짜에 적용되는 등록 정보 (적용일이 그 날짜 이하인 것 중 가장 최근, 규칙 16) */
export function profileOnDate(profiles: readonly Profile[], date: DateString): Profile | null {
  let found: Profile | null = null;
  for (const p of profiles) {
    if (p.effectiveFrom <= date && (!found || p.effectiveFrom >= found.effectiveFrom)) found = p;
  }
  return found;
}

/** 음수에도 0 이상을 돌려주는 나머지 (시작일 이전을 거꾸로 순환할 때 사용) */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** 등록 정보 하나로 그날 근무 종류를 정한다 */
export function dayKindFor(profile: Profile, date: DateString, holidays: ReadonlySet<DateString>): DayKind {
  const { cycle } = PATTERNS[profile.pattern];
  if (cycle === null) {
    // 패턴 5(일근): 평일 근무, 토·일·공휴일 휴무 (규칙 13)
    return isWeekend(date) || holidays.has(date) ? "휴무" : "일근";
  }
  // 패턴 1~4: 시작일부터 순환. 시작일 이전은 거꾸로 이어서 센다 (규칙 16)
  // patternStartDate는 저장할 때 검사하므로 패턴 1~4에는 반드시 있다
  const offset = diffDays(profile.patternStartDate!, date);
  return cycle[mod(offset, cycle.length)];
}

/** 근무 종류에 맞는 정해진 근무시간 */
function timeFor(profile: Profile, kind: DayKind): TimeRange | null {
  switch (kind) {
    case "주간":
    case "야간":
    case "심야":
      return profile.shiftTimes[kind] ?? null;
    case "일근":
      return DAY_SHIFT_FIXED_TIME;
    default:
      // 당직(시간외 계산 없음)·비번·휴무
      return null;
  }
}

/** 하루의 정해진 근무 */
export function plannedDay(
  profiles: readonly Profile[],
  date: DateString,
  holidays: ReadonlySet<DateString>,
): PlannedDay {
  const profile = profileOnDate(profiles, date);
  if (!profile) return { date, profile: null, kind: null, time: null };
  const kind = dayKindFor(profile, date, holidays);
  return { date, profile, kind, time: timeFor(profile, kind) };
}

/** from부터 to까지(둘 다 포함) 날짜별 정해진 근무 */
export function plannedDays(
  profiles: readonly Profile[],
  from: DateString,
  to: DateString,
  holidays: ReadonlySet<DateString>,
): PlannedDay[] {
  const days: PlannedDay[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    days.push(plannedDay(profiles, date, holidays));
  }
  return days;
}

/**
 * 한 달 계산에 필요한 날짜 범위: 그 달 1일이 속한 주의 일요일 ~ 말일이 속한 주의 토요일.
 * 달을 걸친 주의 40시간 누적을 이어서 세기 위해 앞뒤 주까지 포함한다 (규칙 8).
 * 달력 화면도 같은 범위(일~토 줄 맞춤)를 쓴다.
 */
export function monthCalcRange(year: number, month: number): { from: DateString; to: DateString } {
  const dates = datesInMonth(year, month);
  const from = weekStart(dates[0]);
  const to = addDays(weekStart(dates[dates.length - 1]), 6);
  return { from, to };
}
