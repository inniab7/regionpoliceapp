// Design Ref: §7.1 — AI에게 보내는 것(세 AI 공통): 지시문, 후보 조문, 앞 대화(2개까지), 질문
// Plan: 작업 29 — 답변 만들기. 규칙은 이 한 곳에서만 정한다. AI마다 따로 규칙을 만들지 않는다(CLAUDE.md 5장).
import type { Candidate } from "../laws/search";

/** 이어서 묻기 문맥: 직전 질문과 그 답 */
export interface HistoryTurn {
  question: string;
  answer: string;
}

/** 앞 대화로 보내는 최대 개수 */
export const MAX_HISTORY = 2;

/** 후보 조문 한 건을 AI에 보여 줄 때 자르는 길이 (너무 긴 조문·별표가 요청을 키우지 않게) */
export const MAX_ARTICLE_CHARS = 1800;

/** 세 AI 공통 지시문 (PRD 5장 ② 규칙 1~3·6) */
export const SYSTEM_PROMPT = [
  "당신은 대한민국 경찰관을 돕는 법령 안내 도우미입니다.",
  "반드시 아래 [후보 조문]에 적힌 내용 안에서만 답하세요. 조문에 없는 내용은 추측하거나 지어내지 마세요.",
  "후보 조문에서 답을 찾을 수 없으면 found를 false로 하세요.",
  "답은 결론부터 쓰고, 3문장 200자 이내로 간결하게 쓰세요.",
  "질문에 어린이보호구역·가중처벌 같은 특별한 조건이 없으면 일반 규정을 근거로 쓰고, 조건이 있는 특별 규정(예: 보호구역 범칙금표)은 질문에 그 조건이 있을 때만 쓰세요.",
  "근거로 쓴 조문을 sources에 모두 적으세요. law는 법령 이름, article은 조 번호(예: 제44조, 별표 8)이며 [후보 조문]에 있는 것만 쓰세요.",
  "'체포해도 되나요?', '해도 되나요?'처럼 현장에서 할지 말지의 판단을 묻는 질문이면 fieldJudgment를 true로 하고, \"된다/안 된다\", \"네/아니요\"처럼 판단하는 말은 쓰지 말고 관련 조문의 요건과 내용만 그대로 알려 주세요.",
  "이전 대화는 질문의 맥락을 이해하는 데만 쓰고, 답의 근거는 반드시 [후보 조문]이어야 합니다.",
  '출력은 JSON 한 덩어리만 쓰세요(설명·코드블록 금지): {"found": true 또는 false, "answer": "답", "sources": [{"law": "법령 이름", "article": "조 번호"}], "fieldJudgment": true 또는 false}',
].join("\n");

function clip(text: string): string {
  return text.length <= MAX_ARTICLE_CHARS ? text : `${text.slice(0, MAX_ARTICLE_CHARS)}…(이하 생략)`;
}

/** 후보 조문을 AI가 읽을 글로 만든다 */
export function formatCandidates(candidates: Candidate[]): string {
  return candidates
    .map((c, i) => `(${i + 1}) ${c.lawName} ${c.article.no}${c.article.title ? ` ${c.article.title}` : ""}\n${clip(c.article.text)}`)
    .join("\n\n");
}

/** AI에 보낼 사용자 쪽 글: 앞 대화 + 후보 조문 + 질문 */
export function buildUserPrompt(question: string, candidates: Candidate[], history: HistoryTurn[] = []): string {
  const parts: string[] = [];
  const recent = history.slice(-MAX_HISTORY);
  if (recent.length > 0) {
    parts.push(
      "[이전 대화]\n" + recent.map((h) => `질문: ${h.question}\n답: ${h.answer}`).join("\n\n"),
    );
  }
  parts.push(`[후보 조문]\n${formatCandidates(candidates)}`);
  parts.push(`[질문]\n${question.trim()}`);
  return parts.join("\n\n");
}
