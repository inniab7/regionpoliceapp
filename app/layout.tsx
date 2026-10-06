// Design Ref: §3.2 — 한글 글꼴은 next/font로 불러오고, 화면은 스마트폰 우선(§1 원칙 5)
// Plan: 작업 1 — lang="ko", 앱 이름 "현답" 메타데이터, 한글 글꼴, 모바일 뷰포트
import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

// 한글 글꼴(Noto Sans KR). 한글 글자는 필요한 만큼만 나눠 받아 처음 로딩을 가볍게 한다.
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "현답",
  description: "답이 있는 현장 근무자를 위하여 — 초과근무 계산과 규정 찾기",
  applicationName: "현답",
};

// 스마트폰 화면 폭에 맞추고, 상단 바 색을 화면 배경색과 맞춘다.
// 확대(핀치 줌)는 막지 않는다(글씨를 키워 보는 사용자를 위해).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* 화면 내용: 스마트폰 폭 기준, 아래쪽은 하단 메뉴에 가리지 않게 여백을 둔다 */}
        <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))]">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
