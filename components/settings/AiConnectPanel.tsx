// Design Ref: §4.6 — 설정의 AI 연결: AI 고르기, 본인 API 키 붙여넣기, [연결 확인], [연결 끊기]
// Plan: 작업 25 — 키는 이 기기에만 저장하고, 확인도 기기에서 AI 회사로 직접 보낸다. 화면에는 끝 4자리만 보인다.
"use client";

import { useState } from "react";
import { VERIFY_MESSAGES, verifyApiKey } from "@/lib/ai/verify";
import { maskApiKey } from "@/lib/storage/aiKey";
import { connectAi, disconnectAi, useAiConnection } from "@/lib/storage/useAiConnection";
import { formatShortDate, todayInKst } from "@/lib/time";
import { AI_PROVIDERS, AI_PROVIDER_LABELS, type AiProvider } from "@/lib/types";

/** 선택한 AI의 키 받는 법 (쉬운 말) */
const KEY_GUIDES: Record<AiProvider, { site: string; url: string; steps: string }> = {
  chatgpt: {
    site: "OpenAI 개발자 사이트 (platform.openai.com)",
    url: "https://platform.openai.com/api-keys",
    steps: "로그인 → API keys → 「Create new secret key」를 눌러 만든 키를 복사해 붙여 넣으세요. 결제 수단을 먼저 등록해야 쓸 수 있어요.",
  },
  gemini: {
    site: "Google AI Studio (aistudio.google.com)",
    url: "https://aistudio.google.com/apikey",
    steps: "구글 계정으로 로그인 → 「Create API key」를 눌러 만든 키를 복사해 붙여 넣으세요.",
  },
  claude: {
    site: "Anthropic 콘솔 (console.anthropic.com)",
    url: "https://console.anthropic.com/settings/keys",
    steps: "로그인 → API Keys → 「Create Key」를 눌러 만든 키를 복사해 붙여 넣으세요. 결제 수단(크레딧)을 먼저 등록해야 쓸 수 있어요.",
  },
};

type Message = { text: string; kind: "ok" | "error" };

