// Design Ref: §4.3 — [변경] 화면 (/setup/change). 하단 메뉴가 보이고 "설정"이 선택된 상태.
// Plan: 작업 19 — 인사발령 등으로 소속·패턴이 바뀔 때 적용일과 함께 다시 등록
import type { Metadata } from "next";
import SetupWizard from "@/components/setup/SetupWizard";

export const metadata: Metadata = {
  title: "근무 정보 변경",
};

export default function SetupChangePage() {
  return <SetupWizard mode="change" />;
}
