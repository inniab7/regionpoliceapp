// Design Ref: §5.3 ⑤ — 법령 불러오기: index.json의 법령별 버전을 확인하고, 법령 파일은 버전이 붙은 주소로 받는다
// Plan: 작업 31 — 질문 화면. 같은 버전이면 브라우저가 저장해 둔 파일을 다시 쓰고, 버전이 바뀌면 새 주소라서 새로 받는다.
import type { LoadedLaw } from "./search";
import { parseLawDocument, parseLawIndex, type LawIndexEntry } from "./types";

/** 법령 파일을 받는 곳 (public/laws → /laws) */
export const LAWS_BASE = "/laws";

export class LawLoadError extends Error {}

async function getJson(fetchFn: typeof fetch, url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetchFn(url, init);
  if (!res.ok) throw new LawLoadError(`${url} ${res.status}`);
  return res.json();
}

/** 법령 하나를 받아 검사한다. 파일이 망가졌거나 index.json의 기준일과 다르면 쓰지 않는다 */
async function loadOne(fetchFn: typeof fetch, base: string, entry: LawIndexEntry): Promise<LoadedLaw> {
  // 버전을 주소에 붙여, 버전이 같으면 브라우저 저장본을 쓰고 달라지면 새로 받게 한다
  const value = await getJson(fetchFn, `${base}/${entry.file}?v=${encodeURIComponent(entry.version)}`);
  const document = parseLawDocument(value);
  if (!document || document.baseDate !== entry.baseDate) throw new LawLoadError(`${entry.file} 형식이 맞지 않아요`);
  return { id: entry.id, document };
}

/** 등록된 법령 전부를 불러온다. 하나라도 못 받으면 실패(일부 법령만으로 답하지 않는다) */
export async function loadLaws(fetchFn: typeof fetch = fetch, base: string = LAWS_BASE): Promise<LoadedLaw[]> {
  // index.json은 매번 서버에 새 버전이 있는지 확인한다
  const index = parseLawIndex(await getJson(fetchFn, `${base}/index.json`, { cache: "no-cache" }));
  if (!index || index.laws.length === 0) throw new LawLoadError("index.json 형식이 맞지 않아요");
  return Promise.all(index.laws.map((entry) => loadOne(fetchFn, base, entry)));
}

let cached: Promise<LoadedLaw[]> | null = null;

/** 화면을 여는 동안 메모리에 둔다. 실패하면 다음에 다시 받아 보게 비워 둔다 */
export function loadLawsOnce(): Promise<LoadedLaw[]> {
  if (!cached) {
    cached = loadLaws().catch((e) => {
      cached = null;
      throw e;
    });
  }
  return cached;
}
