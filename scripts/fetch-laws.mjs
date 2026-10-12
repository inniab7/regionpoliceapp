// 법령 7종을 국가법령정보센터 공개 API에서 받아 public/laws/ 에 넣는다. (PLAN 작업 26)
// 사용: npm run laws   (법령이 개정되면 다시 실행 → index.json의 기준일·버전이 바뀌고, 사용자 기기가 새 파일을 받는다)
// 인증값(OC)은 기본 "test"(공개 시험용)를 쓴다. 본인 OC가 있으면 .env의 LAW_OC로 바꿀 수 있다.
// 공개 법령 데이터만 받는다. 키·개인정보는 오가지 않는다.
import { mkdir, writeFile } from "node:fs/promises";
import { convertLaw, findLawSerial } from "../lib/laws/convert.ts";
import { DEFAULT_LAWS } from "../lib/laws/types.ts";

const OC = process.env.LAW_OC || "test";
const BASE = "https://www.law.go.kr/DRF";
const OUT = new URL("../public/laws/", import.meta.url);

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`요청 실패 ${res.status}`);
  return res.json();
}

await mkdir(OUT, { recursive: true });
const entries = [];
let failed = 0;

for (const law of DEFAULT_LAWS) {
  try {
    const search = await getJson(
      `${BASE}/lawSearch.do?OC=${OC}&target=law&type=JSON&display=100&query=${encodeURIComponent(law.name)}`,
    );
    const serial = findLawSerial(search, law.name);
    if (!serial) throw new Error("현행 법령을 찾지 못했어요");
    const doc = convertLaw(await getJson(`${BASE}/lawService.do?OC=${OC}&target=law&type=JSON&MST=${serial}`), law.name);
    if (!doc) throw new Error("받은 내용을 법령 파일로 바꾸지 못했어요");
    const file = `${law.id}.json`;
    await writeFile(new URL(file, OUT), JSON.stringify(doc), "utf8");
    entries.push({ id: law.id, name: law.name, baseDate: doc.baseDate, version: `${doc.baseDate}-${serial}`, file });
    console.log(`✔ ${law.name}: 조문 ${doc.articles.length}개, 기준일 ${doc.baseDate}`);
  } catch (e) {
    failed++;
    console.error(`✘ ${law.name}: ${e.message}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed}개 실패 — index.json은 바꾸지 않았어요. 다시 실행해 주세요.`);
  process.exit(1);
}
await writeFile(new URL("index.json", OUT), JSON.stringify({ laws: entries }, null, 2) + "\n", "utf8");
console.log("\nindex.json을 갱신했어요.");
