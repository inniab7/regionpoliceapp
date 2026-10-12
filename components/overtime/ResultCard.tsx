// Design Ref: §4.2 — 결과 4줄(기본 초과·야간·휴일·합계)과 "참고용 계산" 안내 문구
// Plan: 작업 23 — 결과 화면. 보고 있는 달의 1일~말일 결과이며, 근무를 바꾸면 바로 달라진다.
import { RESULT_DISCLAIMER, resultRows } from "@/lib/overtime/result";
import type { Breakdown } from "@/lib/overtime/allocate";

interface Props {
  /** 예: "2026년 10월" */
  title: string;
  total: Breakdown & { sum: number };
  /** 확인이 필요해 계산에서 빠진 입력이 있는지 */
  hasIssues: boolean;
}

export default function ResultCard({ title, total, hasIssues }: Props) {
  const rows = resultRows(total);

  return (
    <section aria-labelledby="resultTitle" className="mt-5 rounded-lg border border-zinc-300 p-3 dark:border-zinc-600">
      <h2 id="resultTitle" className="text-lg font-bold">
        {title} 초과근무
      </h2>

      <dl className="mt-2" aria-live="polite">
        {rows.map((row) => {
          const isSum = row.key === "sum";
          return (
            <div
              key={row.key}
              className={`flex items-baseline justify-between gap-3 py-2 ${
                isSum ? "mt-1 border-t-2 border-zinc-400 pt-3 dark:border-zinc-500" : "border-b border-zinc-100 dark:border-zinc-800"
              }`}
            >
              <dt>
                <span className={isSum ? "text-lg font-bold" : "text-base font-bold"}>{row.label}</span>
                <span className="block text-sm text-zinc-600 dark:text-zinc-400">{row.hint}</span>
              </dt>
              <dd className={`shrink-0 text-right tabular-nums ${isSum ? "text-2xl font-bold" : "text-xl font-bold"}`}>{row.text}</dd>
            </div>
          );
        })}
      </dl>

      {hasIssues && (
        <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">
          아래 &lsquo;확인이 필요해요&rsquo;의 입력은 계산에서 빠져 있어요. 고치면 결과가 달라질 수 있어요.
        </p>
      )}

      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{RESULT_DISCLAIMER}</p>
    </section>
  );
}
