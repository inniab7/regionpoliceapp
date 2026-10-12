// Design Ref: §4.3 — 등록 화면: 한 화면에 한 단계 (첫 등록 3단계, [변경]은 맨 앞에 적용일)
// Plan: 작업 15~19 — 소속 → 근무 형태 → 근무 시간 → 요약 → [등록 완료]로 이 기기에 저장
// 입력 중인 내용은 이 화면 안에서만 들고 있다가, 마지막 [등록 완료] 때 기기에 저장한다.
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FIRST_PROFILE_EFFECTIVE_FROM, buildProfile, registerProfile } from "@/lib/storage/profile";
import { appStore, notifyDataChanged, useAppData } from "@/lib/storage/useAppData";
import { profileOn } from "@/lib/storage/store";
import { todayInKst } from "@/lib/time";
import type { Profile } from "@/lib/types";
import { profileRows } from "./profileRows";
import StepAffiliation, { type AffiliationValue } from "./StepAffiliation";
import StepEffectiveDate from "./StepEffectiveDate";
import StepPattern, { type PatternValue } from "./StepPattern";
import StepShiftTimes, { prepareShiftTimes, type ShiftTimesValue } from "./StepShiftTimes";

type Mode = "first" | "change";
type StepName = "적용일" | "소속" | "근무 형태" | "근무 시간";

const STEPS: Record<Mode, readonly StepName[]> = {
  first: ["소속", "근무 형태", "근무 시간"],
  change: ["적용일", "소속", "근무 형태", "근무 시간"],
};

const STATE_MESSAGES: Record<"unavailable" | "corrupt", string> = {
  unavailable: "이 브라우저에서는 정보를 저장할 수 없어요. 사생활 보호 모드라면 끄고 다시 열어 주세요.",
  corrupt: "저장된 정보를 읽을 수 없어요. 새로 등록하면 이전에 저장된 정보는 지워져요.",
};

/** 입력 시작값: 첫 등록은 비어 있고, [변경]은 지금 적용 중인 등록 정보에서 가져온다 */
function initialValues(current: Profile | null, today: string) {
  const affiliation: AffiliationValue = current
    ? { agency: current.agency, department: current.department, team: current.team }
    : { agency: "", department: null, team: "" };
  const pattern: PatternValue = current
    ? { pattern: current.pattern, patternStartDate: current.patternStartDate ?? "" }
    : { pattern: null, patternStartDate: "" };
  const times: ShiftTimesValue = current ? prepareShiftTimes(current.pattern, current.shiftTimes) : {};
  return { affiliation, pattern, times, effectiveFrom: today };
}

export default function SetupWizard({ mode }: { mode: Mode }) {
  const router = useRouter();
  const app = useAppData();

  // 첫 등록 화면인데 이미 등록되어 있으면 첫 화면으로 보낸다 ([변경]은 설정에서 들어온다)
  useEffect(() => {
    if (mode === "first" && app.status === "ok" && app.data.profiles.length > 0) router.replace("/");
  }, [mode, app.status, app, router]);

  if (app.status === "loading") return <p className="text-zinc-600 dark:text-zinc-400">불러오는 중…</p>;
  if (mode === "first" && app.status === "ok" && app.data.profiles.length > 0) return null;

  // [변경]인데 등록한 적이 없으면 첫 등록으로 안내
  if (mode === "change" && (app.status === "empty" || (app.status === "ok" && app.data.profiles.length === 0))) {
    return (
      <section>
        <h1 className="text-2xl font-bold">근무 정보 변경</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">아직 등록한 근무 정보가 없어요. 먼저 등록해 주세요.</p>
        <button
          type="button"
          onClick={() => router.push("/setup")}
          className="mt-6 h-12 w-full rounded-lg bg-blue-700 text-base font-bold text-white dark:bg-blue-500"
        >
          근무 등록하기
        </button>
      </section>
    );
  }

  const today = todayInKst(new Date());
  const current = app.status === "ok" ? profileOn(app.data, today) ?? app.data.profiles.at(-1) ?? null : null;
  const problem = app.status === "unavailable" || app.status === "corrupt" ? app.status : null;

  return <WizardForm mode={mode} initial={initialValues(mode === "change" ? current : null, today)} problem={problem} />;
}

