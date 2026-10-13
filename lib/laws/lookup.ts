// Design Ref: §4.4 — AI를 연결하지 않았을 때의 "조문 검색" 모드
// AI 없이 등록된 법령에서 질문과 가까운 조문을 찾아 그대로 보여 준다. 서버·AI로 아무것도 보내지 않는다.
// 질문의 개인정보 검사는 AI 질문과 똑같이 먼저 한다 (같은 화면 입력창을 쓰므로).
import { PRIVACY_BLOCK_MESSAGE, detectPersonalInfo } from "../privacy/detect";
import { searchArticles, type SearchIndex } from "./search";

/** 질문 최대 글자 수 (AI 질문과 같다, DESIGN 7.3) */
export const MAX_LOOKUP_CHARS = 500;
/** 보여 줄 조문 최대 개수 */
export const LOOKUP_LIMIT = 3;

/** 찾은 조문 하나 (법령 이름·조 번호·제목·전문·기준일) */
export interface LookupItem {
  law: string;
  no: string;
  title: string;
  text: string;
  baseDate: string;
}

export type LookupResult =
  | { kind: "invalid" } // 빈 질문 또는 500자 초과
  | { kind: "privacy"; message: string } // 개인정보 감지 — 검색하지 않음
  | { kind: "not-found" }
  | { kind: "found"; items: LookupItem[] };

/** 질문과 가장 가까운 조문 최대 3개를 돌려준다. 순수 함수 */
export function lookupArticles(index: SearchIndex, question: string): LookupResult {
  const q = question.trim();
  if (q === "" || q.length > MAX_LOOKUP_CHARS) return { kind: "invalid" };
  if (detectPersonalInfo(q).length > 0) return { kind: "privacy", message: PRIVACY_BLOCK_MESSAGE };

  const found = searchArticles(index, q, { limit: LOOKUP_LIMIT });
  if (found.length === 0) return { kind: "not-found" };
  return {
    kind: "found",
    items: found.map((c) => ({
      law: c.lawName,
      no: c.article.no,
      title: c.article.title,
      text: c.article.text,
      baseDate: c.baseDate,
    })),
  };
}
