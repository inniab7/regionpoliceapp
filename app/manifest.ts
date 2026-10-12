// Design Ref: §3.2 (nice) — 홈 화면에 앱처럼 추가할 때 쓰는 앱 이름·아이콘 정보
// Plan: 작업 38 — 홈 화면 추가. Android(Chrome)는 이 파일로, iOS(Safari)는 app/apple-icon.png와 layout의 appleWebApp 설정으로 앱처럼 열린다.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "현답",
    short_name: "현답",
    description: "답이 있는 현장 근무자를 위하여 — 초과근무 계산과 규정 찾기",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // 기기가 아이콘 모양을 둥글게·네모로 깎아도 글자와 마크가 잘리지 않게 여백을 둔 것
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
