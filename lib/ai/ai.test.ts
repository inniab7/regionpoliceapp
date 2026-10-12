// lib/ai/ 시험 — 지시문·요청 모양, 답 검사(지어낸 출처 거르기·분량 제한·기준일), 전체 흐름 (실제 AI는 부르지 않는다)
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildSearchIndex, searchArticles, type Candidate, type SearchIndex } from "../laws/search";
import { parseLawDocument, parseLawIndex } from "../laws/types";
import type { AiConnection, AiProvider } from "../types";
import { ask } from "./ask";
import { buildChatRequest, callAi, extractText, reasonFromCallStatus } from "./call";
import { checkAnswer, limitAnswer, parseAiAnswer, type RawAnswer } from "./check";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";

let index: SearchIndex;
beforeAll(() => {
  const read = (f: string): unknown => JSON.parse(readFileSync(`public/laws/${f}`, "utf8"));
  const idx = parseLawIndex(read("index.json"))!;
  index = buildSearchIndex(idx.laws.map((l) => ({ id: l.id, document: parseLawDocument(read(l.file))! })));
});

const candidate = (lawName: string, no: string, title = "제목", baseDate = "2026-07-01"): Candidate => ({
  lawId: "x",
  lawName,
  baseDate,
  article: { no, title, text: "본문" },
  score: 10,
});

describe("지시문·요청 글", () => {
  it("지시문에 핵심 규칙이 모두 들어 있다", () => {
    for (const s of ["후보 조문", "3문장 200자", "sources", "fieldJudgment", "found"]) expect(SYSTEM_PROMPT).toContain(s);
  });
  it("앞 대화는 2개까지만 보내고 가장 최근 것을 쓴다", () => {
    const hist = [1, 2, 3].map((n) => ({ question: `질문${n}`, answer: `답${n}` }));
    const p = buildUserPrompt("지금 질문", [candidate("형법", "제1조")], hist);
    expect(p).not.toContain("질문1");
    expect(p).toContain("질문2");
    expect(p).toContain("질문3");
    expect(p.indexOf("[이전 대화]")).toBeLessThan(p.indexOf("[후보 조문]"));
    expect(p.endsWith("[질문]\n지금 질문")).toBe(true);
  });
  it("앞 대화가 없으면 이전 대화 칸이 없다", () => {
    expect(buildUserPrompt("q", [candidate("형법", "제1조")])).not.toContain("[이전 대화]");
  });
  it("너무 긴 조문은 잘라서 보낸다", () => {
    const long = { ...candidate("형법", "제1조"), article: { no: "제1조", title: "", text: "가".repeat(5000) } };
    expect(buildUserPrompt("q", [long]).length).toBeLessThan(2500);
  });
});

describe("AI 응답 읽기 (parseAiAnswer)", () => {
  const good = { found: true, answer: "답", sources: [{ law: "형법", article: "제329조" }], fieldJudgment: false };
  it("JSON 그대로, 코드블록, 앞뒤 설명이 붙어도 읽는다", () => {
    expect(parseAiAnswer(JSON.stringify(good))?.answer).toBe("답");
    expect(parseAiAnswer("```json\n" + JSON.stringify(good) + "\n```")?.answer).toBe("답");
    expect(parseAiAnswer("다음과 같습니다. " + JSON.stringify(good) + " 끝")?.answer).toBe("답");
  });
  it.each(["", "그냥 글", "{깨진", '{"answer":"found 없음"}', "[]"])("읽을 수 없으면 null: %s", (t) => expect(parseAiAnswer(t)).toBeNull());
  it("모양이 이상한 출처는 버린다", () => {
    const r = parseAiAnswer(JSON.stringify({ ...good, sources: [{ law: "형법" }, "x", { law: "형법", article: "제1조" }] }));
    expect(r?.sources).toEqual([{ law: "형법", article: "제1조" }]);
  });
});

