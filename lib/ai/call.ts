// Design Ref: §7 — 사용자 기기에서 고른 AI 회사로 본인 키로 직접 요청한다 (현답 서버를 거치지 않는다)
// Plan: 작업 29 — 답변 만들기. 세 AI의 요청·응답 모양만 다르고, 보내는 내용(지시문·조문·질문)과 결과 종류는 같다.
import type { AiProvider } from "../types";

/** 답변에 쓰는 AI 모델 (회사가 모델을 바꾸면 여기 한 곳만 고친다) */
export const AI_MODELS: Record<AiProvider, string> = {
  chatgpt: "gpt-5.4-mini",
  gemini: "gemini-flash-latest",
  claude: "claude-haiku-5-5",
};

/** 답이 길지 않으므로 넉넉히만 (추론하는 모델은 생각하는 데도 쓴다) */
const MAX_OUTPUT_TOKENS = 2000;
const DEFAULT_TIMEOUT_MS = 30_000; // DESIGN 7.3: 30초 안에 답이 없으면 "잠시 후 다시 시도해 주세요"

export type CallFailureReason = "invalid-key" | "limit" | "offline" | "timeout" | "unreachable" | "model" | "bad-response" | "unknown";

export type CallResult = { ok: true; text: string } | { ok: false; reason: CallFailureReason };

export interface ChatRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

/** AI별 요청 만들기 (키는 주소가 아니라 머리글로만 보낸다) */
export function buildChatRequest(provider: AiProvider, apiKey: string, system: string, user: string): ChatRequest {
  const json = { "Content-Type": "application/json" };
  switch (provider) {
    case "chatgpt":
      return {
        url: "https://api.openai.com/v1/chat/completions",
        headers: { ...json, Authorization: `Bearer ${apiKey}` },
        body: {
          model: AI_MODELS.chatgpt,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: MAX_OUTPUT_TOKENS,
        },
      };
    case "gemini":
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODELS.gemini}:generateContent`,
        headers: { ...json, "x-goog-api-key": apiKey },
        body: {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0 },
        },
      };
    case "claude":
      return {
        url: "https://api.anthropic.com/v1/messages",
        headers: {
          ...json,
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          // 사용자 본인 키로 브라우저에서 직접 부르는 것을 허용하는 머리글
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: {
          model: AI_MODELS.claude,
          max_tokens: MAX_OUTPUT_TOKENS,
          temperature: 0,
          system,
          messages: [{ role: "user", content: user }],
        },
      };
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 응답에서 AI가 쓴 글만 꺼낸다. 모양이 다르면 null */
export function extractText(provider: AiProvider, value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (provider === "chatgpt") {
    const choice = Array.isArray(value.choices) ? value.choices[0] : null;
    const message = isRecord(choice) ? choice.message : null;
    return isRecord(message) && typeof message.content === "string" ? message.content : null;
  }
  if (provider === "gemini") {
    const cand = Array.isArray(value.candidates) ? value.candidates[0] : null;
    const content = isRecord(cand) ? cand.content : null;
    const parts = isRecord(content) && Array.isArray(content.parts) ? content.parts : [];
    const text = parts.map((p) => (isRecord(p) && typeof p.text === "string" ? p.text : "")).join("");
    return text === "" ? null : text;
  }
  const blocks = Array.isArray(value.content) ? value.content : [];
  const text = blocks.map((b) => (isRecord(b) && b.type === "text" && typeof b.text === "string" ? b.text : "")).join("");
  return text === "" ? null : text;
}

/** HTTP 상태 코드를 실패 이유로 바꾼다. Gemini는 틀린 키에 400 + "API key" 메시지를 준다 */
export function reasonFromCallStatus(status: number, bodyText: string): CallFailureReason {
  if (status === 401 || status === 403) return "invalid-key";
  if (status === 400 && /api key|api_key|apikey/i.test(bodyText)) return "invalid-key";
  if (status === 429) return "limit";
  if (status === 404) return "model";
  return "unknown";
}

/** 고른 AI에 요청하고 AI가 쓴 글을 돌려준다. fetchFn·online을 바꿔 끼울 수 있어 시험하기 쉽다 */
export async function callAi(
  provider: AiProvider,
  apiKey: string,
  system: string,
  user: string,
  options: { fetchFn?: typeof fetch; online?: boolean; timeoutMs?: number } = {},
): Promise<CallResult> {
  const fetchFn = options.fetchFn ?? fetch;
  // 브라우저가 "끊김(false)"이라고 확실히 알릴 때만 끊김으로 본다 (값이 없는 환경은 연결된 것으로 본다)
  const online = options.online ?? (typeof navigator === "undefined" ? true : navigator.onLine !== false);
  if (!online) return { ok: false, reason: "offline" };

  const req = buildChatRequest(provider, apiKey.trim(), system, user);
  try {
    const res = await fetchFn(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, reason: reasonFromCallStatus(res.status, await res.text().catch(() => "")) };
    const text = extractText(provider, await res.json().catch(() => null));
    return text === null ? { ok: false, reason: "bad-response" } : { ok: true, text };
  } catch (e) {
    if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) return { ok: false, reason: "timeout" };
    return { ok: false, reason: online ? "unreachable" : "offline" };
  }
}
