// Design Ref: §4.6 — [연결 확인]: 사용자 키로 그 AI 회사에 브라우저에서 직접 요청해 키가 맞는지 본다.
// Plan: 작업 25 — AI 연결. 현답 서버를 거치지 않는다(DESIGN 2.1). 요청 방식만 다르고 결과 종류는 세 AI가 같다.
// 사용료가 들지 않도록 "모델 목록 보기" 요청을 쓴다(글을 만들지 않으므로 무료). 같은 AI 회사 주소라 직접 호출 가능 여부도 함께 확인된다.
import type { AiProvider } from "../types";

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "empty" | "invalid-key" | "limit" | "offline" | "unreachable" | "unknown" };

/** 실패 이유별 화면 문구 (DESIGN 4.6, PRD 23) */
export const VERIFY_MESSAGES: Record<Exclude<VerifyResult, { ok: true }>["reason"], string> = {
  empty: "API 키를 붙여 넣어 주세요.",
  "invalid-key": "키가 맞지 않아요. 다시 확인해 주세요.",
  limit: "사용 한도를 넘었어요. 잠시 뒤에 다시 시도하거나 AI 회사 계정의 한도를 확인해 주세요.",
  offline: "인터넷 연결이 끊어져 처리할 수 없습니다",
  unreachable: "AI 회사에 연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.",
  unknown: "확인하지 못했어요. 잠시 뒤에 다시 시도해 주세요.",
};

/** AI별 키 확인 요청 (주소와 머리글만 다르다) */
export function buildVerifyRequest(provider: AiProvider, apiKey: string): { url: string; headers: Record<string, string> } {
  switch (provider) {
    case "chatgpt":
      return { url: "https://api.openai.com/v1/models", headers: { Authorization: `Bearer ${apiKey}` } };
    case "gemini":
      // 키를 주소(URL)에 넣지 않고 머리글로 보낸다
      return {
        url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
        headers: { "x-goog-api-key": apiKey },
      };
    case "claude":
      return {
        url: "https://api.anthropic.com/v1/models?limit=1",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          // 사용자 본인 키로 브라우저에서 직접 부르는 것을 허용하는 머리글
          "anthropic-dangerous-direct-browser-access": "true",
        },
      };
  }
}

/** 응답 코드를 이유로 바꾼다 (Gemini는 틀린 키에 400을 준다) */
export function reasonFromStatus(status: number): Exclude<VerifyResult, { ok: true }>["reason"] {
  if (status === 400 || status === 401 || status === 403) return "invalid-key";
  if (status === 429) return "limit";
  return "unknown";
}

/** 키가 맞는지 확인한다. fetchFn과 online을 바꿔 끼울 수 있어 시험하기 쉽다 */
export async function verifyApiKey(
  provider: AiProvider,
  apiKey: string,
  fetchFn: typeof fetch = fetch,
  online: boolean = typeof navigator === "undefined" ? true : navigator.onLine,
): Promise<VerifyResult> {
  const key = apiKey.trim();
  if (key === "") return { ok: false, reason: "empty" };
  if (!online) return { ok: false, reason: "offline" };
  const { url, headers } = buildVerifyRequest(provider, key);
  try {
    const res = await fetchFn(url, { method: "GET", headers, signal: AbortSignal.timeout(15000) });
    return res.ok ? { ok: true } : { ok: false, reason: reasonFromStatus(res.status) };
  } catch {
    return { ok: false, reason: online ? "unreachable" : "offline" };
  }
}
