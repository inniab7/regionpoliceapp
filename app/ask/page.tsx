// Design Ref: §4.4 — 규정 찾기 화면 (/ask). 지금은 빈 틀만 두고 질문·답변은 이후 작업에서 채운다.
// Plan: 작업 2 — 공통 화면 틀
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "규정 찾기 | 현답",
};

export default function AskPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold">규정 찾기</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        법령을 질문하면 출처와 함께 답해 주는 화면입니다. (준비 중)
      </p>
    </section>
  );
}