export default function AiConnectPanel() {
  const state = useAiConnection();
  const [provider, setProvider] = useState<AiProvider | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  if (state.status === "loading") return <p className="text-zinc-600 dark:text-zinc-400">불러오는 중…</p>;
  if (state.status === "unavailable") {
    return <p role="alert" className="text-base">이 브라우저에서는 정보를 저장할 수 없어서 AI를 연결할 수 없어요.</p>;
  }

  const connection = state.status === "connected" ? state.connection : null;
  // 고른 적이 없으면 연결된 AI(없으면 ChatGPT)를 보여 준다
  const selected: AiProvider = provider ?? connection?.provider ?? "chatgpt";
  const guide = KEY_GUIDES[selected];
  const switching = connection !== null && selected !== connection.provider;
  const showInput = connection === null || switching || apiKey !== "";

  async function handleCheck() {
    setMessage(null);
    setChecking(true);
    const result = await verifyApiKey(selected, apiKey);
    setChecking(false);
    if (!result.ok) {
      setMessage({ text: VERIFY_MESSAGES[result.reason], kind: "error" });
      return;
    }
    const saved = connectAi({ provider: selected, apiKey: apiKey.trim(), verifiedAt: new Date().toISOString() });
    if (!saved) {
      setMessage({ text: "키는 맞지만 이 기기에 저장하지 못했어요. 저장 공간을 확인해 주세요.", kind: "error" });
      return;
    }
    setApiKey("");
    setShowKey(false);
    setProvider(null);
    setMessage({ text: `${AI_PROVIDER_LABELS[selected]} 연결을 확인했어요.`, kind: "ok" });
  }

  function handleDisconnect() {
    disconnectAi();
    setApiKey("");
    setProvider(null);
    setMessage({ text: "연결을 끊고 이 기기에서 키를 지웠어요.", kind: "ok" });
  }

  return (
    <div>
      {connection && (
        <p className="rounded-lg bg-emerald-50 p-3 text-base text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          ✅ <b>{AI_PROVIDER_LABELS[connection.provider]}</b> 연결됨 (키 끝자리 {maskApiKey(connection.apiKey)},{" "}
          {formatShortDate(todayInKst(new Date(connection.verifiedAt)))} 확인)
        </p>
      )}

      <fieldset className="mt-3">
        <legend className="text-base font-bold">사용할 AI</legend>
        <div className="mt-1 flex gap-2">
          {AI_PROVIDERS.map((p) => (
            <label
              key={p}
              className={`flex h-12 flex-1 cursor-pointer items-center justify-center rounded-lg border text-base ${
                selected === p
                  ? "border-blue-700 bg-blue-700 font-bold text-white dark:border-blue-500 dark:bg-blue-500"
                  : "border-zinc-300 dark:border-zinc-600"
              }`}
            >
              <input
                type="radio"
                name="aiProvider"
                value={p}
                checked={selected === p}
                onChange={() => {
                  setProvider(p);
                  setApiKey("");
                  setMessage(null);
                }}
                className="sr-only"
              />
              {AI_PROVIDER_LABELS[p]}
            </label>
          ))}
        </div>
      </fieldset>

      {switching && connection && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {AI_PROVIDER_LABELS[selected]} 키를 확인하면 지금 연결된 {AI_PROVIDER_LABELS[connection.provider]} 키는 지워져요.
        </p>
      )}

      {showInput && (
        <div className="mt-3">
          <label htmlFor="aiKey" className="text-base font-bold">
            {AI_PROVIDER_LABELS[selected]} API 키
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="aiKey"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="여기에 붙여 넣으세요"
              className="h-12 min-w-0 flex-1 rounded-lg border border-zinc-400 bg-background px-3 text-base"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? "키 가리기" : "키 보기"}
              className="h-12 w-12 rounded-lg border border-zinc-400 text-lg"
            >
              {showKey ? "🙈" : "👁"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {showInput && (
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking || apiKey.trim() === ""}
            className="h-12 flex-[2] rounded-lg bg-blue-700 text-base font-bold text-white disabled:opacity-40 dark:bg-blue-500"
          >
            {checking ? "확인하는 중…" : "연결 확인"}
          </button>
        )}
        {connection && (
          <button
            type="button"
            onClick={handleDisconnect}
            className="h-12 flex-1 rounded-lg border border-red-600 text-base font-bold text-red-700 dark:border-red-400 dark:text-red-400"
          >
            연결 끊기
          </button>
        )}
      </div>

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`mt-3 text-sm ${message.kind === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}
        >
          {message.text}
        </p>
      )}

      <details className="mt-3 rounded-lg border border-zinc-300 p-3 dark:border-zinc-600">
        <summary className="cursor-pointer text-base font-bold">ⓘ {AI_PROVIDER_LABELS[selected]} API 키 받는 법</summary>
        <p className="mt-2 text-sm">
          {guide.steps}{" "}
          <a href={guide.url} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-700 underline dark:text-blue-400">
            {guide.site}
          </a>
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          ChatGPT Plus·Claude Pro 같은 <b>구독과 API 키는 서로 달라요.</b> 구독이 있어도 API 키는 위 사이트에서 따로 만들어야 해요.
        </p>
      </details>

      <ul className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
        <li>ⓘ 키는 이 기기에만 저장되고, 현답 서버로 보내지 않아요. 백업 파일에도 들어가지 않아요.</li>
        <li>ⓘ 사용료는 고른 AI 회사가 키 주인에게 따로 청구해요.</li>
      </ul>
      <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        ⚠ 여럿이 같이 쓰는 기기에서는 쓰고 나서 [연결 끊기]를 눌러 주세요.
      </p>
    </div>
  );
}
