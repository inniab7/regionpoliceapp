// Design Ref: §4.2 — 오늘 내 근무 카드 (예: "오늘 10/6(화) 야간 18:00~09:00")
// Plan: 작업 20 — 근무표 달력과 함께 첫 화면 위쪽에 보인다
import type { MonthDay } from "@/lib/overtime/monthly";
import type { PlannedDay } from "@/lib/schedule/generate";
import { formatShortDate } from "@/lib/time";
import type { DateString } from "@/lib/types";

interface Props {
  today: DateString;
  planned: PlannedDay;
  /** 오늘이 속한 달 계산에서 나온 오늘 정보 (휴가·교육출장·추가 근무 반영) */
  day: MonthDay | undefined;
  holidayName: string | null;
}

/** 오늘 근무를 한 줄로 설명한다 */
function describe(planned: PlannedDay, day: MonthDay | undefined): string {
  if (!planned.profile || !planned.kind) return "등록한 근무 정보가 아직 적용되지 않는 날이에요.";
  if (day?.replacedBy === "휴가") return "연가·병가 (휴가)";
  if (day?.replacedBy === "교육출장") return "교육·출장";

  const { kind, time } = planned;
  if (kind === "비번" || kind === "휴무") return kind;
  if (!time) return `${kind} (근무 시간이 등록되지 않았어요)`;
  if (kind === "당직") return `당직 ${time.start} 시작 · 24시간`;
  const nextDay = time.end <= time.start ? "다음 날 " : "";
  return `${kind} ${time.start}~${nextDay}${time.end}`;
}

export default function TodayCard({ today, planned, day, holidayName }: Props) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
      <p className="text-sm text-blue-900 dark:text-blue-200">
        오늘 {formatShortDate(today)}
        {holidayName ? ` · ${holidayName}` : ""}
      </p>
      <p className="mt-0.5 text-lg font-bold text-blue-950 dark:text-blue-100">{describe(planned, day)}</p>
      {day?.hasExtra && <p className="mt-0.5 text-sm text-blue-900 dark:text-blue-200">+ 추가 근무가 있어요.</p>}
    </div>
  );
}
