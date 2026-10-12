// Design Ref: §4.3 — 등록 3단계: 고른 패턴에 들어 있는 근무 종류의 시간 입력
// Plan: 작업 17·18 — 등록 ③ 근무 시간 (주간·야간·심야는 시작 선택지 + 종료 10분 단위,
//   시작은 시(時) 선택지 + 분 10분 단위, 형사 등 부서의 야간은 시·분 모두 자유, 당직은 시작 시각만, 평시 1시간 미만이면 식사 공제 체크)
"use client";

import TimePicker, { ALL_HOURS } from "@/components/TimePicker";
import { needsMealChoice } from "@/lib/overtime/meal";
import { DEFAULT_SHIFT_TIMES, START_HOUR_CHOICES, timedKindsInPattern } from "@/lib/schedule/patterns";
import { formatDuration, parseTime, shiftDurationMinutes } from "@/lib/time";
import {
  FREE_NIGHT_TIME_DEPARTMENTS,
  type DayKind,
  type Department,
  type PatternId,
  type TimeRange,
  type TimedShiftKind,
} from "@/lib/types";

/** 근무 종류별 입력값 */
export type ShiftTimesValue = Partial<Record<TimedShiftKind, TimeRange>>;

/**
 * 고른 패턴에 맞게 입력값을 정리한다: 패턴에 있는 종류는 (없으면) 기본값으로 채우고,
 * 패턴에 없는 종류는 버린다. 이미 입력한 값은 그대로 둔다.
 */
export function prepareShiftTimes(pattern: PatternId, current: ShiftTimesValue, customCycle?: readonly DayKind[]): ShiftTimesValue {
  const next: ShiftTimesValue = {};
  for (const kind of timedKindsInPattern(pattern, customCycle)) next[kind] = current[kind] ?? { ...DEFAULT_SHIFT_TIMES[kind] };
  return next;
}

/** 낱말 뒤에 받침에 맞는 "은/는"을 붙인다 (예: 형사는, 교통안전은) */
export function withTopicParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const hasFinalConsonant = code >= 0 && code < 11172 && code % 28 !== 0;
  return `${word}${hasFinalConsonant ? "은" : "는"}`;
}
interface Props {
  pattern: PatternId;
  /** 직접 만든 패턴(6)의 순환 */
  customCycle?: readonly DayKind[];
  department: Department;
  value: ShiftTimesValue;
  onChange: (value: ShiftTimesValue) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function StepShiftTimes({ pattern, customCycle, department, value, onChange, onNext, onBack }: Props) {
  const kinds = timedKindsInPattern(pattern, customCycle);
  const freeNight = FREE_NIGHT_TIME_DEPARTMENTS.includes(department);

  function setRange(kind: TimedShiftKind, patch: Partial<TimeRange>) {
    const base = value[kind] ?? DEFAULT_SHIFT_TIMES[kind];
    const next = { ...base, ...patch };
    // 당직은 24시간 근무라 종료는 늘 시작과 같다 (규칙 11·12)
    if (kind === "당직") next.end = next.start;
    onChange({ ...value, [kind]: next });
  }

  // 패턴 5(일근)처럼 입력할 근무 시간이 없는 경우
  if (kinds.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <p className="rounded-lg bg-zinc-50 p-4 text-base dark:bg-zinc-900">
          일근은 <b>평일 09:00~18:00</b>로 정해져 있어서 입력할 근무 시간이 없어요.
          <br />
          식사 1시간을 빼고 하루 8시간으로 계산해요.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onBack} className="h-12 flex-1 rounded-lg border border-zinc-300 text-base dark:border-zinc-600">
            이전
          </button>
          <button type="button" onClick={onNext} className="h-12 flex-[2] rounded-lg bg-blue-700 text-base font-bold text-white dark:bg-blue-500">
            다음
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      {kinds.map((kind) => {
        const range = value[kind] ?? DEFAULT_SHIFT_TIMES[kind];
        const duration = shiftDurationMinutes(range.start, range.end);
        // 형사 등 부서의 야간, 그리고 직접 만든 패턴(6)은 시작 시각을 선택지 제한 없이 고른다
        const free = pattern === 6 || (kind === "야간" && freeNight);
        const limited = !free && (kind === "주간" || kind === "야간" || kind === "심야");
        const startHours = limited ? START_HOUR_CHOICES[kind] : ALL_HOURS;
        const askMeal = kind !== "당직" && needsMealChoice(range);
        const nextDay = (parseTime(range.end) ?? 0) <= (parseTime(range.start) ?? 0);

        return (
          <fieldset key={kind} className="rounded-lg border border-zinc-300 p-3 dark:border-zinc-600">
            <legend className="px-1 text-base font-bold">{kind}</legend>
            <div className="flex flex-col gap-2">
              <TimePicker
                label={`${kind} 시작`}
                value={range.start}
                hours={startHours}
                onChange={(start) => setRange(kind, { start })}
              />
              {kind !== "당직" && (
                <TimePicker label={`${kind} 종료`} value={range.end} onChange={(end) => setRange(kind, { end })} />
              )}
            </div>

            {duration !== null && (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {kind === "당직"
                  ? `${range.start}부터 다음 날 ${range.start}까지 24시간 근무로 계산해요.`
                  : `${range.start} ~ ${nextDay ? "다음 날 " : ""}${range.end} · 근무 ${formatDuration(duration)}`}
              </p>
            )}
            {free && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {pattern === 6
                  ? `직접 만든 패턴의 ${kind} 시간을 10분 단위로 자유롭게 정할 수 있어요.`
                  : `${withTopicParticle(department)} 야간 시간을 10분 단위로 자유롭게 정할 수 있어요.`}
              </p>
            )}

            {askMeal && (
              <label className="mt-3 flex min-h-12 cursor-pointer items-center gap-3 rounded-lg bg-zinc-50 px-3 dark:bg-zinc-900">
                <input
                  type="checkbox"
                  checked={range.mealDeduct ?? true}
                  onChange={(e) => setRange(kind, { mealDeduct: e.target.checked })}
                  className="h-5 w-5 accent-blue-700"
                />
                <span className="text-base">
                  식사시간 1시간 공제
                  <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                    낮 시간(22~06시 밖)이 1시간보다 짧아 직접 정해요.
                  </span>
                </span>
              </label>
            )}
          </fieldset>
        );
      })}

      <div className="flex gap-2">
        <button type="button" onClick={onBack} className="h-12 flex-1 rounded-lg border border-zinc-300 text-base dark:border-zinc-600">
          이전
        </button>
        <button type="submit" className="h-12 flex-[2] rounded-lg bg-blue-700 text-base font-bold text-white dark:bg-blue-500">
          다음
        </button>
      </div>
    </form>
  );
}
