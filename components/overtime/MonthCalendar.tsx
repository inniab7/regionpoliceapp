// Design Ref: §4.2 — 근무표 달력: 날짜마다 근무 한 글자, 토·일·공휴일은 빨간 날짜, ● 변경, + 추가 근무, 다른 달 칸은 비움
// Plan: 작업 20·22 — 근무표 달력. 날짜 칸을 누르면 onSelect로 알려, 근무를 바꾸는 창(DayEditSheet)을 연다.
import { monthGrid } from "@/lib/overtime/calendar";
import type { MonthDay } from "@/lib/overtime/monthly";
import { DAY_KIND_SHORT } from "@/lib/schedule/patterns";
import type { DateString, DayKind } from "@/lib/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 근무 종류별 작은 표시 색 (쉬는 날은 회색, 당직은 노랑, 일근은 초록) */
function badgeClass(kind: DayKind): string {
  switch (kind) {
    case "주간":
      return "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200";
    case "야간":
      return "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200";
    case "심야":
      return "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200";
    case "당직":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
    case "일근":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }
}

/** 휴가·교육출장으로 바꾼 날의 표시 */
const REPLACED_LABEL = { 휴가: "연가", 교육출장: "교육" } as const;

interface Props {
  year: number;
  month: number;
  /** 날짜 → 그날 정보 (calculateMonth 결과) */
  days: ReadonlyMap<DateString, MonthDay>;
  /** 오늘 날짜 (이 달이 아니면 표시되지 않음) */
  today: DateString;
  /** 날짜 칸을 눌렀을 때 */
  onSelect?: (date: DateString) => void;
}

export default function MonthCalendar({ year, month, days, today, onSelect }: Props) {
  const rows = monthGrid(year, month);

  return (
    <table className="w-full table-fixed border-separate border-spacing-0.5 text-center">
      <caption className="sr-only">
        {year}년 {month}월 근무표
      </caption>
      <thead>
        <tr>
          {WEEKDAYS.map((w, i) => (
            <th
              key={w}
              scope="col"
              className={`py-1 text-sm font-bold ${i === 0 ? "text-red-600 dark:text-red-400" : i === 6 ? "text-blue-700 dark:text-blue-400" : ""}`}
            >
              {w}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((date, c) => {
              if (!date) return <td key={c} aria-hidden="true" />;
              const d = days.get(date);
              const day = Number(date.slice(8));
              const isToday = date === today;
              const kind = d?.plannedKind ?? null;
              const label = kind ? DAY_KIND_SHORT[kind] : null;
              // 읽어 주는 설명: "10월 6일 화요일 야간, 변경됨"
              const spoken = [
                `${month}월 ${day}일 ${WEEKDAYS[c]}요일`,
                d?.holidayName ? d.holidayName : null,
                kind,
                d?.replacedBy ? (d.replacedBy === "휴가" ? "휴가" : "교육·출장") : null,
                d?.hasExtra ? "추가 근무" : null,
                d?.hasIssue ? "확인 필요" : null,
              ]
                .filter(Boolean)
                .join(", ");

              return (
                <td
                  key={c}
                  className={`relative h-14 rounded-md p-0 align-top ${
                    isToday ? "ring-2 ring-blue-700 dark:ring-blue-400" : "border border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  {/* 날짜 칸 전체가 버튼: 누르면 그날 근무를 바꾸는 창이 열린다 */}
                  <button
                    type="button"
                    onClick={() => onSelect?.(date)}
                    aria-label={`${spoken}. 눌러서 근무 바꾸기`}
                    className="block h-full w-full rounded-md focus-visible:outline-2 focus-visible:outline-blue-700 active:bg-zinc-100 dark:active:bg-zinc-800"
                  >
                  <span
                    className={`block pt-0.5 text-sm leading-tight ${
                      d?.restDay ? "font-bold text-red-600 dark:text-red-400" : ""
                    }`}
                    aria-hidden="true"
                  >
                    {day}
                  </span>

                  {d?.replacedBy ? (
                    <span
                      aria-hidden="true"
                      className="mx-auto mt-0.5 block w-fit rounded bg-rose-100 px-1 text-xs leading-5 text-rose-900 dark:bg-rose-950 dark:text-rose-200"
                    >
                      {REPLACED_LABEL[d.replacedBy]}
                    </span>
                  ) : label && kind ? (
                    <span
                      aria-hidden="true"
                      className={`mx-auto mt-0.5 block w-fit rounded px-1.5 text-sm leading-5 ${badgeClass(kind)}`}
                    >
                      {label}
                    </span>
                  ) : null}

                  {/* 표시: + 추가 근무, ! 확인 필요 */}
                  {(d?.hasExtra || d?.hasIssue) && (
                    <span aria-hidden="true" className="absolute right-0.5 top-0 text-xs font-bold leading-none">
                      {d.hasIssue && <span className="text-red-600 dark:text-red-400">!</span>}
                      {d.hasExtra && <span className="text-blue-700 dark:text-blue-400">+</span>}
                    </span>
                  )}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 달력 아래의 기호 설명 */
export function CalendarLegend() {
  const items: [string, string, DayKind][] = [
    ["주", "주간", "주간"],
    ["야", "야간", "야간"],
    ["심", "심야", "심야"],
    ["당", "당직", "당직"],
    ["일", "일근", "일근"],
    ["비", "비번", "비번"],
    ["휴", "휴무", "휴무"],
  ];
  return (
    <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map(([short, name, kind]) => (
          <li key={name} className="flex items-center gap-1">
            <span className={`rounded px-1.5 ${badgeClass(kind)}`}>{short}</span>
            {name}
          </li>
        ))}
      </ul>
      <p className="mt-1">
        <span className="font-bold text-red-600 dark:text-red-400">빨간 날짜</span> 토·일·공휴일 ·{" "}
        <span className="font-bold text-blue-700 dark:text-blue-400">+</span> 추가 근무 ·{" "}
        <span className="rounded bg-rose-100 px-1 text-rose-900 dark:bg-rose-950 dark:text-rose-200">연가</span> 휴가
      </p>
    </div>
  );
}
