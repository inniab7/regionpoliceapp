// Design Ref: §4.3 — 등록 2단계의 「패턴 직접 만들기」: 주간·야간·일근·휴무·비번을 눌러 하루씩 순서대로 쌓는다
// Plan: 패턴 6 — 형사·수사처럼 정해진 패턴이 없는 부서가 자기 순환을 만든다. 만든 순환이 시작일부터 계속 반복된다.
"use client";

import { CUSTOM_CYCLE_KINDS, MAX_CUSTOM_CYCLE_DAYS, type CustomCycleKind } from "@/lib/types";

/** 근무 종류별 작은 표시 색 (쉬는 날은 회색) */
function kindClass(kind: CustomCycleKind): string {
  if (kind === "비번" || kind === "휴무") return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  return "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200";
}

interface Props {
  value: CustomCycleKind[];
  onChange: (value: CustomCycleKind[]) => void;
  error?: string;
}

export default function CustomCycleBuilder({ value, onChange, error }: Props) {
  const full = value.length >= MAX_CUSTOM_CYCLE_DAYS;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
      <p className="text-base font-bold">패턴 만들기</p>
      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
        하루씩 순서대로 눌러 주세요. 만든 순서가 <b>시작일부터 계속 반복</b>돼요. (최대 {MAX_CUSTOM_CYCLE_DAYS}일)
      </p>

      <div className="mt-3 grid grid-cols-5 gap-1.5" role="group" aria-label="하루 추가">
        {CUSTOM_CYCLE_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={full}
            onClick={() => onChange([...value, kind])}
            aria-label={`${kind} 추가`}
            className={`h-12 rounded-lg border border-zinc-300 text-base font-bold disabled:opacity-40 dark:border-zinc-600 ${kindClass(kind)}`}
          >
            {kind}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {value.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">아직 아무것도 고르지 않았어요. 위 버튼을 눌러 첫째 날부터 쌓아 주세요.</p>
        ) : (
          <ol className="flex flex-wrap gap-1.5" aria-label="만든 순환">
            {value.map((kind, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                  aria-label={`${i + 1}일째 ${kind} 지우기`}
                  className={`flex h-10 items-center gap-1 rounded-lg px-2 text-sm ${kindClass(kind)}`}
                >
                  <span className="text-xs opacity-70">{i + 1}</span>
                  <span className="font-bold">{kind}</span>
                  <span aria-hidden="true" className="opacity-60">
                    ✕
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            <b>{value.length}일</b>마다 반복돼요
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onChange(value.slice(0, -1))}
              className="h-10 whitespace-nowrap rounded-lg border border-zinc-300 px-3 text-sm dark:border-zinc-600"
            >
              마지막 지우기
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="h-10 whitespace-nowrap rounded-lg border border-red-600 px-3 text-sm text-red-700 dark:border-red-400 dark:text-red-400"
            >
              모두 지우기
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
