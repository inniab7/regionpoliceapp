// Design Ref: §4.4 — 규정 찾기 화면 (/ask)
// Plan: 작업 2·31 — 공통 화면 틀 → 질문 화면. 브라우저 저장소·입력이 필요한 부분은 AskScreen(클라이언트)에 있다.
import type { Metadata } from "next";
import AskScreen from "@/components/ask/AskScreen";

export const metadata: Metadata = {
  title: "규정 찾기",
};

export default function AskPage() {
  return <AskScreen />;
}
