// Design Ref: §4.3 — [변경]으로 들어온 경우 맨 앞에 "언제부터 적용할까요?" (규칙 16)
// Plan: 작업 19 — 등록 완료와 [변경]
"use client";

import { useState } from "react";
import { isValidDate } from "@/lib/time";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
}

export default function StepEffectiveDate({ value, onChange, onNext }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const error = submitted && !isValidDate(value) ? "적용일을 골라 주세요." : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
        if (isValidDate(value)) onNext();
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      <div>
        <label htmlFor="effectiveFrom" className="text-base font-bold">
          언제부터 적용할까요?
        </label>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          이 날부터 새 근무 정보로 계산해요. 그 전 날짜는 이전 정보로 그대로 계산돼요. (예: 인사발령일)
        </p>
        <input
          id="effectiveFrom"
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "effectiveFrom-error" : undefined}
          className="mt-2 block h-12 w-full rounded-lg border border-zinc-300 bg-background px-3 text-base outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/30 aria-invalid:border-red-600 dark:border-zinc-600"
        />
        {error && (
          <p id="effectiveFrom-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
      <button type="submit" className="h-12 w-full rounded-lg bg-blue-700 text-base font-bold text-white dark:bg-blue-500">
        다음
      </button>
    </form>
  );
}