describe("답 검사 (checkAnswer)", () => {
  const cands = [candidate("도로교통법", "제44조", "술에 취한 상태에서의 운전 금지", "2026-07-01"), candidate("도로교통법 시행령", "별표 8", "범칙금액", "2026-10-02")];
  const raw = (over: Partial<RawAnswer>): RawAnswer => ({
    found: true,
    answer: "혈중알코올농도 0.03% 이상이면 금지됩니다.",
    sources: [{ law: "도로교통법", article: "제44조" }],
    fieldJudgment: false,
    ...over,
  });

  it("출처마다 법령 파일의 기준일을 앱이 붙인다", () => {
    const r = checkAnswer(raw({ sources: [{ law: "도로교통법", article: "제44조" }, { law: "도로교통법 시행령", article: "별표 8" }] }), cands);
    expect(r.kind === "answer" && r.sources.map((s) => `${s.law} ${s.article} ${s.baseDate}`)).toEqual([
      "도로교통법 제44조 2026-07-01",
      "도로교통법 시행령 별표 8 2026-10-02",
    ]);
  });
  it("조 번호 표기가 달라도(44조, 제 44 조) 같은 조문으로 본다", () => {
    expect(checkAnswer(raw({ sources: [{ law: "도로교통법", article: "44조" }] }), cands).kind).toBe("answer");
    expect(checkAnswer(raw({ sources: [{ law: "도로교통법", article: "제 44 조" }] }), cands).kind).toBe("answer");
  });
  it("후보에 없는(지어낸) 출처는 빼고, 하나도 안 남으면 찾을 수 없음", () => {
    const mixed = checkAnswer(raw({ sources: [{ law: "형법", article: "제999조" }, { law: "도로교통법", article: "제44조" }] }), cands);
    expect(mixed.kind === "answer" && mixed.sources).toHaveLength(1);
    expect(checkAnswer(raw({ sources: [{ law: "형법", article: "제999조" }] }), cands).kind).toBe("not-found");
  });
  it("출처가 없는 답은 찾을 수 없음", () => expect(checkAnswer(raw({ sources: [] }), cands).kind).toBe("not-found"));
  it("found가 false이거나 답이 비면 찾을 수 없음", () => {
    expect(checkAnswer(raw({ found: false }), cands).kind).toBe("not-found");
    expect(checkAnswer(raw({ answer: "  " }), cands).kind).toBe("not-found");
  });
  it("현장 판단 표시는 찾을 수 없음에도 이어진다", () => {
    expect(checkAnswer(raw({ found: false, fieldJudgment: true }), cands)).toEqual({ kind: "not-found", fieldJudgment: true });
  });
  it("같은 출처가 두 번 나오면 하나로", () => {
    const r = checkAnswer(raw({ sources: [{ law: "도로교통법", article: "제44조" }, { law: "도로교통법", article: "44조" }] }), cands);
    expect(r.kind === "answer" && r.sources).toHaveLength(1);
  });
});

describe("분량 제한 (limitAnswer)", () => {
  it("3문장까지만", () => {
    expect(limitAnswer("하나입니다. 둘입니다. 셋입니다. 넷입니다.")).toBe("하나입니다. 둘입니다. 셋입니다.");
  });
  it("200자를 넘으면 뒤 문장부터 버린다", () => {
    const a = "가".repeat(120) + ".";
    const b = "나".repeat(120) + ".";
    expect(limitAnswer(`${a} ${b}`)).toBe(a);
  });
  it("한 문장이 200자를 넘으면 잘라서 …를 붙인다", () => {
    const out = limitAnswer("가".repeat(400));
    expect(out.length).toBe(200);
    expect(out.endsWith("…")).toBe(true);
  });
  it("짧은 답은 그대로", () => expect(limitAnswer("짧은 답입니다.")).toBe("짧은 답입니다."));
});

describe("AI 요청·응답 모양 (세 AI)", () => {
  it("키는 주소에 넣지 않고 머리글에만", () => {
    for (const p of ["chatgpt", "gemini", "claude"] as AiProvider[]) {
      const r = buildChatRequest(p, "SECRETKEY", "시스템", "사용자");
      expect(r.url).not.toContain("SECRETKEY");
      expect(Object.values(r.headers).join(" ")).toContain("SECRETKEY");
      expect(JSON.stringify(r.body)).toContain("시스템");
      expect(JSON.stringify(r.body)).toContain("사용자");
      expect(JSON.stringify(r.body)).not.toContain("SECRETKEY");
    }
  });
  it("글 꺼내기", () => {
    expect(extractText("chatgpt", { choices: [{ message: { content: "A" } }] })).toBe("A");
    expect(extractText("gemini", { candidates: [{ content: { parts: [{ text: "B" }, { text: "C" }] } }] })).toBe("BC");
    expect(extractText("claude", { content: [{ type: "text", text: "D" }] })).toBe("D");
    expect(extractText("claude", { content: [] })).toBeNull();
    expect(extractText("chatgpt", null)).toBeNull();
  });
  it("상태 코드 → 이유", () => {
    expect(reasonFromCallStatus(401, "")).toBe("invalid-key");
    expect(reasonFromCallStatus(400, "API key not valid")).toBe("invalid-key");
    expect(reasonFromCallStatus(400, "bad request")).toBe("unknown");
    expect(reasonFromCallStatus(429, "")).toBe("limit");
    expect(reasonFromCallStatus(404, "")).toBe("model");
    expect(reasonFromCallStatus(500, "")).toBe("unknown");
  });
  it("호출 결과: 성공·거절·끊김·시간 초과", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "응답" } }] }))) as unknown as typeof fetch;
    expect(await callAi("chatgpt", "k", "s", "u", { fetchFn: ok, online: true })).toEqual({ ok: true, text: "응답" });
    const denied = vi.fn(async () => new Response("no", { status: 401 })) as unknown as typeof fetch;
    expect(await callAi("chatgpt", "k", "s", "u", { fetchFn: denied, online: true })).toEqual({ ok: false, reason: "invalid-key" });
    expect(await callAi("chatgpt", "k", "s", "u", { fetchFn: ok, online: false })).toEqual({ ok: false, reason: "offline" });
    const timeout = vi.fn(async () => {
      throw new DOMException("t", "TimeoutError");
    }) as unknown as typeof fetch;
    expect(await callAi("chatgpt", "k", "s", "u", { fetchFn: timeout, online: true })).toEqual({ ok: false, reason: "timeout" });
    const blocked = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await callAi("chatgpt", "k", "s", "u", { fetchFn: blocked, online: true })).toEqual({ ok: false, reason: "unreachable" });
  });
});

