// Design Ref: §4.2 — 초과근무 화면: 달 이동, 오늘 근무 카드, 근무표 달력
// Plan: 작업 20·22 — 근무표 달력과 근무 변경 창. 결과 4줄(작업 23)은 이후에 이 화면에 붙인다.
"use client";

import { useMemo, useState } from "react";
import { BUILT_IN_HOLIDAYS, effectiveHolidays, holidayName } from "@/lib/holidays/kr";
import { isSameMonth, monthLabel, shiftMonth, yearMonthOf, type YearMonth } from "@/lib/overtime/calendar";
import { calculateMonth } from "@/lib/overtime/monthly";
import { plannedDay } from "@/lib/schedule/generate";
import { formatShortDate, todayInKst } from "@/lib/time";
import type { DateString, SavedData } from "@/lib/types";
import DayEditSheet from "./DayEditSheet";
import MonthCalendar, { CalendarLegend } from "./MonthCalendar";
import TodayCard from "./TodayCard";

/** 내장 공휴일 목록이 있는 해 (그 밖의 해는 공휴일을 직접 추가해야 한다) */
const BUILT_IN_YEARS = new Set(Object.keys(BUILT_IN_HOLIDAYS).map((d) => Number(d.slice(0, 4))));

export default function OvertimeScreen({ data }: { data: SavedData }) {
  // 오늘 날짜는 화면을 처음 그릴 때 한 번 정한다 (한국 시간 기준)
  const [today] = useState(() => todayInKst(new Date()));
  const [shown, setShown] = useState<YearMonth>(() => yearMonthOf(today));
  // 눌러서 근무를 바꾸고 있는 날짜 (없으면 창이 닫혀 있다)
  const [selectedDate, setSelectedDate] = useState<DateString | null>(null);
  const currentMonth = yearMonthOf(today);

  const holidays = useMemo(
    () => effectiveHolidays(data.holidaysAdded, data.holidaysRemoved),
    [data.holidaysAdded, data.holidaysRemoved],
  );

  const input = useMemo(
    () => ({ profiles: data.profiles, overrides: data.overrides, holidays }),
    [data.profiles, data.overrides, holidays],
  );

  // 보고 있는 달의 날짜별 정보
  const month = useMemo(() => calculateMonth({ ...input, year: shown.year, month: shown.month }), [input, shown]);
  const dayMap = useMemo(() => new Map(month.days.map((d) => [d.date, d])), [month]);

  // 오늘 카드는 보고 있는 달과 상관없이 오늘이 속한 달로 계산한다
  const todayMonth = useMemo(
    () => (isSameMonth(shown, currentMonth) ? month : calculateMonth({ ...input, ...currentMonth })),
    [input, shown, currentMonth, month],
  );
  const planned = plannedDay(data.profiles, today, holidays);

  // 같은 내용의 안내(예: 야간 근무시간 미등록)는 하나로 묶고 며칠인지 센다
  const issueGroups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const issue of month.issues) counts.set(issue.message, (counts.get(issue.message) ?? 0) + 1);
    return [...counts.entries()];
  }, [month.issues]);

  const monthHolidays =month.days.filter((d) => d.holidayName).map((d) => `${formatShortDate(d.date)} ${d.holidayName}`);
  const viewingCurrent = isSameMonth(shown, currentMonth);

  return (
    <section>
      <h1 className="text-2xl font-bold">초과근무</h1>

      <div className="mt-3">
        <TodayCard
          today={today}
          planned={planned}
          day={todayMonth.days.find((d) => d.date === today)}
          holidayName={holidayName(today, holidays)}
        />
      </div>

      {/* 달 이동 */}
      <div className="mt-5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShown(shiftMonth(shown, -1))}
          aria-label="이전 달"
          className="flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-300 text-xl dark:border-zinc-600"
        >
          ◀
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold" aria-live="polite">
            {monthLabel(shown)}
          </h2>
          {!viewingCurrent && (
            <button
              type="button"
              onClick={() => setShown(currentMonth)}
              className="text-sm font-bold text-blue-700 underline dark:text-blue-400"
            >
              이번 달로
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShown(shiftMonth(shown, 1))}
          aria-label="다음 달"
          className="flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-300 text-xl dark:border-zinc-600"
        >
          ▶
        </button>
      </div>

      <div className="mt-2">
        <MonthCalendar year={shown.year} month={shown.month} days={dayMap} today={today} onSelect={setSelectedDate} />
        <CalendarLegend />
      </div>

      {monthHolidays.length > 0 && (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-bold text-red-600 dark:text-red-400">공휴일</span> {monthHolidays.join(" · ")}
        </p>
      )}

      {!BUILT_IN_YEARS.has(shown.year) && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {shown.year}년 공휴일은 아직 앱에 들어 있지 않아요. 평일 공휴일은 설정의 「공휴일」에서 직접 추가해 주세요.
        </p>
      )}

      {issueGroups.length > 0 && (
        <div role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-bold">확인이 필요해요</p>
          <ul className="mt-1 list-disc pl-5">
            {issueGroups.slice(0, 5).map(([message, count]) => (
              <li key={message}>
                {message}
                {count > 1 ? ` (${count}일)` : ""}
              </li>
            ))}
          </ul>
          {issueGroups.length > 5 && <p className="mt-1">외 {issueGroups.length - 5}건</p>}
        </div>
      )}

      {selectedDate && <DayEditSheet key={selectedDate} date={selectedDate} input={input} onClose={() => setSelectedDate(null)} />}
    </section>
  );
}
