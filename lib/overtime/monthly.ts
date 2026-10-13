// Design Ref: §5.2 ①~⑦ — 등록 이력·근무 변경·공휴일 → 그 달 결과 3줄(기본 초과·야간·휴일)
// Plan: 작업 13 — 월간 집계 (규칙 4·8·14, 매달 1일~말일, 기본 초과는 월 기준시간 초과분)
// 순수 함수: 화면은 이 결과만 받아 그린다. 잘못된 입력은 계산에서 빼고 issues로 알려 준다.
import { holidayName as nameOfHoliday } from "../holidays/kr";
import { monthCalcRange, plannedDay } from "../schedule/generate";
import { addDays, formatShortDate } from "../time";
import type { DateString, DayEntry, DayKind, Profile } from "../types";
import { allocate, monthlyBaseMinutes, type Breakdown, type DayWork } from "./allocate";
import { isRestDay } from "./holiday";
import { buildShift, shiftsOverlap, type Shift } from "./shift";

/** 계산 입력 */
export interface MonthInput {
  year: number;
  month: number;
  profiles: readonly Profile[];
  overrides: Readonly<Record<DateString, DayEntry>>;
  /** 실제 공휴일 (내장 + 추가 − 삭제) */
  holidays: ReadonlySet<DateString>;
}

/** 다시 입력해야 하는 문제 */
export type IssueCode =
  | "NO_PROFILE" // 그 달에 적용되는 등록 정보가 없음
  | "MISSING_SHIFT_TIME" // 근무일인데 등록된 근무시간이 없음
  | "INVALID_TIME" // 교육·출장·추가 근무 시간이 잘못됨
  | "LEAVE_ON_OFF_DAY" // 쉬는 날에 휴가를 넣음 (휴가는 근무일만)
  | "EXTRA_OVERLAP"; // 추가 근무가 정해진 근무시간과 겹침 (규칙 14)

export interface Issue {
  date: DateString;
  code: IssueCode;
  /** 화면에 그대로 보여 줄 한국어 안내 */
  message: string;
}

/** 달력 한 칸에 필요한 정보 */
export interface MonthDay extends Breakdown {
  date: DateString;
  /** 패턴으로 정해진 근무 (등록 정보 없으면 null) */
  plannedKind: DayKind | null;
  /** 휴가·교육출장으로 바꾼 날이면 그 이름 */
  replacedBy: "휴가" | "교육출장" | null;
  /** 추가 근무가 있는 날 (계산에 들어간 경우만) */
  hasExtra: boolean;
  /** 토·일·공휴일 */
  restDay: boolean;
  /** 공휴일 이름 (토·일만 쉬는 날이면 null) */
  holidayName: string | null;
  /** 식사 공제 후 실제 근무 분 */
  workedMinutes: number;
  /** 이 날짜에 문제가 있는지 */
  hasIssue: boolean;
}

export interface MonthResult {
  /** 결과 3줄 (분): 기본 초과·야간·휴일 */
  total: Breakdown;
  /** 그 달 근무시간 합계(분): 휴일 인정 시간은 빼고, 휴가는 8시간으로 센 값 */
  countedMinutes: number;
  /** 그 달 기본근무시간(분) = 평일(월~금) 중 공휴일이 아닌 날 × 8시간 */
  baseMinutes: number;
  days: MonthDay[];
  issues: Issue[];
}

const WORK_KINDS: readonly DayKind[] = ["주간", "야간", "심야", "당직", "일근"];

/** 그날의 정해진 근무 1회 (휴가·교육출장으로 바꾸기 전, 겹침 검사용) */
function plannedShift(input: MonthInput, date: DateString): Shift | null {
  const p = plannedDay(input.profiles, date, input.holidays);
  if (!p.time) return null;
  const r = buildShift(date, p.time);
  return r.ok ? r.shift : null;
}

/** 그날 실제로 일한 "정해진 근무"(교육·출장으로 바꿨으면 그 시간). 휴가면 없음 */
function regularShiftOf(input: MonthInput, date: DateString): Shift | null {
  const entry = input.overrides[date];
  if (entry?.replace?.type === "휴가") return null;
  if (entry?.replace?.type === "교육출장") {
    const r = buildShift(date, entry.replace);
    return r.ok ? r.shift : null;
  }
  return plannedShift(input, date);
}

