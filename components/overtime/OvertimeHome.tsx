// Design Ref: §4.1·§4.2 — 첫 접속(등록 정보 없음)이면 등록 화면으로 안내, 등록되어 있으면 초과근무 화면
// Plan: 작업 19·20 — 첫 접속 안내, 등록되어 있으면 달력 화면(OvertimeScreen). 결과 4줄은 작업 23.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAppData } from "@/lib/storage/useAppData";
import OvertimeScreen from "./OvertimeScreen";

export default function OvertimeHome() {
  const router = useRouter();
  const app = useAppData();

  // 등록한 적이 없으면 등록 화면으로 보낸다
  useEffect(() => {
    if (app.status === "empty" || (app.status === "ok" && app.data.profiles.length === 0)) router.replace("/setup");
  }, [app, router]);

  if (app.status === "loading" || app.status === "empty") {
    return <p className="text-zinc-600 dark:text-zinc-400">불러오는 중…</p>;
  }

  if (app.status === "unavailable") {
    return (
      <section>
        <h1 className="text-2xl font-bold">초과근무</h1>
        <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-base text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          이 브라우저에서는 정보를 저장할 수 없어요. 사생활 보호 모드라면 끄고 다시 열어 주세요.
        </p>
      </section>
    );
  }

  if (app.status === "corrupt") {
    return (
      <section>
        <h1 className="text-2xl font-bold">초과근무</h1>
        <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-base text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          저장된 정보를 읽을 수 없어요. 자동으로 지우지는 않았어요. 새로 등록하면 이전에 저장된 정보는 지워져요.
        </p>
        <Link
          href="/setup"
          className="mt-4 flex h-12 items-center justify-center rounded-lg bg-blue-700 text-base font-bold text-white dark:bg-blue-500"
        >
          새로 등록하기
        </Link>
      </section>
    );
  }

  // 등록한 근무 정보가 있으면 달력 화면 (등록 이력이 비어 있으면 위의 effect가 등록 화면으로 보낸다)
  if (app.data.profiles.length === 0) return null;
  return <OvertimeScreen data={app.data} />;
}
