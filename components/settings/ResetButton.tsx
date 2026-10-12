// Design Ref: §4.5 — 설정 오른쪽 위 [초기화]: 눌러도 바로 지우지 않고 "정말 초기화 하시겠습니까?"를 한 번 묻는다 (예 / 아니오)
// Plan: 초기화 기능 — [예]를 누르면 이 기기의 모든 값(앱 데이터·AI 연결)을 지우고 처음 설치한 상태(근무 등록 화면)로 돌아간다.
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { resetAllData } from "@/lib/storage/reset";
import { notifyAiConnectionChanged } from "@/lib/storage/useAiConnection";
import { appStore, notifyDataChanged } from "@/lib/storage/useAppData";

export default function ResetButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noButton = useRef<HTMLButtonElement>(null);

  // 확인 창이 열려 있을 때: 처음 눌리는 칸은 안전한 [아니오], Esc는 [아니오]와 같다
  useEffect(() => {
    if (!open) return;
    noButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setError(null);
  }

  function handleYes() {
    const store = appStore();
    if (!store || resetAllData(store) !== "ok") {
      setError("초기화하지 못했어요. 이 브라우저에서 저장 공간을 쓸 수 없어요. 브라우저 설정에서 사이트 데이터를 직접 지워 주세요.");
      return;
    }
    // 화면에도 알리고, 처음 설치한 상태인 근무 등록 화면으로 보낸다 (등록 정보가 없으면 첫 화면이 등록으로 안내한다)
    notifyDataChanged();
    notifyAiConnectionChanged();
    setOpen(false);
    router.replace("/");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 shrink-0 rounded-lg border border-red-600 px-4 text-base font-bold text-red-700 dark:border-red-400 dark:text-red-400"
      >
        초기화
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={close} // 바깥을 누르면 [아니오]와 같다
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="resetTitle"
            aria-describedby="resetDesc"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-xl"
          >
            <h2 id="resetTitle" className="text-lg font-bold text-red-700 dark:text-red-400">
              초기화
            </h2>
            <p id="resetDesc" className="mt-2 text-base">
              기존에 설정된 모든 값이 초기화되며 되돌릴 수 없습니다. 정말 초기화 하시겠습니까?
            </p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              등록 정보·근무 변경·공휴일·다른 팀·AI 연결(키 포함)이 이 기기에서 모두 지워져요. 나중에 필요하면 지우기 전에 [백업 파일 저장]을 해 두세요.
            </p>
            {error && (
              <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                ref={noButton}
                type="button"
                onClick={close}
                className="h-12 flex-1 rounded-lg border border-zinc-400 text-base font-bold"
              >
                아니오
              </button>
              <button
                type="button"
                onClick={handleYes}
                className="h-12 flex-1 rounded-lg bg-red-700 text-base font-bold text-white"
              >
                예
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
