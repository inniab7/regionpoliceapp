// Design Ref: §4.3 — 등록 화면: 3단계를 한 화면에 하나씩 (1 소속 → 2 근무 형태 → 3 근무 시간)
// Plan: 작업 15·16·17·18 — 등록 마법사의 틀, 1단계(소속), 2단계(근무 형태), 3단계(근무 시간). 저장은 작업 19.
// 입력 중인 내용은 이 화면 안에서만 들고 있다가, 마지막 [등록 완료] 때 기기에 저장한다.
"use client";

import { useState } from "react";
import StepAffiliation, { type AffiliationValue } from "./StepAffiliation";
import StepPattern, { type PatternValue } from "./StepPattern";
import StepShiftTimes, { prepareShiftTimes, type ShiftTimesValue } from "./StepShiftTimes";

const STEPS = ["소속", "근무 형태", "근무 시간"] as const;

export default function SetupWizard() {
  const [step, setStep] = useState(0);
  const [affiliation, setAffiliation] = useState<AffiliationValue>({ agency: "", department: null, team: "" });
  const [pattern, setPattern] = useState<PatternValue>({ pattern: null, patternStartDate: "" });
  const [times, setTimes] = useState<ShiftTimesValue>({});
  // 3단계까지 입력을 마친 상태 (저장은 작업 19에서 [등록 완료]로 만든다)
  const [finished, setFinished] = useState(false);

  return (
    <section>
      <h1 className="text-2xl font-bold">근무 등록</h1>

      {/* 단계 표시 */}
      <ol className="mt-4 flex gap-2" aria-label="등록 단계">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={`flex-1 rounded-full py-1 text-center text-sm ${
              i === step
                ? "bg-blue-700 font-bold text-white dark:bg-blue-500"
                : i < step
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">
        {STEPS.length}단계 중 {step + 1}단계: {STEPS[step]}
      </p>

      <div className="mt-6">
        {step === 0 && (
          <StepAffiliation value={affiliation} onChange={setAffiliation} onNext={() => setStep(1)} />
        )}

        {step === 1 && (
          <StepPattern
            value={pattern}
            onChange={setPattern}
            onNext={() => {
              // 고른 패턴에 맞춰 근무 시간 입력값을 정리한다 (없는 종류는 버리고, 새 종류는 기본값으로)
              if (pattern.pattern !== null) setTimes((t) => prepareShiftTimes(pattern.pattern!, t));
              setFinished(false);
              setStep(2);
            }}
            onBack={() => setStep(0)}
          />
        )}

        {step === 2 && pattern.pattern !== null && affiliation.department !== null && !finished && (
          <StepShiftTimes
            pattern={pattern.pattern}
            department={affiliation.department}
            value={times}
            onChange={setTimes}
            onNext={() => setFinished(true)}
            onBack={() => setStep(1)}
          />
        )}

        {step === 2 && finished && (
          <div>
            <p className="text-zinc-600 dark:text-zinc-400">
              입력을 마쳤어요. [등록 완료]로 이 기기에 저장하는 기능은 다음 작업에서 만들어요.
            </p>
            <button
              type="button"
              onClick={() => setFinished(false)}
              className="mt-6 h-12 w-full rounded-lg border border-zinc-300 text-base dark:border-zinc-600"
            >
              이전
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
