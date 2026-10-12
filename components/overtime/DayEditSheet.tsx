// Design Ref: §4.2 — 날짜를 누르면 아래에서 올라오는 근무 변경 창: [휴가] / [교육·출장] / [추가 근무] / [원래대로]
// Plan: 작업 22 — 근무 변경 입력. 입력을 검사해(규칙 4·14) 통과하면 그날 변경으로 기기에 저장한다.
// 부모가 날짜마다 key를 달아 새로 그리므로, 처음 입력 상태는 그 날짜의 저장된 변경에서 한 번만 만든다.
"use client";

import { useEffect, useRef, useState } from "react";
import TimePicker from "@/components/TimePicker";
import { holidayName } from "@/lib/holidays/kr";
import {
  buildDayEntry,
  canTakeLeave,
  checkDayEntry,
  describePlanned,
  initialDayForm,
  type DayEditForm,
  type DayEditInput,
  type ReplaceChoice,
} from "@/lib/overtime/dayEdit";
import { needsMealChoice } from "@/lib/overtime/meal";
import { plannedDay } from "@/lib/schedule/generate";
import { setDayEntry } from "@/lib/storage/store";
import { changeAppData } from "@/lib/storage/useAppData";
import { formatDuration, formatShortDate, parseTime, shiftDurationMinutes } from "@/lib/time";
import type { DateString, TimeRange } from "@/lib/types";

const SAVE_MESSAGES = {
  empty: "먼저 근무를 등록해 주세요.",
  corrupt: "저장된 정보를 읽을 수 없어서 바꾸지 못했어요.",
  "save-failed": "저장하지 못했어요. 이 기기의 저장 공간이 부족하거나 저장이 막혀 있어요.",
  unavailable: "이 브라우저에서는 정보를 저장할 수 없어요.",
} as const;

/** 시간 요약 (예: "09:00 ~ 다음 날 08:00 · 근무 23시간 00분") */
function rangeSummary(range: TimeRange): string | null {
  const minutes = shiftDurationMinutes(range.start, range.end);
  if (minutes === null) return null;
  const nextDay = (parseTime(range.end) ?? 0) <= (parseTime(range.start) ?? 0);
  return `${range.start} ~ ${nextDay ? "다음 날 " : ""}${range.end} · 근무 ${formatDuration(minutes)}`;
}

/** 시작·종료 입력과 요약, 식사 공제 체크 한 묶음 */
function RangeInput({
  name,
  value,
  onChange,
}: {
  name: string;
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}) {
  const summary = rangeSummary(value);
  return (
    <div className="mt-2 flex flex-col gap-2">
      <TimePicker label={`${name} 시작`} value={value.start} onChange={(start) => onChange({ ...value, start })} />
      <TimePicker label={`${name} 종료`} value={value.end} onChange={(end) => onChange({ ...value, end })} />
      {summary && <p className="text-sm text-zinc-600 dark:text-zinc-400">{summary}</p>}
      {needsMealChoice(value) && (
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg bg-zinc-50 px-3 dark:bg-zinc-900">
          <input
            type="checkbox"
            checked={value.mealDeduct ?? true}
            onChange={(e) => onChange({ ...value, mealDeduct: e.target.checked })}
            className="h-5 w-5 accent-blue-700"
          />
          <span className="text-base">
            식사시간 1시간 공제
            <span className="block text-sm text-zinc-600 dark:text-zinc-400">낮 시간(22~06시 밖)이 1시간보다 짧아 직접 정해요.</span>
          </span>
        </label>
      )}
    </div>
  );
}

interface Props {
  date: DateString;
  /** 월간 계산에 쓰는 데이터 (등록 이력·저장된 변경·공휴일) */
  input: DayEditInput;
  onClose: () => void;
}

