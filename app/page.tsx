// Design Ref: §4.2 — 초과근무 화면 (/). 첫 접속이면 등록 화면으로 안내하고, 달력·결과는 이후 작업에서 채운다.
// Plan: 작업 2·19
import type { Metadata } from "next";
import OvertimeHome from "@/components/overtime/OvertimeHome";

// 첫 화면은 최상위 레이아웃과 같은 단계라 제목 틀("%s | 현답")이 적용되지 않아 전체 제목을 직접 쓴다.
export const metadata: Metadata = {
  title: { absolute: "초과근무 | 현답" },
};

export default function OvertimePage() {
  return <OvertimeHome />;
}
