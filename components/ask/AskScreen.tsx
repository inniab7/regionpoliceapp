// Design Ref: §4.4 — 규정 찾기 화면: 연결된 AI 표시, 등록 법령·기준일, 대화(질문·답·출처·기준일), 하단 고정 입력창
// Plan: 작업 31 — 질문 화면. 대화는 화면을 떠나면 사라진다(기기에 저장하지 않음). 질문은 이 기기에서 고른 AI로 직접 간다.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ask, MAX_QUESTION_CHARS } from "@/lib/ai/ask";
import { MAX_HISTORY, type HistoryTurn } from "@/lib/ai/prompt";
import { NOT_CONNECTED_VIEW, toView, type AskView, type NoticeAction } from "@/lib/ai/messages";
import { loadLawsOnce } from "@/lib/laws/load";
import { buildSearchIndex, type LoadedLaw, type SearchIndex } from "@/lib/laws/search";
import { useAiConnection } from "@/lib/storage/useAiConnection";
import { AI_PROVIDER_LABELS } from "@/lib/types";

type LawsState =
  | { status: "loading" }
  | { status: "ready"; laws: LoadedLaw[]; index: SearchIndex }
  | { status: "failed" };

interface Turn {
  id: number;
  question: string;
  view: AskView;
}

/** "2026-07-01" → "2026년 7월 1일" */
function koreanDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

const LAWS_FAILED_VIEW = "법령 자료를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요";

