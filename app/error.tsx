// 화면을 그리다 예상하지 못한 오류가 났을 때 보여 주는 한국어 안내 화면
// 오류 화면은 브라우저에서 동작해야 하므로 "use client"가 필요하다.
"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // 개발 중 원인 확인용. 사용자 데이터는 담지 않는다.
    console.error(error);
  }, [error]);

  return (
    <section>
      <h1 className="text-2xl font-bold">문제가 생겼어요</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        화면을 불러오는 중 오류가 났습니다. 다시 시도해 주세요.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 inline-flex h-12 items-center rounded-lg bg-blue-700 px-5 text-base font-bold text-white dark:bg-blue-500"
      >
        다시 시도
      </button>
    </section>
  );
}
