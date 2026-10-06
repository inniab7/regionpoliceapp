// Design Ref: §4.2 — 초과근무 화면 (/). 지금은 빈 틀만 두고 달력·결과는 이후 작업에서 채운다.
// Plan: 작업 2 — 공통 화면 틀
import type { Metadata } from "next";

// 첫 화면은 최상위 레이아웃과 같은 단계라 제목 틀("%s | 현답")이 적용되지 않아 전체 제목을 직접 쓴다.
export const metadata: Metadata = {
  title: { absolute: "초과근무 | 현답" },
};

export default function OvertimePage() {
  return (
    <section>
      <h1 className="text-2xl font-bold">초과근무</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        근무표 달력과 이번 달 초과근무 결과가 여기에 표시됩니다. (준비 중)
      </p>
    </section>
  );
}
