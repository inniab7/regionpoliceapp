// Design Ref: §4.3 — 등록 2단계: 근무 형태(패턴 1~6 카드, 순환 순서가 보이게) + 패턴 시작일
// Plan: 작업 16 — 등록 ② 근무 형태 (패턴 5는 시작일 생략, 규칙 13). 패턴 6은 사용자가 순환을 직접 만든다.
"use client";

import { useState } from "react";
import { PATTERNS, hasWorkDay } from "@/lib/schedule/patterns";
import { addDays, formatShortDate, isValidDate } from "@/lib/time";
import { PATTERN_IDS, type CustomCycleKind, type DayKind, type PatternId } from "@/lib/types";
import CustomCycleBuilder from "./CustomCycleBuilder";

export interface PatternValue {
  pattern: PatternId | null;
  /** "YYYY-MM-DD", 패턴 5는 쓰지 않음 */
  patternStartDate: string;
  /** 패턴 6(직접 만들기)의 순환. 다른 패턴에서는 쓰지 않음 */
  customCycle: CustomCycleKind[];
}

type Errors = Partial<Record<keyof PatternValue, string>>;

/** 입력 검사. 문제가 없으면 빈 객체 */
export function validatePattern(v: PatternValue): Errors {
  const errors: Errors = {};
  if (v.pattern === null) errors.pattern = "근무 형태를 골라 주세요.";
  else {
    if (v.pattern === 6 && !hasWorkDay(v.customCycle))
      errors.customCycle = "주간·야간·일근 중 근무하는 날이 하루 이상 들어가게 순환을 만들어 주세요.";
    if (v.pattern !== 5 && !isValidDate(v.patternStartDate))
      errors.patternStartDate = "패턴 시작일(첫 번째 근무를 하는 날)을 골라 주세요.";
  }
  return errors;
}

/** 근무 종류별 작은 표시 색 (쉬는 날은 회색) */
function kindClass(kind: DayKind): string {
  if (kind === "비번" || kind === "휴무") return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  if (kind === "당직") return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300";
  return "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200";
}

interface Props {
  value: PatternValue;
  onChange: (value: PatternValue) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function StepPattern({ value, onChange, onNext, onBack }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validatePattern(value) : {};
  const cycle = value.pattern === 6 ? (value.customCycle.length > 0 ? value.customCycle : null) : value.pattern ? PATTERNS[value.pattern].cycle : null;
  const showPreview = cycle !== null && isValidDate(value.patternStartDate);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validatePattern(value)).length === 0) onNext();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <fieldset aria-describedby={errors.pattern ? "pattern-error" : undefined}>
        <legend className="text-base font-bold">근무 형태</legend>
        <div className="mt-2 flex flex-col gap-2">
          {PATTERN_IDS.map((id) => {
            const def = PATTERNS[id];
            const selected = value.pattern === id;
            const custom = id === 6;
            return (
              <label
                key={id}
                className={`cursor-pointer rounded-lg border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-700/40 ${
                  selected ? "border-blue-700 ring-1 ring-blue-700 dark:border-blue-400 dark:ring-blue-400" : "border-zinc-300 dark:border-zinc-600"
                }`}
              >
                <input
                  type="radio"
                  name="pattern"
                  value={id}
                  checked={selected}
                  onChange={() => onChange({ ...value, pattern: id })}
                  aria-label={
                    custom
                      ? "패턴 직접 만들기: 주간, 야간, 일근, 휴무, 비번을 골라 나만의 순환을 만들어요"
                      : def.cycle
                        ? `${def.label}: ${def.cycle.join(", ")}`
                        : `${def.label}: 평일 09:00~18:00 근무, 토·일·공휴일 휴무`
                  }
                  className="sr-only"
                />
                <span className={`text-base ${selected ? "font-bold text-blue-700 dark:text-blue-400" : "font-bold"}`}>
                  {def.label}
                </span>
                {custom ? (
                  <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">
                    주간·야간·일근·휴무·비번을 골라 나만의 순환을 만들어요 (형사·수사 등)
                  </span>
                ) : def.cycle ? (
                  <span className="mt-2 flex flex-wrap gap-1" aria-label={`순환: ${def.cycle.join(", ")}`}>
                    {def.cycle.map((kind, i) => (
                      <span key={i} className={`rounded px-1.5 py-0.5 text-sm ${kindClass(kind)}`} aria-hidden="true">
                        {kind}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">
                    평일 09:00~18:00 근무, 토·일·공휴일 휴무
                  </span>
                )}
              </label>
            );
          })}
        </div>
        {errors.pattern && (
          <p id="pattern-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.pattern}
          </p>
        )}
      </fieldset>

      {value.pattern === 6 && (
        <CustomCycleBuilder value={value.customCycle} onChange={(customCycle) => onChange({ ...value, customCycle })} error={errors.customCycle} />
      )}

      {value.pattern !== null && value.pattern !== 5 && (
        <div>
          <label htmlFor="patternStartDate" className="text-base font-bold">
            패턴 시작일
          </label>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            위 순환의 <b>첫 번째 근무</b>({cycle?.[0]})를 하는 날을 골라 주세요. 지난 날짜여도 괜찮아요.
          </p>
          <input
            id="patternStartDate"
            name="patternStartDate"
            type="date"
            value={value.patternStartDate}
            onChange={(e) => onChange({ ...value, patternStartDate: e.target.value })}
            aria-invalid={errors.patternStartDate ? true : undefined}
            aria-describedby={errors.patternStartDate ? "patternStartDate-error" : undefined}
            className="mt-2 block h-12 w-full rounded-lg border border-zinc-300 bg-background px-3 text-base outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/30 aria-invalid:border-red-600 dark:border-zinc-600"
          />
          {errors.patternStartDate && (
            <p id="patternStartDate-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.patternStartDate}
            </p>
          )}

          {/* 미리보기: 시작일부터 한 순환 동안의 근무 */}
          {showPreview && cycle && (
            <div className="mt-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
              <p className="text-sm font-bold">미리보기</p>
              <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                {cycle.map((kind, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{formatShortDate(addDays(value.patternStartDate, i))}</span>
                    <span className={`rounded px-1.5 ${kindClass(kind)}`}>{kind}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="h-12 flex-1 rounded-lg border border-zinc-300 text-base dark:border-zinc-600"
        >
          이전
        </button>
        <button type="submit" className="h-12 flex-[2] rounded-lg bg-blue-700 text-base font-bold text-white dark:bg-blue-500">
          다음
        </button>
      </div>
    </form>
  );
}
