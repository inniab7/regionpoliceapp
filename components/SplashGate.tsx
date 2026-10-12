// Design Ref: §4.1 (nice) — 시작 화면을 같은 탭에서는 한 번만 보이게 한다 (이미 본 탭이면 화면이 그려지기 전에 숨김)
// Plan: 작업 38 — 홈 화면 추가. 서버가 만든 화면(HTML)에만 작은 스크립트를 넣어, 브라우저가 시작 화면을 그리기 전에 실행되게 한다.
// 그래서 새로고침할 때 시작 화면이 번쩍이지 않는다. 브라우저(React)가 다시 그릴 때는 이 부품이 아무것도 그리지 않는다(스크립트는 한 번만 실행).
"use client";

/** 이미 본 탭이면 html에 no-splash를 붙여 시작 화면을 숨기고, 처음이면 "봤다"고 표시한다 */
const CODE = `try{var k="hyeondap:splash";if(sessionStorage.getItem(k)){document.documentElement.classList.add("no-splash")}else{sessionStorage.setItem(k,"1")}}catch(e){}`;

export default function SplashGate() {
  if (typeof window !== "undefined") return null;
  return <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CODE }} />;
}
