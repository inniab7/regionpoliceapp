// 시·분 두 칸으로 시각을 고르는 부품 (등록 3단계와 근무 변경 창이 함께 쓴다). 분은 10분 단위 (규칙 9).
"use client";

import { formatTime, parseTime } from "@/lib/time";

const pad = (n: number) => String(n).padStart(2, "0");

/** 0~23시 */
export const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 10, 20, 30, 40, 50];

const selectClass =
  "h-12 w-full rounded-lg border border-zinc-300 bg-background px-2 text-base outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/30 dark:border-zinc-600";

export default function TimePicker({
  label,
  value,
  onChange,
  hours = ALL_HOURS,
}: {
  /** 예: "주간 시작" — 마지막 낱말("시작")이 왼쪽에 글자로 보이고, 전체가 화면 낭독용 이름이 된다 */
  label: string;
  value: string;
  onChange: (value: string) => void;
  hours?: readonly number[];
}) {
  const total = parseTime(value) ?? 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-base">{label.split(" ").at(-1)}</span>
      <select
        aria-label={`${label} 시`}
        value={h}
        onChange={(e) => onChange(formatTime(Number(e.target.value) * 60 + m))}
        className={selectClass}
      >
        {hours.map((hour) => (
          <option key={hour} value={hour}>
            {pad(hour)}시
          </option>
        ))}
      </select>
      <select
        aria-label={`${label} 분`}
        value={m}
        onChange={(e) => onChange(formatTime(h * 60 + Number(e.target.value)))}
        className={selectClass}
      >
        {MINUTES.map((minute) => (
          <option key={minute} value={minute}>
            {pad(minute)}분
          </option>
        ))}
      </select>
    </div>
  );
}
