// Design Ref: §4.3 — 첫 등록 화면 (/setup). 하단 메뉴는 숨긴다(BottomNav).
// Plan: 작업 15~19 — 등록 마법사 (첫 등록)
import type { Metadata } from "next";
import SetupWizard from "@/components/setup/SetupWizard";

export const metadata: Metadata = {
  title: "근무 등록",
};

export default function SetupPage() {
  return <SetupWizard mode="first" />;
}
