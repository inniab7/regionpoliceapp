// Design Ref: §9 — 규정 정답률 시험 (`npm run eval`). 실제 AI를 부르므로 시간이 걸리고 요금이 아주 조금 나간다.
// Plan: 작업 32 — 정답률 검증. 연결 가능한 AI 각각이 질문 20개 중 18개 이상 맞아야 통과(PRD 성공 기준 5).
// 개발·시험용 키(Yuni 본인 것)는 `.env`에서 읽는다. 앱 코드는 `.env`를 읽지 않고, 키 값은 어디에도 출력·저장하지 않는다.
//   OPENAI_API_KEY → ChatGPT, GEMINI_API_KEY → Gemini, ANTHROPIC_API_KEY → Claude (없는 AI는 건너뛴다)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { ask } from "../lib/ai/ask";
import { MAX_ANSWER_CHARS } from "../lib/ai/check";
import { toView } from "../lib/ai/messages";
import { AI_MODELS } from "../lib/ai/call";
import { buildSearchIndex, type SearchIndex } from "../lib/laws/search";
import { parseLawDocument, parseLawIndex } from "../lib/laws/types";
import { AI_PROVIDER_LABELS, type AiProvider } from "../lib/types";
import { EVAL_QUESTIONS, type EvalQuestion } from "./questions";

const PASS_LINE = 18;
const KEY_NAMES: Record<AiProvider, string[]> = {
  chatgpt: ["OPENAI_API_KEY"],
  gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  claude: ["ANTHROPIC_API_KEY"],
};

/** .env 파일에서 키를 읽는다 (없으면 빈 값). 값은 이 함수 밖으로 출력하지 않는다 */
function readEnv(): Record<string, string> {
  try {
    const env: Record<string, string> = {};
    for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return env;
  } catch {
    return {};
  }
}

const env = { ...readEnv(), ...process.env } as Record<string, string | undefined>;
const keyOf = (p: AiProvider) => KEY_NAMES[p].map((n) => env[n]).find((v) => v && v.trim() !== "");

let index: SearchIndex;
beforeAll(() => {
  const read = (f: string): unknown => JSON.parse(readFileSync(`public/laws/${f}`, "utf8"));
  const idx = parseLawIndex(read("index.json"))!;
  index = buildSearchIndex(idx.laws.map((l) => ({ id: l.id, document: parseLawDocument(read(l.file))! })));
});

interface Graded {
  q: EvalQuestion;
  pass: boolean;
  reason: string;
  shown: string;
}

async function grade(provider: AiProvider, apiKey: string, q: EvalQuestion): Promise<Graded> {
  const result = await ask({ question: q.question, connection: { provider, apiKey, verifiedAt: new Date().toISOString() }, index });
  const view = toView(result);
  const hasSource = (srcs: { law: string; article: string }[]) =>
    view.kind === "answer" && view.sources.some((s) => srcs.some((x) => x.law === s.law && x.article === s.article));
  const shown =
    view.kind === "answer"
      ? `${view.text} [출처: ${view.sources.map((s) => `${s.law} ${s.article}`).join(", ")}]${view.fieldJudgmentNotice ? " [현장 판단 문구]" : ""}`
      : `${view.message}${view.fieldJudgmentNotice ? " [현장 판단 문구]" : ""}`;

  if (view.kind === "answer" && view.text.length > MAX_ANSWER_CHARS) return { q, pass: false, reason: "200자 초과", shown };
  if (view.kind === "answer" && view.sources.length === 0) return { q, pass: false, reason: "출처 없음", shown };

  const e = q.expect;
  if (e.type === "not-found") {
    return { q, pass: view.kind === "notice" && view.tone === "not-found", reason: "자료에 없다고 답해야 함", shown };
  }
  if (e.type === "field") {
    const fieldOk = (view.kind === "answer" || view.kind === "notice") && view.fieldJudgmentNotice !== null;
    const sourceOk = view.kind === "notice" || hasSource(e.sources);
    return { q, pass: fieldOk && sourceOk, reason: fieldOk ? "출처가 정답표와 다름" : "현장 판단 문구가 없음", shown };
  }
  if (!hasSource(e.sources)) {
    return { q, pass: false, reason: view.kind === "answer" ? "출처가 정답표와 다름" : "답을 하지 못함(찾을 수 없음 등)", shown };
  }
  const missing = (q.facts ?? []).filter((f) => !(view.kind === "answer" && view.text.includes(f)));
  return { q, pass: missing.length === 0, reason: `답에 핵심 내용이 없음: ${missing.join(", ")}`, shown };
}

/** 한 번에 몇 개씩 AI에 보낼지 (한도에 걸리지 않게 작게) */
async function runAll(provider: AiProvider, apiKey: string): Promise<Graded[]> {
  const out: Graded[] = [];
  for (let i = 0; i < EVAL_QUESTIONS.length; i += 4) {
    out.push(...(await Promise.all(EVAL_QUESTIONS.slice(i, i + 4).map((q) => grade(provider, apiKey, q)))));
  }
  return out;
}

function writeReport(provider: AiProvider, graded: Graded[]) {
  const passed = graded.filter((g) => g.pass).length;
  const lines = [
    `# 규정 정답률 시험 결과 — ${AI_PROVIDER_LABELS[provider]} (${AI_MODELS[provider]})`,
    "",
    `- 정답 **${passed} / ${graded.length}** (통과 기준 ${PASS_LINE}개 이상) → ${passed >= PASS_LINE ? "✅ 통과" : "❌ 미달"}`,
    `- 시험 날짜: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "| 번호 | 결과 | 질문 | AI 답(화면에 보이는 그대로) | 정답 요지 |",
    "|---|---|---|---|---|",
    ...graded.map((g) => `| ${g.q.no} | ${g.pass ? "○" : `✗ (${g.reason})`} | ${g.q.question} | ${g.shown.replace(/\|/g, "／").replace(/\n/g, " ")} | ${g.q.keyPoint} |`),
    "",
  ];
  mkdirSync("evals/results", { recursive: true });
  writeFileSync(`evals/results/${provider}.md`, lines.join("\n"), "utf8");
}

for (const provider of ["chatgpt", "gemini", "claude"] as AiProvider[]) {
  const apiKey = keyOf(provider);
  describe(`${AI_PROVIDER_LABELS[provider]} 정답률`, () => {
    it.skipIf(!apiKey)(`질문 20개 중 ${PASS_LINE}개 이상 정답, 모든 답에 출처`, async () => {
      const graded = await runAll(provider, apiKey!);
      writeReport(provider, graded);
      const passed = graded.filter((g) => g.pass).length;
      const failed = graded.filter((g) => !g.pass).map((g) => `${g.q.no}번(${g.reason})`);
      expect(passed, `${passed}/20 — 틀린 문항: ${failed.join(", ")} (자세한 내용 evals/results/${provider}.md)`).toBeGreaterThanOrEqual(PASS_LINE);
    });
  });
}
