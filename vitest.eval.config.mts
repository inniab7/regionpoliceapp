// Vitest 설정 — 정답률 시험 (`npm run eval`, PLAN 작업 32)
// 실제 AI를 부르므로 시간이 걸리고 요금이 나간다. Yuni 본인 키는 .env에서 읽는다(앱 코드에서는 읽지 않음).
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    // AI 응답을 기다려야 해서 한 문항당 넉넉히 기다린다
    testTimeout: 60_000,
  },
});
