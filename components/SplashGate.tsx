// Design Ref: §4.1 (nice) — 시작 화면을 같은 탭에서는 한 번만 보이게 하는 작은 부품
// Plan: 작업 38 — 이미 본 탭이면 시작 화면을 숨기고, 처음이면 "봤다"고 표시해 둔다. 화면에는 아무것도 그리지 않는다.
"use client";

import { useLayoutEffect } from "react";

const KEY = "hyeondap:splash";

/** 이 페이지를 열 때 이미 본 탭이었는지. 페이지를 열 때 한 번만 알아본다(개발 모드에서 효과가 두 번 실행돼도 같은 답) */
let seenBefore: boolean | null = null;
function wasSeenBefore(): boolean {
  if (seenBefore === null) {
    try {
      seenBefore = sessionStorage.getItem(KEY) !== null;
      sessionStorage.setItem(KEY, "1");
    } catch {
      seenBefore = false; // 저장소를 쓸 수 없으면 매번 보여 준다
    }
  }
  return seenBefore;
}

export default function SplashGate() {
  useLayoutEffect(() => {
    if (wasSeenBefore()) document.documentElement.classList.add("no-splash");
  }, []);
  return null;
}
