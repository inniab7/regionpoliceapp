// Design Ref: §5.3 ②~⑧ — 질문 하나를 처리하는 전체 흐름: 입력 검사 → 개인정보 검사 → 조문 찾기 → AI 호출 → 답 검사
// Plan: 작업 29 — 답변 만들기. (오류 문구 정리는 작업 30, 화면 연결은 작업 31)
import { searchArticles, type SearchIndex } from "../laws/search";
import { PRIVACY_BLOCK_MESSAGE, detectPersonalInfo, type PrivacyKind } from "../privacy/detect";
import type { AiConnection } from "../types";
import { callAi, type CallFailureReason } from "./call";
import { checkAnswer, parseAiAnswer, type FinalAnswer } from "./check";
import { SYSTEM_PROMPT, buildUserPrompt, type HistoryTurn } from "./prompt";

/** 질문 최대 글자 수 (DESIGN 7.3) */
export const MAX_QUESTION_CHARS = 500;

export type AskResult =
  | { kind: "invalid-question" } // 빈 질문 또는 500자 초과
  | { kind: "privacy"; found: PrivacyKind[]; message: string } // 개인정보 감지 — AI로 보내지 않음
  | { kind: "answer" | "not-found"; answer: FinalAnswer; sentToAi: boolean }
  | { kind: "ai-error"; reason: CallFailureReason | "bad-answer" };

export interface AskInput {
  question: string;
  history?: HistoryTurn[];
  connection: AiConnection;
  index: SearchIndex;
  fetchFn?: typeof fetch;
  online?: boolean;
}

/** 질문 하나에 답한다. 개인정보가 든 질문과 관련 조문이 없는 질문은 AI를 부르지 않는다 */
export async function ask(input: AskInput): Promise<AskResult> {
  const question = input.question.trim();
  if (question === "" || question.length > MAX_QUESTION_CHARS) return { kind: "invalid-question" };

  // 직전 질문들에도 개인정보가 없도록 현재 질문만 검사하고, 문맥으로 보내는 직전 질문·답은 이미 검사를 통과한 것만 쓴다
  const found = detectPersonalInfo(question);
  if (found.length > 0) return { kind: "privacy", found, message: PRIVACY_BLOCK_MESSAGE };

  const history = (input.history ?? []).filter((h) => detectPersonalInfo(h.question).length === 0);
  const candidates = searchArticles(input.index, question, { previous: history.map((h) => h.question) });
  if (candidates.length === 0) {
    return { kind: "not-found", answer: { kind: "not-found", fieldJudgment: false }, sentToAi: false };
  }

  const result = await callAi(input.connection.provider, input.connection.apiKey, SYSTEM_PROMPT, buildUserPrompt(question, candidates, history), {
    fetchFn: input.fetchFn,
    online: input.online,
  });
  if (!result.ok) return { kind: "ai-error", reason: result.reason };

  const raw = parseAiAnswer(result.text);
  if (!raw) return { kind: "ai-error", reason: "bad-answer" };

  const answer = checkAnswer(raw, candidates);
  return { kind: answer.kind, answer, sentToAi: true };
}