describe("질문 하나 처리 (ask)", () => {
  const conn: AiConnection = { provider: "claude", apiKey: "test-key", verifiedAt: "2026-10-12T00:00:00.000Z" };
  const reply = (obj: unknown) =>
    vi.fn(async () => new Response(JSON.stringify({ content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj) }] }))) as unknown as typeof fetch;

  it("빈 질문·500자 초과는 AI를 부르지 않는다", async () => {
    const f = reply({});
    expect((await ask({ question: "  ", connection: conn, index, fetchFn: f, online: true })).kind).toBe("invalid-question");
    expect((await ask({ question: "가".repeat(501), connection: conn, index, fetchFn: f, online: true })).kind).toBe("invalid-question");
    expect(f).not.toHaveBeenCalled();
  });
  it("개인정보가 든 질문은 AI로 보내지 않는다", async () => {
    const f = reply({});
    const r = await ask({ question: "010-1234-5678 번호 주인이 운전면허 있나요", connection: conn, index, fetchFn: f, online: true });
    expect(r.kind).toBe("privacy");
    expect(f).not.toHaveBeenCalled();
  });
  it("관련 조문이 없으면 AI를 부르지 않고 찾을 수 없음", async () => {
    const f = reply({});
    const r = await ask({ question: "오늘 저녁 메뉴 추천해줘", connection: conn, index, fetchFn: f, online: true });
    expect(r).toEqual({ kind: "not-found", answer: { kind: "not-found", fieldJudgment: false }, sentToAi: false });
    expect(f).not.toHaveBeenCalled();
  });
  it("정상: 후보 조문과 지시문을 보내고, 검사한 답에 기준일을 붙인다", async () => {
    const f = reply({ found: true, answer: "술에 취한 상태에서는 운전할 수 없습니다.", sources: [{ law: "도로교통법", article: "제44조" }], fieldJudgment: false });
    const r = await ask({ question: "음주운전 기준이 어떻게 되나요?", connection: conn, index, fetchFn: f, online: true });
    expect(r.kind).toBe("answer");
    if (r.kind === "answer" && r.answer.kind === "answer") {
      expect(r.answer.sources[0]).toMatchObject({ law: "도로교통법", article: "제44조", baseDate: "2026-07-01" });
    }
    const [, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const sent = String(init.body);
    expect(sent).toContain("후보 조문");
    expect(sent).toContain("제44조");
    expect(sent).not.toContain("test-key"); // 키는 본문에 들어가지 않는다
  });
  it("AI가 후보에 없는 출처를 지어내면 찾을 수 없음으로 바꾼다", async () => {
    const f = reply({ found: true, answer: "그럴듯한 답", sources: [{ law: "도로교통법", article: "제999조" }], fieldJudgment: false });
    const r = await ask({ question: "음주운전 기준이 어떻게 되나요?", connection: conn, index, fetchFn: f, online: true });
    expect(r.kind).toBe("not-found");
  });
  it("현장 판단 표시를 그대로 전한다", async () => {
    const f = reply({ found: true, answer: "체포 요건은 이 조에 있습니다.", sources: [{ law: "형사소송법", article: "제212조" }], fieldJudgment: true });
    const r = await ask({ question: "현행범인은 체포해도 되나요", connection: conn, index, fetchFn: f, online: true });
    expect(r.kind === "answer" && r.answer.kind === "answer" && r.answer.fieldJudgment).toBe(true);
  });
  it("AI가 JSON이 아닌 글을 주면 bad-answer", async () => {
    const r = await ask({ question: "음주운전 기준이 어떻게 되나요?", connection: conn, index, fetchFn: reply("죄송합니다"), online: true });
    expect(r).toEqual({ kind: "ai-error", reason: "bad-answer" });
  });
  it("AI 회사가 키를 거절하면 이유를 전한다", async () => {
    const f = vi.fn(async () => new Response("no", { status: 401 })) as unknown as typeof fetch;
    const r = await ask({ question: "음주운전 기준이 어떻게 되나요?", connection: conn, index, fetchFn: f, online: true });
    expect(r).toEqual({ kind: "ai-error", reason: "invalid-key" });
  });
  it("개인정보가 있었던 직전 질문은 문맥으로 보내지 않는다", async () => {
    const f = reply({ found: false, answer: "", sources: [], fieldJudgment: false });
    await ask({
      question: "그럼 처벌은 어떻게 되나요",
      history: [
        { question: "홍길동 씨가 음주운전을 했어요", answer: "답" },
        { question: "음주운전 기준이 뭔가요", answer: "답2" },
      ],
      connection: conn,
      index,
      fetchFn: f,
      online: true,
    });
    const body = String(((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit])[1].body);
    expect(body).not.toContain("홍길동");
    expect(body).toContain("음주운전 기준이 뭔가요");
    expect(searchArticles(index, "음주운전").length).toBeGreaterThan(0);
  });
});
