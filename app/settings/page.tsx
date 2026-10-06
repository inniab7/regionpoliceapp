// Design Ref: §4.5 — 설정 화면 (/settings). 지금은 빈 틀만 두고 등록 정보·AI 연결·백업은 이후 작업에서 채운다.
// Plan: 작업 2 — 공통 화면 틀
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "설정",
};

export default function SettingsPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold">설정</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        내 등록 정보, AI 연결, 공휴일, 백업을 관리하는 화면입니다. (준비 중)
      </p>
    </section>
  );
}