function WizardForm({
  mode,
  initial,
  problem,
}: {
  mode: Mode;
  initial: ReturnType<typeof initialValues>;
  problem: "unavailable" | "corrupt" | null;
}) {
  const router = useRouter();
  const steps = STEPS[mode];
  const [step, setStep] = useState(0);
  const [summary, setSummary] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(initial.effectiveFrom);
  const [affiliation, setAffiliation] = useState<AffiliationValue>(initial.affiliation);
  const [pattern, setPattern] = useState<PatternValue>(initial.pattern);
  const [times, setTimes] = useState<ShiftTimesValue>(initial.times);

  const name = steps[step];
  const last = step === steps.length - 1;

  /** 지금까지의 입력을 등록 정보로 만든다 (요약·저장용). 입력이 덜 끝났으면 null */
  function currentProfile(): Profile | null {
    if (affiliation.department === null || pattern.pattern === null) return null;
    return buildProfile({
      effectiveFrom: mode === "first" ? FIRST_PROFILE_EFFECTIVE_FROM : effectiveFrom,
      agency: affiliation.agency,
      department: affiliation.department,
      team: affiliation.team,
      pattern: pattern.pattern,
      patternStartDate: pattern.patternStartDate,
      shiftTimes: times,
    });
  }

  function handleSave(profile: Profile) {
    const store = appStore();
    if (!store) {
      setSaveError(STATE_MESSAGES.unavailable);
      return;
    }
    const result = registerProfile(store, profile, new Date().toISOString(), { replaceCorrupt: mode === "first" });
    if (result === "ok") {
      notifyDataChanged();
      router.push("/");
    } else if (result === "corrupt") {
      setSaveError("저장된 정보를 읽을 수 없어서 바꾸지 못했어요. 설정에서 백업 파일을 불러오거나 새로 등록해 주세요.");
    } else {
      setSaveError("저장하지 못했어요. 이 기기의 저장 공간이 부족하거나 저장이 막혀 있어요.");
    }
  }

  const profile = summary ? currentProfile() : null;

  return (
    <section>
      <h1 className="text-2xl font-bold">{mode === "first" ? "근무 등록" : "근무 정보 변경"}</h1>

      {problem && (
        <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {STATE_MESSAGES[problem]}
        </p>
      )}

      {/* 단계 표시 */}
      <ol className="mt-4 flex gap-1.5" aria-label="등록 단계">
        {steps.map((label, i) => (
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
        {steps.length}단계 중 {step + 1}단계: {summary ? "입력 확인" : name}
      </p>

      <div className="mt-6">
        {summary && profile ? (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold">입력한 내용을 확인해 주세요</h2>
            <dl className="divide-y divide-zinc-200 rounded-lg border border-zinc-300 dark:divide-zinc-700 dark:border-zinc-600">
              {profileRows(profile).map(([label, value]) => (
                <div key={label} className="flex gap-3 px-3 py-2 text-base">
                  <dt className="w-24 shrink-0 text-zinc-600 dark:text-zinc-400">{label}</dt>
                  <dd className="min-w-0 flex-1 break-words">{value}</dd>
                </div>
              ))}
            </dl>
            {saveError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {saveError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSaveError(null);
                  setSummary(false);
                }}
                className="h-12 flex-1 rounded-lg border border-zinc-300 text-base dark:border-zinc-600"
              >
                이전
              </button>
              <button
                type="button"
                onClick={() => handleSave(profile)}
                className="h-12 flex-[2] rounded-lg bg-blue-700 text-base font-bold text-white dark:bg-blue-500"
              >
                등록 완료
              </button>
            </div>
          </div>
        ) : (
          <>
            {name === "적용일" && (
              <StepEffectiveDate value={effectiveFrom} onChange={setEffectiveFrom} onNext={() => setStep(step + 1)} />
            )}

            {name === "소속" && (
              <StepAffiliation
                value={affiliation}
                onChange={setAffiliation}
                onNext={() => setStep(step + 1)}
                onBack={step > 0 ? () => setStep(step - 1) : undefined}
              />
            )}

            {name === "근무 형태" && (
              <StepPattern
                value={pattern}
                onChange={setPattern}
                onNext={() => {
                  // 고른 패턴에 맞춰 근무 시간 입력값을 정리한다 (없는 종류는 버리고, 새 종류는 기본값으로)
                  if (pattern.pattern !== null) setTimes((t) => prepareShiftTimes(pattern.pattern!, t));
                  setStep(step + 1);
                }}
                onBack={() => setStep(step - 1)}
              />
            )}

            {name === "근무 시간" && pattern.pattern !== null && affiliation.department !== null && (
              <StepShiftTimes
                pattern={pattern.pattern}
                department={affiliation.department}
                value={times}
                onChange={setTimes}
                onNext={() => (last ? setSummary(true) : setStep(step + 1))}
                onBack={() => setStep(step - 1)}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
