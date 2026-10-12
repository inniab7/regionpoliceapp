// Design Ref: §4.5 — 설정 화면 (/settings). 내 등록 정보와 [변경]. AI 연결·공휴일·백업은 이후 작업에서 채운다.
// Plan: 작업 2·19
import type { Metadata } from "next";
import ProfileSummary from "@/components/settings/ProfileSummary";

export const metadata: Metadata = {
  title: "설정",
};

export default function SettingsPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold">설정</h1>

      <h2 className="mt-6 text-lg font-bold">내 등록 정보</h2>
      <div className="mt-2">
        <ProfileSummary />
      </div>

      <p className="mt-8 text-zinc-600 dark:text-zinc-400">AI 연결, 공휴일, 백업은 준비 중이에요.</p>
    </section>
  );
}