export default function DayEditSheet({ date, input, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const planned = plannedDay(input.profiles, date, input.holidays);
  const savedEntry = input.overrides[date];
  const hasSaved = savedEntry !== undefined && (savedEntry.replace !== undefined || savedEntry.extra !== undefined);
  const leaveAllowed = canTakeLeave(planned);
  const extraLabel = planned.profile?.pattern === 5 ? "초과근무" : "추가 근무(동원)";

  const [form, setForm] = useState<DayEditForm>(() => initialDayForm(savedEntry, planned));
  const [error, setError] = useState<string | null>(null);

  // 창을 열 때 브라우저의 모달 기능을 쓴다 (포커스 가두기·ESC 닫기·뒷배경 가림이 자동으로 된다)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function save() {
    const entry = buildDayEntry(form);
    const problem = checkDayEntry(input, date, entry);
    if (problem) {
      setError(problem);
      return;
    }
    const result = changeAppData((d) => setDayEntry(d, date, entry));
    if (result === "ok") onClose();
    else setError(SAVE_MESSAGES[result]);
  }

  function reset() {
    const result = changeAppData((d) => setDayEntry(d, date, {}));
    if (result === "ok") onClose();
    else setError(SAVE_MESSAGES[result]);
  }

  const holiday = holidayName(date, input.holidays);
  const choices: [ReplaceChoice, string][] = [
    ["none", "바꾸지 않음"],
    ...(leaveAllowed ? ([["휴가", "휴가 (연가·병가)"]] as [ReplaceChoice, string][]) : []),
    ["교육출장", "교육·출장"],
  ];

  return (
    <dialog
      ref={dialogRef}
      // Esc 키: 브라우저가 알아서 닫게 두지 않고, 화면 상태(선택한 날짜)를 비워 함께 닫는다
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // 다른 이유로 브라우저가 창을 닫은 경우에도 화면 상태를 맞춘다
      onClose={onClose}
      onClick={(e) => {
        // 어두운 뒷배경을 누르면 닫는다
        if (e.target === dialogRef.current) onClose();
      }}
      aria-labelledby="dayEditTitle"
      className="fixed inset-x-0 bottom-0 top-auto m-0 mx-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-foreground shadow-xl backdrop:bg-black/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="dayEditTitle" className="text-xl font-bold">
            {formatShortDate(date)}
            {holiday ? ` · ${holiday}` : ""}
          </h2>
          <p className="mt-0.5 text-base text-zinc-600 dark:text-zinc-400">
            정해진 근무: {describePlanned(input.profiles, date, input.holidays)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-xl"
        >
          ✕
        </button>
      </div>

      {!planned.profile ? (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-base text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          이 날짜에는 등록한 근무 정보가 아직 적용되지 않아서 바꿀 수 없어요.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          noValidate
          className="mt-4 flex flex-col gap-5"
        >
          <fieldset>
            <legend className="text-base font-bold">그날 근무를 바꾸기</legend>
            <div className="mt-2 flex flex-col gap-2">
              {choices.map(([value, label]) => (
                <label
                  key={value}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 ${
                    form.replace === value ? "border-blue-700 bg-blue-50 dark:border-blue-400 dark:bg-blue-950" : "border-zinc-300 dark:border-zinc-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="replace"
                    value={value}
                    checked={form.replace === value}
                    onChange={() => {
                      setForm({ ...form, replace: value });
                      setError(null);
                    }}
                    className="h-5 w-5 accent-blue-700"
                  />
                  <span className="text-base">{label}</span>
                </label>
              ))}
            </div>
            {!leaveAllowed && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">쉬는 날에는 휴가를 고를 수 없어요.</p>}
            {form.replace === "교육출장" && (
              <RangeInput
                name="교육·출장"
                value={form.training}
                onChange={(training) => {
                  setForm({ ...form, training });
                  setError(null);
                }}
              />
            )}
          </fieldset>

          <div>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-zinc-300 px-3 dark:border-zinc-600">
              <input
                type="checkbox"
                checked={form.extraOn}
                onChange={(e) => {
                  setForm({ ...form, extraOn: e.target.checked });
                  setError(null);
                }}
                className="h-5 w-5 accent-blue-700"
              />
              <span className="text-base font-bold">{extraLabel}</span>
            </label>
            {form.extraOn && (
              <>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">정해진 근무시간 밖의 시간만 입력해 주세요.</p>
                <RangeInput
                  name={extraLabel}
                  value={form.extra}
                  onChange={(extra) => {
                    setForm({ ...form, extra });
                    setError(null);
                  }}
                />
              </>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-base text-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            {hasSaved && (
              <button
                type="button"
                onClick={reset}
                className="h-12 flex-1 rounded-lg border border-red-600 text-base font-bold text-red-700 dark:border-red-400 dark:text-red-400"
              >
                원래대로
              </button>
            )}
            <button type="submit" className="h-12 flex-[2] rounded-lg bg-blue-700 text-base font-bold text-white dark:bg-blue-500">
              저장
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
