// Design Ref: §4.5 — 설정의 백업: [백업 파일 저장], [백업 파일 불러오기], 마지막 백업 날짜. AI 키는 백업 파일에 들어가지 않는다.
// Plan: 작업 24 — 백업. 불러오기는 먼저 파일을 검사하고 요약을 보여 준 뒤, 확인을 받고 나서야 지금 정보를 바꾼다.
"use client";

import { useRef, useState } from "react";
import {
  createBackup,
  lastBackupDate,
  parseBackup,
  restoreBackup,
  summarizeBackup,
  type BackupFile,
} from "@/lib/storage/backup";
import { appStore, changeAppData, notifyDataChanged, useAppData } from "@/lib/storage/useAppData";
import { todayInKst } from "@/lib/time";

type Message = { text: string; kind: "ok" | "error" };

const SAVE_ERRORS = {
  empty: "먼저 근무를 등록해 주세요.",
  corrupt: "저장된 정보를 읽을 수 없어서 백업할 수 없어요.",
  "save-failed": "저장하지 못했어요. 이 기기의 저장 공간이 부족하거나 저장이 막혀 있어요.",
  unavailable: "이 브라우저에서는 정보를 저장할 수 없어요.",
} as const;

/** 브라우저에서 파일로 내려받는다 */
function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function BackupPanel() {
  const app = useAppData();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<Message | null>(null);
  /** 검사를 통과해 사용자의 확인을 기다리는 백업 */
  const [pending, setPending] = useState<BackupFile | null>(null);

  const hasData = app.status === "ok";
  const lastDate = app.status === "ok" ? lastBackupDate(app.data) : null;

  function handleSave() {
    if (app.status !== "ok") return;
    const now = new Date();
    const { fileName, content, savedAt } = createBackup(app.data, now);
    downloadText(fileName, content);
    // 파일을 만들었으니 마지막 백업 시각을 기록한다 (6개월 안내의 기준)
    const result = changeAppData((d) => ({ ...d, lastBackupAt: savedAt }));
    if (result === "ok") {
      setMessage({ text: `${fileName} 파일을 저장했어요. 다운로드(내 파일) 폴더를 확인해 주세요.`, kind: "ok" });
    } else {
      // 파일은 내려받았지만 마지막 백업 시각을 기록하지 못한 경우
      setMessage({ text: `파일은 내려받았지만 마지막 백업 날짜를 기록하지 못했어요. ${SAVE_ERRORS[result]}`, kind: "error" });
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일을 다시 골라도 반응하도록
    if (!file) return;
    setPending(null);
    setMessage(null);

    let text: string;
    try {
      text = await file.text();
    } catch {
      setMessage({ text: "파일을 읽지 못했어요. 다시 골라 주세요.", kind: "error" });
      return;
    }
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      setMessage({ text: parsed.message, kind: "error" });
      return;
    }
    setPending(parsed.file);
  }

  function handleRestore() {
    if (!pending) return;
    const store = appStore();
    if (!store) {
      setMessage({ text: SAVE_ERRORS.unavailable, kind: "error" });
      return;
    }
    if (restoreBackup(store, pending) === "ok") {
      notifyDataChanged();
      setPending(null);
      setMessage({ text: "백업 파일의 내용으로 바꿨어요.", kind: "ok" });
    } else {
      setMessage({ text: SAVE_ERRORS["save-failed"], kind: "error" });
    }
  }

  return (
    <div>
      <p className="text-base">
        {lastDate ? (
          <>
            마지막 백업 <b>{lastDate}</b>
          </>
        ) : (
          "아직 백업한 적이 없어요."
        )}
      </p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        등록 정보와 근무 변경, 공휴일을 파일로 저장해 두면 휴대폰을 바꾸거나 브라우저 데이터를 지워도 다시 불러올 수 있어요. 6개월마다 백업해
        주세요. <b>AI 키는 백업 파일에 들어가지 않아요.</b>
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasData}
          className="h-12 rounded-lg bg-blue-700 text-base font-bold text-white disabled:opacity-40 dark:bg-blue-500"
        >
          백업 파일 저장
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="h-12 rounded-lg border border-blue-700 text-base font-bold text-blue-700 dark:border-blue-400 dark:text-blue-400"
        >
          백업 파일 불러오기
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          onChange={handleFile}
          className="sr-only"
          tabIndex={-1}
          aria-label="백업 파일 고르기"
        />
      </div>

      {/* 불러오기 전 확인: 지금 정보가 바뀐다는 것을 알리고 확인을 받는다 */}
      {pending && (
        <div role="alertdialog" aria-labelledby="restoreTitle" className="mt-3 rounded-lg border border-amber-400 bg-amber-50 p-3 dark:border-amber-600 dark:bg-amber-950">
          <p id="restoreTitle" className="text-base font-bold text-amber-950 dark:text-amber-100">
            이 백업 파일로 바꿀까요?
          </p>
          <p className="mt-1 text-sm text-amber-950 dark:text-amber-100">
            {summarizeBackup(pending).join(" · ")}
            {pending.exportedAt ? ` (저장한 날 ${todayInKst(new Date(pending.exportedAt))})` : ""}
          </p>
          <p className="mt-1 text-sm font-bold text-amber-950 dark:text-amber-100">
            지금 이 기기에 저장된 등록 정보·근무 변경·공휴일은 백업 내용으로 바뀌어요.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="h-12 flex-1 rounded-lg border border-zinc-400 bg-background text-base"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleRestore}
              className="h-12 flex-[2] rounded-lg bg-amber-700 text-base font-bold text-white"
            >
              이 내용으로 바꾸기
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`mt-3 text-sm ${message.kind === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
