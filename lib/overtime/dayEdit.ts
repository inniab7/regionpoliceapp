// Design Ref: §4.2 — 날짜를 눌러 열리는 근무 변경 창의 입력 → 저장할 변경 기록, 그리고 입력 검사
// Plan: 작업 22 — 근무 변경 입력 (휴가 / 교육·출장 / 추가 근무, 규칙 4·14)
// 순수 함수: 검사는 월간 계산(calculateMonth)을 그대로 써서, 창과 달력의 판단이 늘 같게 한다.
import { plannedDay, type PlannedDay } from "../schedule/generate";
import { DAY_KIND_SHORT } from "../schedule/patterns";
import { formatTime, parseTime } from "../time";
import { yearMonthOf } from "./calendar";
import type { DateString, DayEntry, Profile, TimeRange } from "../types";
import { needsMealChoice } from "./meal";
import { calculateMonth, type MonthInput } from "./monthly";

/** 창에서 고르는 "그날 근무를 바꾸는 방법" */
export type ReplaceChoice = "none" | "휴가" | "교육출장";

/** 창의 입력 상태 */
export interface DayEditForm {
  replace: ReplaceChoice;
  /** 교육·출장 시간 */
  training: TimeRange;
  /** 추가 근무를 넣을지 */
  extraOn: boolean;
  /** 추가 근무 시간 */
  extra: TimeRange;
}

/** 근무를 바꿀 수 있는 날인지: 근무일(주간·야간·심야·당직·일근)만 휴가를 고를 수 있다 */
export function canTakeLeave(planned: PlannedDay): boolean {
  return planned.kind !== null && planned.kind !== "비번" && planned.kind !== "휴무";
}

const DEFAULT_TRAINING: TimeRange = { start: "09:00", end: "18:00" };

/** 추가 근무 처음 값: 정해진 근무가 끝나는 시각부터 3시간, 쉬는 날이면 09:00~18:00 */
export function defaultExtraRange(planned: PlannedDay): TimeRange {
  if (planned.time && planned.kind !== "당직") {
    const end = parseTime(planned.time.end);
    if (end !== null) return { start: planned.time.end, end: formatTime(end + 180) };
  }
  return { start: "09:00", end: "18:00" };
}

/** 저장된 변경 기록(없을 수 있음)에서 창의 처음 입력 상태를 만든다 */
export function initialDayForm(entry: DayEntry | undefined, planned: PlannedDay): DayEditForm {
  const replace = entry?.replace;
  return {
    replace: replace?.type === "휴가" ? "휴가" : replace?.type === "교육출장" ? "교육출장" : "none",
    training: replace?.type === "교육출장" ? { start: replace.start, end: replace.end, mealDeduct: replace.mealDeduct } : { ...DEFAULT_TRAINING },
    extraOn: entry?.extra !== undefined,
    extra: entry?.extra ? { ...entry.extra } : defaultExtraRange(planned),
  };
}

/** 평시 1시간 미만일 때만 [식사시간 공제] 체크를 남긴다 (규칙 3) */
function withMealChoice(range: TimeRange): TimeRange {
  const out: TimeRange = { start: range.start, end: range.end };
  if (needsMealChoice(out)) out.mealDeduct = range.mealDeduct ?? true;
  return out;
}

/** 창의 입력을 저장할 변경 기록으로 만든다. 아무것도 안 골랐으면 빈 기록(= 원래대로) */
export function buildDayEntry(form: DayEditForm): DayEntry {
  const entry: DayEntry = {};
  if (form.replace === "휴가") entry.replace = { type: "휴가" };
  if (form.replace === "교육출장") entry.replace = { type: "교육출장", ...withMealChoice(form.training) };
  if (form.extraOn) entry.extra = withMealChoice(form.extra);
  return entry;
}

/** 월간 계산에 넣는 입력 (연·월은 날짜에서 정한다) */
export type DayEditInput = Omit<MonthInput, "year" | "month">;

/**
 * 이 변경을 저장해도 되는지 검사한다. 문제가 있으면 화면에 보여 줄 한국어 안내, 없으면 null.
 * 그날 변경만 바꿔 월간 계산을 돌려, 그날에 생기는 문제(시간 오류·겹침·쉬는 날 휴가)를 알려 준다.
 */
export function checkDayEntry(input: DayEditInput, date: DateString, entry: DayEntry): string | null {
  const { year, month } = yearMonthOf(date);
  const overrides = { ...input.overrides };
  if (entry.replace || entry.extra) overrides[date] = entry;
  else delete overrides[date];

  const result = calculateMonth({ ...input, overrides, year, month });
  return result.issues.find((i) => i.date === date)?.message ?? null;
}

/** 창 맨 위에 보여 줄 그날 정해진 근무 설명 (예: "야간 18:00~다음 날 09:00", "비번") */
export function describePlanned(profiles: readonly Profile[], date: DateString, holidays: ReadonlySet<DateString>): string {
  const p = plannedDay(profiles, date, holidays);
  if (!p.profile || !p.kind) return "등록한 근무 정보가 아직 적용되지 않는 날이에요";
  if (p.kind === "비번" || p.kind === "휴무") return p.kind;
  if (!p.time) return `${p.kind} (근무 시간이 등록되지 않았어요)`;
  if (p.kind === "당직") return `당직 ${p.time.start} 시작 · 24시간`;
  return `${p.kind} ${p.time.start}~${p.time.end <= p.time.start ? "다음 날 " : ""}${p.time.end}`;
}

/** 달력 한 글자 표시 (창 제목 옆 작은 표시용) */
export function plannedShort(planned: PlannedDay): string | null {
  return planned.kind ? DAY_KIND_SHORT[planned.kind] : null;
}
