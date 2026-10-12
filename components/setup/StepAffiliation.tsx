// Design Ref: §4.3 — 등록 1단계: 소속청(글 입력), 부서(목록 6개), 팀(글 입력)
// Plan: 작업 15 — 등록 ① 소속 입력
"use client";

import { useState } from "react";
import { DEPARTMENTS, type Department } from "@/lib/types";

export interface AffiliationValue {
  agency: string;
  department: Department | null;
  team: string;
}

/** 글자 수 제한 (화면이 깨지지 않을 정도) */
const AGENCY_MAX = 30;
const TEAM_MAX = 20;

type Errors = Partial<Record<keyof AffiliationValue, string>>;

/** 입력 검사. 문제가 없으면 빈 객체 */
export function validateAffiliation(v: AffiliationValue): Errors {
  const errors: Errors = {};
  if (!v.agency.trim()) errors.agency = "소속청을 입력해 주세요.";
  else if (v.agency.trim().length > AGENCY_MAX) errors.agency = `소속청은 ${AGENCY_MAX}자까지 쓸 수 있어요.`;
  if (!v.department) errors.department = "부서를 골라 주세요.";
  if (!v.team.trim()) errors.team = "팀을 입력해 주세요.";
  else if (v.team.trim().length > TEAM_MAX) errors.team = `팀은 ${TEAM_MAX}자까지 쓸 수 있어요.`;
  return errors;
}

interface Props {
  value: AffiliationValue;
  onChange: (value: AffiliationValue) => void;
  onNext: () => void;
}

const inputClass =
  "mt-2 block h-12 w-full rounded-lg border border-zinc-300 bg-background px-3 text-base outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/30 aria-invalid:border-red-600 dark:border-zinc-600 dark:focus:border-blue-400";

export default function StepAffiliation({ value, onChange, onNext }: Props) {
  // [다음]을 한 번 누른 뒤부터 안내 문구를 보여 준다 (처음부터 빨간 글씨가 뜨지 않게)
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validateAffiliation(value) : {};

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateAffiliation(value)).length === 0) {
      onChange({ ...value, agency: value.agency.trim(), team: value.team.trim() });
      onNext();
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <div>
        <label htmlFor="agency" className="text-base font-bold">
          소속청
        </label>
        <input
          id="agency"
          name="agency"
          type="text"
          autoComplete="off"
          placeholder="예: 서울경찰청"
          maxLength={AGENCY_MAX}
          value={value.agency}
          onChange={(e) => onChange({ ...value, agency: e.target.value })}
          aria-invalid={errors.agency ? true : undefined}
          aria-describedby={errors.agency ? "agency-error" : undefined}
          className={inputClass}
        />
        {errors.agency && (
          <p id="agency-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.agency}
          </p>
        )}
      </div>

      <fieldset aria-describedby={errors.department ? "department-error" : undefined}>
        <legend className="text-base font-bold">부서</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {DEPARTMENTS.map((dept) => {
            const selected = value.department === dept;
            return (
              <label
                key={dept}
                className={`flex h-12 cursor-pointer items-center justify-center rounded-lg border text-base has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-700/40 ${
                  selected
                    ? "border-blue-700 bg-blue-700 font-bold text-white dark:border-blue-500 dark:bg-blue-500"
                    : "border-zinc-300 dark:border-zinc-600"
                }`}
              >
                <input
                  type="radio"
                  name="department"
                  value={dept}
                  checked={selected}
                  onChange={() => onChange({ ...value, department: dept })}
                  className="sr-only"
                />
                {dept}
              </label>
            );
          })}
        </div>
        {errors.department && (
          <p id="department-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.department}
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor="team" className="text-base font-bold">
          팀
        </label>
        <input
          id="team"
          name="team"
          type="text"
          autoComplete="off"
          placeholder="예: 1팀"
          maxLength={TEAM_MAX}
          value={value.team}
          onChange={(e) => onChange({ ...value, team: e.target.value })}
          aria-invalid={errors.team ? true : undefined}
          aria-describedby={errors.team ? "team-error" : undefined}
          className={inputClass}
        />
        {errors.team && (
          <p id="team-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.team}
          </p>
        )}
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        이름·연락처·계급·사번은 받지 않아요. 입력한 내용은 이 기기에만 저장돼요.
      </p>

      <button
        type="submit"
        className="h-12 w-full rounded-lg bg-blue-700 text-base font-bold text-white dark:bg-blue-500"
      >
        다음
      </button>
    </form>
  );
}