/** 그 달 결과 3줄과 달력용 날짜별 정보 */
export function calculateMonth(input: MonthInput): MonthResult {
  const { from, to } = monthCalcRange(input.year, input.month);
  const issues: Issue[] = [];
  const works: DayWork[] = [];
  const meta: Omit<MonthDay, keyof Breakdown | "workedMinutes">[] = [];

  const issue = (date: DateString, code: IssueCode, message: string) => issues.push({ date, code, message });

  for (let date = from; date <= to; date = addDays(date, 1)) {
    const planned = plannedDay(input.profiles, date, input.holidays);
    const entry = input.overrides[date];
    const restDay = isRestDay(date, input.holidays);
    const isWorkDay = planned.kind !== null && WORK_KINDS.includes(planned.kind);
    const shifts: Shift[] = [];
    let creditDay = false;
    let replacedBy: MonthDay["replacedBy"] = null;
    let hasExtra = false;
    const before = issues.length;

    if (!planned.profile) {
      // 등록 정보가 없는 날은 계산하지 않는다 (첫 등록 전)
    } else if (entry?.replace?.type === "휴가") {
      if (isWorkDay) {
        creditDay = true; // 그 달 근무시간에 8시간 (규칙 4)
        replacedBy = "휴가";
      } else {
        issue(date, "LEAVE_ON_OFF_DAY", `${formatShortDate(date)}은 쉬는 날이라 휴가를 넣을 수 없어요.`);
      }
    } else if (entry?.replace?.type === "교육출장") {
      replacedBy = "교육출장";
      const r = buildShift(date, entry.replace);
      if (r.ok) shifts.push(r.shift);
      else issue(date, "INVALID_TIME", `${formatShortDate(date)} 교육·출장 시간을 다시 입력해 주세요.`);
    } else if (isWorkDay) {
      // 당직(패턴 4)도 여기서 24시간 근무 1회로 계산된다 (규칙 12)
      if (planned.time) {
        const r = buildShift(date, planned.time);
        if (r.ok) shifts.push(r.shift);
        else issue(date, "INVALID_TIME", `${formatShortDate(date)} ${planned.kind} 근무시간을 다시 입력해 주세요.`);
      } else {
        issue(date, "MISSING_SHIFT_TIME", `${planned.kind} 근무시간이 등록되지 않았어요. 설정에서 [변경]으로 입력해 주세요.`);
      }
    }

    // 추가 근무: 정해진 근무시간 밖만 (전날·당일·다음 날 근무와 겹치면 빼고 안내, 규칙 14)
    if (planned.profile && entry?.extra) {
      const r = buildShift(date, entry.extra);
      if (!r.ok) {
        issue(date, "INVALID_TIME", `${formatShortDate(date)} 추가 근무 시간을 다시 입력해 주세요.`);
      } else {
        const neighbors = [addDays(date, -1), date, addDays(date, 1)]
          .map((d) => (d === date ? shifts[0] ?? null : regularShiftOf(input, d)))
          .filter((s): s is Shift => s !== null);
        if (neighbors.some((s) => shiftsOverlap(s, r.shift))) {
          issue(date, "EXTRA_OVERLAP", `${formatShortDate(date)} 추가 근무가 정해진 근무시간과 겹쳐요. 근무시간 밖의 시간만 입력해 주세요.`);
        } else {
          shifts.push(r.shift);
          hasExtra = true;
        }
      }
    }

    works.push({ date, restDay, creditDay, shifts });
    meta.push({
      date,
      plannedKind: planned.kind,
      replacedBy,
      hasExtra,
      restDay,
      holidayName: nameOfHoliday(date, input.holidays),
      hasIssue: issues.length > before,
    });
  }

  if (!input.profiles.some((p) => p.effectiveFrom <= to)) {
    issue(from, "NO_PROFILE", "이 달에 적용되는 등록 정보가 없어요. 먼저 근무를 등록해 주세요.");
  }

  const allocation = allocate(works, input.holidays, monthlyBaseMinutes(from, to, input.holidays));
  const days: MonthDay[] = meta.map((m, i) => {
    const a = allocation.days[i];
    return { ...m, basic: a.basic, night: a.night, holiday: a.holiday, workedMinutes: a.workedMinutes };
  });

  return { total: allocation.total, countedMinutes: allocation.countedMinutes, baseMinutes: allocation.baseMinutes, days, issues };
}
