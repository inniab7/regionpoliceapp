// lib/ai/verify.ts 시험 — 요청 모양과 결과 분류 (실제 AI 회사에는 요청하지 않는다)
import { describe, expect, it, vi } from "vitest";
import { buildVerifyRequest, reasonFromStatus, verifyApiKey } from "./verify";

const fakeFetch = (status: number) => vi.fn(async () => new Response("{}", { status })) as unknown as typeof fetch;

describe("키 확인 요청", () => {
  it("세 AI 모두 키를 주소에 넣지 않는다", () => {
    for (const p of ["chatgpt", "gemini", "claude"] as const) {
      expect(buildVerifyRequest(p, "SECRETKEY").url).not.toContain("SECRETKEY");
    }
  });
  it("Claude는 브라우저 직접 호출 머리글을 보낸다", () => {
    expect(buildVerifyRequest("claude", "k").headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
  });
  it("현답 서버 주소로는 보내지 않는다", () => {
    for (const p of ["chatgpt", "gemini", "claude"] as const) {
      expect(new URL(buildVerifyRequest(p, "k").url).hostname).toMatch(/openai\.com|googleapis\.com|anthropic\.com/);
    }
  });
});

describe("결과 분류", () => {
  it("200이면 성공", async () => expect(await verifyApiKey("chatgpt", "k", fakeFetch(200), true)).toEqual({ ok: true }));
  it.each([400, 401, 403])("%i → 키 틀림", (s) => expect(reasonFromStatus(s)).toBe("invalid-key"));
  it("429 → 한도", () => expect(reasonFromStatus(429)).toBe("limit"));
  it("500 → 알 수 없음", () => expect(reasonFromStatus(500)).toBe("unknown"));
  it("빈 키는 요청 없이 안내", async () => {
    const f = fakeFetch(200);
    expect(await verifyApiKey("claude", "  ", f, true)).toEqual({ ok: false, reason: "empty" });
    expect(f).not.toHaveBeenCalled();
  });
  it("인터넷이 없으면 요청 없이 끊김 안내", async () => {
    const f = fakeFetch(200);
    expect(await verifyApiKey("gemini", "k", f, false)).toEqual({ ok: false, reason: "offline" });
    expect(f).not.toHaveBeenCalled();
  });
  it("요청이 막히면(네트워크 오류) 연결 실패", async () => {
    const f = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await verifyApiKey("gemini", "k", f, true)).toEqual({ ok: false, reason: "unreachable" });
  });
});