export default function AskScreen() {
  const connState = useAiConnection();
  const [lawsState, setLawsState] = useState<LawsState>({ status: "loading" });
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState<string | null>(null); // 처리 중인 질문
  const [blockNotice, setBlockNotice] = useState<string | null>(null);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadLaws = useCallback(() => {
    setLawsState({ status: "loading" });
    loadLawsOnce().then(
      (laws) => setLawsState({ status: "ready", laws, index: buildSearchIndex(laws) }),
      () => setLawsState({ status: "failed" }),
    );
  }, []);

  useEffect(() => {
    // 화면을 열 때 법령을 불러온다 (이미 받아 둔 것은 메모리에서 바로 쓴다)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부(네트워크) 자료를 불러오는 시작점
    loadLaws();
  }, [loadLaws]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns.length, sending]);

  const connection = connState.status === "connected" ? connState.connection : null;
  const ready = connection !== null && lawsState.status === "ready";
  const length = text.trim().length;
  const tooLong = length > MAX_QUESTION_CHARS;

  /** 앞 대화: 이 질문 앞에서 답을 받은 것 중 가장 최근 2개 */
  function historyBefore(beforeId: number | null): HistoryTurn[] {
    return turns
      .filter((t) => (beforeId === null || t.id < beforeId) && t.view.kind === "answer")
      .slice(-MAX_HISTORY)
      .map((t) => ({ question: t.question, answer: t.view.kind === "answer" ? t.view.text : "" }));
  }

  /** 질문을 보낸다. retryId가 있으면 그 질문의 결과만 다시 받는다 */
  async function send(question: string, retryId: number | null = null) {
    if (!connection || lawsState.status !== "ready" || sending) return;
    setBlockNotice(null);
    setSending(question);
    const result = await ask({ question, history: historyBefore(retryId), connection, index: lawsState.index });
    const view = toView(result);
    setSending(null);

    // 입력을 고쳐야 하는 경우(개인정보·길이)는 대화에 넣지 않고 입력창 위에 안내만 하고 글은 그대로 둔다
    if (retryId === null && view.kind === "notice" && view.action === "edit-question") {
      setBlockNotice(view.message);
      return;
    }
    if (retryId !== null) {
      setTurns((ts) => ts.map((t) => (t.id === retryId ? { ...t, view } : t)));
    } else {
      setTurns((ts) => [...ts, { id: nextId.current++, question, view }]);
      setText("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (length === 0 || tooLong) return;
    void send(text.trim());
  }

  return (
    <section className="pb-36">
      <div className="flex items-start justify-between gap-2">
        <h1 className="text-2xl font-bold">규정 찾기</h1>
        <Link
          href="/settings#ai"
          className="mt-1 shrink-0 rounded-full border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
          aria-label="AI 연결 설정으로 이동"
        >
          {connState.status === "connected" ? `🤖 ${AI_PROVIDER_LABELS[connState.connection.provider]} 연결됨` : "🤖 AI 연결 안 됨"}
        </Link>
      </div>

      <details className="mt-2 rounded-lg border border-zinc-300 p-3 dark:border-zinc-600">
        <summary className="cursor-pointer text-base">
          {lawsState.status === "ready" ? `등록 법령 ${lawsState.laws.length}종` : "등록 법령"} (법령별 기준일 보기)
        </summary>
        {lawsState.status === "ready" ? (
          <ul className="mt-2 space-y-1 text-sm">
            {lawsState.laws.map((l) => (
              <li key={l.id} className="flex justify-between gap-2">
                <span>{l.document.name}</span>
                <span className="shrink-0 text-zinc-600 dark:text-zinc-400">{koreanDate(l.document.baseDate)} 기준</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{lawsState.status === "loading" ? "불러오는 중…" : "불러오지 못했어요."}</p>
        )}
      </details>

      {lawsState.status === "failed" && (
        <div role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-base text-red-900 dark:bg-red-950 dark:text-red-200">
          <p>{LAWS_FAILED_VIEW}</p>
          <button type="button" onClick={loadLaws} className="mt-2 h-12 w-full rounded-lg bg-red-700 font-bold text-white">
            다시 불러오기
          </button>
        </div>
      )}

      {/* 대화 */}
      <div className="mt-4 space-y-4" aria-live="polite">
        {turns.length === 0 && !sending && connState.status !== "loading" && (
          <p className="text-zinc-600 dark:text-zinc-400">
            등록된 법령 안에서 찾아 출처와 함께 알려 드려요. 예) 음주운전 기준이 어떻게 되나요?
          </p>
        )}
        {turns.map((t) => (
          <TurnView key={t.id} turn={t} onRetry={() => void send(t.question, t.id)} busy={sending !== null} />
        ))}
        {sending && (
          <div>
            <Question text={sending} />
            <p className="mt-2 text-zinc-600 dark:text-zinc-400" role="status">
              🤖 찾는 중이에요…
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 하단 고정 입력창 (하단 메뉴 바로 위) */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-black/10 bg-background dark:border-white/15">
        <div className="mx-auto max-w-md px-4 py-2">
          {connState.status === "loading" ? null : connection === null ? (
            <div>
              <p className="text-base">{NOT_CONNECTED_VIEW.kind === "notice" ? NOT_CONNECTED_VIEW.message : ""}</p>
              <Link
                href="/settings#ai"
                className="mt-2 flex h-12 items-center justify-center rounded-lg bg-blue-700 text-base font-bold text-white dark:bg-blue-500"
              >
                AI 연결하기
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {blockNotice && (
                <p role="alert" className="mb-2 rounded-lg bg-red-50 p-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">
                  {blockNotice}
                </p>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setBlockNotice(null);
                  }}
                  rows={2}
                  placeholder="궁금한 규정을 적어 주세요"
                  aria-label="질문"
                  className="min-w-0 flex-1 resize-none rounded-lg border border-zinc-400 bg-background p-2 text-base"
                />
                <button
                  type="submit"
                  disabled={!ready || length === 0 || tooLong || sending !== null}
                  className="h-12 shrink-0 rounded-lg bg-blue-700 px-4 text-base font-bold text-white disabled:opacity-40 dark:bg-blue-500"
                >
                  보내기
                </button>
              </div>
              <p className={`mt-1 text-xs ${tooLong ? "font-bold text-red-600 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400"}`}>
                {length}/{MAX_QUESTION_CHARS}자 · 이름·주민번호·전화번호·차량번호는 적지 마세요
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function Question({ text }: { text: string }) {
  return (
    <p className="ml-auto w-fit max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-blue-700 px-3 py-2 text-base text-white dark:bg-blue-600">
      {text}
    </p>
  );
}

const ACTION_LABELS: Record<NoticeAction, string> = {
  "connect-ai": "AI 연결하기",
  "open-settings": "설정 열기",
  "edit-question": "질문 고치기",
  retry: "다시 시도",
};

function TurnView({ turn, onRetry, busy }: { turn: Turn; onRetry: () => void; busy: boolean }) {
  const v = turn.view;
  return (
    <div>
      <Question text={turn.question} />
      <div className="mt-2 text-base">
        {v.kind === "answer" ? (
          <div className="rounded-2xl rounded-bl-sm bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
            <p className="whitespace-pre-wrap">🤖 {v.text}</p>
            <ul className="mt-2 space-y-0.5 text-sm text-zinc-700 dark:text-zinc-300">
              {v.sources.map((s) => (
                <li key={`${s.law}-${s.article}`}>
                  📎 {s.law} {s.article}
                  {s.title ? `(${s.title})` : ""} · {koreanDate(s.baseDate)} 기준 법령
                </li>
              ))}
            </ul>
            {v.fieldJudgmentNotice && <FieldNotice text={v.fieldJudgmentNotice} />}
          </div>
        ) : (
          <div
            role={v.tone === "error" ? "alert" : undefined}
            className={`rounded-2xl rounded-bl-sm px-3 py-2 ${
              v.tone === "error" ? "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200" : "bg-zinc-100 dark:bg-zinc-800"
            }`}
          >
            <p>🤖 {v.message}</p>
            {v.action === "retry" && (
              <button
                type="button"
                onClick={onRetry}
                disabled={busy}
                className="mt-2 h-12 w-full rounded-lg bg-red-700 font-bold text-white disabled:opacity-40"
              >
                {ACTION_LABELS.retry}
              </button>
            )}
            {(v.action === "open-settings" || v.action === "connect-ai") && (
              <Link
                href="/settings#ai"
                className="mt-2 flex h-12 items-center justify-center rounded-lg bg-blue-700 font-bold text-white dark:bg-blue-500"
              >
                {ACTION_LABELS[v.action]}
              </Link>
            )}
            {v.fieldJudgmentNotice && <FieldNotice text={v.fieldJudgmentNotice} />}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldNotice({ text }: { text: string }) {
  return (
    <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">⚠ {text}</p>
  );
}
