// Design Ref: §4.5 — 설정 화면 (/settings). 내 등록 정보와 [변경], 공휴일 편집, 백업. AI 연결은 이후 작업에서 채운다.
// Plan: 작업 2·19·21·24
import type { Metadata } from "next";
import AiConnectPanel from "@/components/settings/AiConnectPanel";
import BackupPanel from "@/components/settings/BackupPanel";
import HolidayEditor from "@/components/settings/HolidayEditor";
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

      <h2 id="ai" className="mt-8 scroll-mt-4 text-lg font-bold">
        AI 연결
      </h2>
      <div className="mt-2">
        <AiConnectPanel />
      </div>

      <h2 className="mt-8 text-lg font-bold">공휴일</h2>
      <div className="mt-2">
        <HolidayEditor />
      </div>

      <h2 id="backup" className="mt-8 scroll-mt-4 text-lg font-bold">
        백업
      </h2>
      <div className="mt-2">
        <BackupPanel />
      </div>
    </section>
  );
}
