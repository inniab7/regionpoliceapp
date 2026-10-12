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
 * 한 달 계산 범위: 그 달 1일 ~ 말일 (28·29·30·31일, 규칙 8).
 * 다른 달 날짜는 계산에 넣지 않는다.
 */
export function monthCalcRange(year: number, month: number): { from: DateString; to: DateString } {
  const dates = datesInMonth(year, month);
  return { from: dates[0], to: dates[dates.length - 1] };
}

/**
 * 주 40시간 누적을 시작하는 날 (규칙 4·8).
 * 한 주는 일~토지만, 달이 바뀌면 누적을 새로 센다.
 * 예: 2026-10-01(목)~10-03(토)은 9/27이 아니라 10/1부터 센다.
 */
export function accumulationWeekStart(date: DateString): DateString {
  const sunday = weekStart(date);
  const firstOfMonth = `${date.slice(0, 7)}-01`;
  return sunday < firstOfMonth ? firstOfMonth : sunday;
}

/** 주 누적이 끝나는 날: 그 주 토요일, 단 말일을 넘지 않는다 (규칙 8) */
export function accumulationWeekEnd(date: DateString): DateString {
  const saturday = addDays(weekStart(date), 6);
  const [y, m] = date.split("-").map(Number);
  const dates = datesInMonth(y, m);
  const lastOfMonth = dates[dates.length - 1];
  return saturday > lastOfMonth ? lastOfMonth : saturday;
}
