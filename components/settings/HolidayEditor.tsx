// Design Ref: §4.5 — 설정의 공휴일: 내장된 공휴일 + 내가 추가한 날 목록, [날짜 추가]/[삭제]
// Plan: 작업 21 — 공휴일 편집 (규칙 15). 바꾼 공휴일은 달력의 빨간 날짜와 휴일·주 기준시간 계산에 바로 반영된다.
"use client";

import { useState } from "react";
import { addHoliday, countHolidaysForYear, holidayRowsForYear, removeHoliday, restoreHoliday, type AddHolidayResult } from "@/lib/holidays/edit";
import { BUILT_IN_HOLIDAYS, COMPUTED_FROM_YEAR } from "@/lib/holidays/kr";
import { changeAppData, useAppData } from "@/lib/storage/useAppData";
import { formatShortDate, isValidDate, todayInKst } from "@/lib/time";

const ADD_MESSAGES: Record<AddHolidayResult, string | null> = {
  added: null,
  restored: null,
  already: "이미 공휴일로 되어 있어요.",
  weekend: "토·일요일은 따로 지정하지 않아도 휴일로 계산돼요.",
  invalid: "날짜를 골라 주세요.",
};

const SAVE_MESSAGES = {
  empty: "먼저 근무를 등록해 주세요.",
  corrupt: "저장된 정보를 읽을 수 없어서 바꾸지 못했어요.",
  "save-failed": "저장하지 못했어요. 이 기기의 저장 공간이 부족하거나 저장이 막혀 있어요.",
  unavailable: "이 브라우저에서는 정보를 저장할 수 없어요.",
} as const;

const BUILT_IN_YEAR_LIST = [...new Set(Object.keys(BUILT_IN_HOLIDAYS).map((d) => Number(d.slice(0, 4))))].sort((a, b) => a - b);
const BUILT_IN_RANGE = `${BUILT_IN_YEAR_LIST[0]}~${BUILT_IN_YEAR_LIST.at(-1)}`;

/** 처음에 보여 주는 줄 수. 나머지는 [더보기]를 눌러야 보인다 */
const VISIBLE_ROWS = 3;

