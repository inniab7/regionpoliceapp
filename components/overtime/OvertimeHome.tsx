// Design Ref: §4.1·§4.2 — 첫 접속(등록 정보 없음)이면 등록 화면으로 안내, 등록되어 있으면 초과근무 화면
// Plan: 작업 19 — 첫 접속 안내. 달력·결과는 작업 20·23에서 이 자리에 채운다.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { profileOn } from "@/lib/storage/store";
import { useAppData } from "@/lib/storage/useAppData";
import { todayInKst } from "@/lib/time";

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

  const profile = profileOn(app.data, todayInKst(new Date())) ?? app.data.profiles.at(-1);
  if (!profile) return null;

  return (
    <section>
      <h1 className="text-2xl font-bold">초과근무</h1>
      <p className="mt-2 text-base">
        {profile.agency} {profile.department} {profile.team}
      </p>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        근무표 달력과 이번 달 초과근무 결과가 여기에 표시됩니다. (준비 중)
      </p>
    </section>
  );
}
