// Design Ref: §4.3 — 등록 3단계: 고른 패턴에 들어 있는 근무 종류의 시간 입력
// Plan: 작업 17·18 — 등록 ③ 근무 시간 (주간·야간·심야는 시작 선택지 + 종료 10분 단위,
//   형사 등 부서의 야간은 시작·종료 모두 자유, 당직은 시작 시각만, 평시 1시간 미만이면 식사 공제 체크)
"use client";

import { needsMealChoice } from "@/lib/overtime/meal";
import { DEFAULT_SHIFT_TIMES, START_HOUR_CHOICES, timedKindsInPattern } from "@/lib/schedule/patterns";
import { formatDuration, formatTime, parseTime, shiftDurationMinutes } from "@/lib/time";
import {
  FREE_NIGHT_TIME_DEPARTMENTS,
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
export function prepareShiftTimes(pattern: PatternId, current: ShiftTimesValue): ShiftTimesValue {
  const next: ShiftTimesValue = {};
  for (const kind of timedKindsInPattern(pattern)) next[kind] = current[kind] ?? { ...DEFAULT_SHIFT_TIMES[kind] };
  return next;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 낱말 뒤에 받침에 맞는 "은/는"을 붙인다 (예: 형사는, 교통안전은) */
export function withTopicParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const hasFinalConsonant = code >= 0 && code < 11172 && code % 28 !== 0;
  return `${word}${hasFinalConsonant ? "은" : "는"}`;
}
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 10, 20, 30, 40, 50];

const selectClass =
  "h-12 w-full rounded-lg border border-zinc-300 bg-background px-2 text-base outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/30 dark:border-zinc-600";

/** 시·분 두 칸으로 시각을 고른다 (분은 10분 단위) */
function TimePicker({
  label,
  value,
  onChange,
  hours = HOURS,
  fixedMinute = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hours?: readonly number[];
  /** true면 분은 00으로 고정 (시작 시각을 정해진 시(時) 중에서 고를 때) */
  fixedMinute?: boolean;
}) {
  const total = parseTime(value) ?? 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-base">{label.split(" ").at(-1)}</span>
      <select
        aria-label={`${label} 시`}
        value={h}
        onChange={(e) => onChange(formatTime(Number(e.target.value) * 60 + (fixedMinute ? 0 : m)))}
        className={selectClass}
      >
        {hours.map((hour) => (
          <option key={hour} value={hour}>
            {pad(hour)}시
          </option>
        ))}
      </select>
      {fixedMinute ? (
        <span className="w-full text-center text-base text-zinc-600 dark:text-zinc-400">00분</span>
      ) : (
        <select
          aria-label={`${label} 분`}
          value={m}
          onChange={(e) => onChange(formatTime(h * 60 + Number(e.target.value)))}
          className={selectClass}
        >
          {MINUTES.map((minute) => (
            <option key={minute} value={minute}>
              {pad(minute)}분
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

interface Props {
  pattern: PatternId;
  department: Department;
  value: ShiftTimesValue;
  onChange: (value: ShiftTimesValue) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function StepShiftTimes({ pattern, department, value, onChange, onNext, onBack }: Props) {
  const kinds = timedKindsInPattern(pattern);
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
        const free = kind === "야간" && freeNight;
        const startHours = kind === "당직" || free ? HOURS : START_HOUR_CHOICES[kind];
        const fixedStartMinute = kind !== "당직" && !free;
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
                fixedMinute={fixedStartMinute}
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
                {withTopicParticle(department)} 야간 시간을 10분 단위로 자유롭게 정할 수 있어요.
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