export default function HolidayEditor() {
  const app = useAppData();
  const [year, setYear] = useState(() => Number(todayInKst(new Date()).slice(0, 4)));
  const [date, setDate] = useState("");
  const [message, setMessage] = useState<{ text: string; kind: "error" | "ok" } | null>(null);
  // [더보기]로 펼친 해 (해를 바꾸면 다시 3줄만 보인다)
  const [expandedYear, setExpandedYear] = useState<number | null>(null);

  /** 보는 해를 바꾼다. 펼쳐 둔 목록은 접는다 */
  function goToYear(next: number) {
    setYear(next);
    setExpandedYear(null);
  }

  if (app.status !== "ok") {
    return <p className="text-base text-zinc-600 dark:text-zinc-400">근무를 등록하면 공휴일을 편집할 수 있어요.</p>;
  }
  const data = app.data;
  const rows = holidayRowsForYear(data, year);
  const count = countHolidaysForYear(data, year);
  const expanded = expandedYear === year;
  const shownRows = expanded ? rows : rows.slice(0, VISIBLE_ROWS);
  const hiddenCount = rows.length - shownRows.length;

  /** 저장하고 실패하면 안내 */
  function apply(updater: Parameters<typeof changeAppData>[0]): boolean {
    const result = changeAppData(updater);
    if (result === "ok") return true;
    setMessage({ text: SAVE_MESSAGES[result], kind: "error" });
    return false;
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidDate(date)) {
      setMessage({ text: ADD_MESSAGES.invalid!, kind: "error" });
      return;
    }
    // 어떤 결과가 나올지는 지금 화면의 데이터로 먼저 확인한다 (저장 직전의 데이터와 같다)
    const { result } = addHoliday(data, date);
    const blocked = ADD_MESSAGES[result];
    if (blocked) {
      setMessage({ text: blocked, kind: "error" });
      return;
    }
    if (apply((d) => addHoliday(d, date).data)) {
      goToYear(Number(date.slice(0, 4))); // 추가한 날이 있는 해로 목록을 옮겨 바로 보이게 한다 (3줄 안에 없으면 [더보기]로 볼 수 있다)
      setMessage({ text: `${formatShortDate(date)}을 ${result === "restored" ? "다시 공휴일로 되돌렸어요" : "공휴일로 추가했어요"}.`, kind: "ok" });
      setDate("");
    }
  }

  return (
    <div>
      {/* 해 이동 */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => goToYear(year - 1)}
          aria-label="이전 해"
          className="flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-300 text-xl dark:border-zinc-600"
        >
          ◀
        </button>
        <p className="text-lg font-bold" aria-live="polite">
          {year}년 공휴일 <span className="text-red-600 dark:text-red-400">({count}일)</span>
        </p>
        <button
          type="button"
          onClick={() => goToYear(year + 1)}
          aria-label="다음 해"
          className="flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-300 text-xl dark:border-zinc-600"
        >
          ▶
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {year}년 공휴일은 앱에 들어 있지 않아요(내장: {BUILT_IN_RANGE}년). 평일 공휴일을 아래에서 직접 추가해 주세요.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-300 dark:divide-zinc-700 dark:border-zinc-600">
          {shownRows.map((row) => (
            <li key={row.date} className="flex items-center gap-2 px-3 py-2">
              <div className={`min-w-0 flex-1 text-base ${row.removed ? "text-zinc-500 line-through dark:text-zinc-500" : ""}`}>
                <span className="font-bold">{formatShortDate(row.date)}</span>{" "}
                {row.source === "추가" ? (
                  <span className="rounded bg-blue-100 px-1.5 text-sm text-blue-900 no-underline dark:bg-blue-950 dark:text-blue-200">
                    {row.name}
                  </span>
                ) : (
                  row.name
                )}
                {row.removed && <span className="ml-1 text-sm no-underline">(뺀 날)</span>}
              </div>
              {row.removed ? (
                <button
                  type="button"
                  onClick={() => apply((d) => restoreHoliday(d, row.date))}
                  aria-label={`${formatShortDate(row.date)} ${row.name} 다시 넣기`}
                  className="h-10 shrink-0 rounded-lg border border-blue-700 px-3 text-sm font-bold text-blue-700 dark:border-blue-400 dark:text-blue-400"
                >
                  되돌리기
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => apply((d) => removeHoliday(d, row.date))}
                  aria-label={`${formatShortDate(row.date)} ${row.name} 삭제`}
                  className="h-10 shrink-0 rounded-lg border border-zinc-300 px-3 text-sm dark:border-zinc-600"
                >
                  삭제
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {rows.length > VISIBLE_ROWS && (
        <button
          type="button"
          onClick={() => setExpandedYear(expanded ? null : year)}
          aria-expanded={expanded}
          className="mt-2 h-12 w-full rounded-lg border border-zinc-300 text-base font-bold text-blue-700 dark:border-zinc-600 dark:text-blue-400"
        >
          {expanded ? "접기" : `더보기 (${hiddenCount}개 더)`}
        </button>
      )}

      {year >= COMPUTED_FROM_YEAR && rows.length > 0 && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {COMPUTED_FROM_YEAR}년부터는 법정 규칙과 음력으로 <b>미리 계산한 예상 공휴일</b>이에요. 정부 발표(임시공휴일·선거일 등)와 다르면 아래에서 직접 추가·삭제해 주세요.
        </p>
      )}

      {/* 날짜 추가 */}
      <form onSubmit={handleAdd} noValidate className="mt-4">
        <label htmlFor="holidayDate" className="text-base font-bold">
          공휴일 날짜 추가
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="holidayDate"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setMessage(null);
            }}
            className="h-12 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-background px-3 text-base outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/30 dark:border-zinc-600"
          />
          <button type="submit" className="h-12 shrink-0 rounded-lg bg-blue-700 px-5 text-base font-bold text-white dark:bg-blue-500">
            추가
          </button>
        </div>
        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={`mt-2 text-sm ${message.kind === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}
          >
            {message.text}
          </p>
        )}
      </form>

      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        공휴일이 바뀌면 달력의 빨간 날짜와 초과근무 계산에 바로 반영돼요. 토·일요일은 따로 지정하지 않아도 휴일이에요.
      </p>
    </div>
  );
}
