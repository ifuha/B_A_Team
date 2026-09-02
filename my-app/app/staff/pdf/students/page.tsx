"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/src/components/AppHeader";
import { getJson } from "@/src/lib/api-client";
import { FINAL_RANK_LABEL } from "@/src/lib/grade-labels";

type Me = {
  id: number;
  role: "teacher" | "full_time_teacher";
  mustChangePassword: boolean;
  name: string;
};

type GradeEntry = {
  subjectName: string;
  year: number;
  term: number;
  attendanceRate: number | null;
  attitudeClass: number | null;
  homeworkEvaluation: number | null;
  finalRank: string | null;
  isIncomplete: boolean;
};

type StudentDetail = {
  student: {
    id: number;
    name: string;
    studentNumber: string;
    majorName: string;
    gradeLevel: number;
  };
  gradeYears: Record<string, GradeEntry[]>;
};

type DetailResponse = { students: StudentDetail[] };

const TERM_LABEL: Record<number, string> = { 1: "前期", 2: "後期" };

export default function AllStudentsPdfPreview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const year = searchParams.get("year") ?? String(new Date().getFullYear());

  const [me, setMe] = useState<Me | null>(null);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const result = await getJson<Me>("/auth/me");
      if (!result.ok) {
        router.replace("/");
        return;
      }
      setMe(result.data);
    })();
  }, [router]);

  useEffect(() => {
    if (!me) return;
    (async () => {
      const result = await getJson<DetailResponse>(
        `/reports/students/detail?year=${year}`,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setData(result.data);
    })();
  }, [me, year]);

  if (!me) {
    return (
      <div className="flex min-h-screen flex-col bg-[#EFF2F7]">
        <AppHeader />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#7d90c2]">
      <AppHeader
        title="PDF出力"
        left={
          <button
            type="button"
            onClick={() => router.push("/staff")}
            className="rounded-sm bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
          >
            ← 戻る
          </button>
        }
        right={
          <a
            href={`/api/reports/students/pdf?year=${year}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-sm bg-white px-4 py-1.5 text-sm text-[#2E4374] hover:bg-gray-100"
          >
            ダウンロード
          </a>
        }
      />

      <main className="flex-1 space-y-6 p-6">
        {error && (
          <p className="mb-4 rounded bg-white p-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {data && data.students.length === 0 && (
          <p className="rounded bg-white p-3 text-sm text-gray-600">
            対象データがありません
          </p>
        )}

        {data?.students.map(({ student, gradeYears }) => {
          const levels = Object.keys(gradeYears)
            .map(Number)
            .sort((a, b) => a - b);

          return (
            <div
              key={student.id}
              className="mx-auto max-w-4xl rounded-md bg-white p-6 shadow"
            >
              <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 border-b border-gray-300 pb-3 text-sm text-black">
                <span>氏名：{student.name}</span>
                <span>学籍番号：{student.studentNumber}</span>
                <span>専攻：{student.majorName}</span>
                <span>学年：{student.gradeLevel}年生</span>
              </div>

              {levels.length === 0 ? (
                <p className="text-sm text-gray-500">対象データがありません</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {levels.map((level) => (
                    <div key={level}>
                      <h3 className="mb-2 border-b border-gray-400 pb-1 text-sm font-bold text-black">
                        {level}年次
                      </h3>
                      <div className="space-y-2">
                        {gradeYears[level].map((entry, i) => {
                          const highlight =
                            entry.isIncomplete || entry.finalRank === "fail";
                          return (
                            <div
                              key={i}
                              className={`rounded border text-xs ${
                                highlight
                                  ? "border-red-300 bg-red-50"
                                  : "border-gray-300"
                              }`}
                            >
                              <div className="flex justify-between border-b border-gray-300 px-2 py-1 font-medium text-black">
                                <span>{entry.subjectName}</span>
                                <span>{TERM_LABEL[entry.term] ?? entry.term}</span>
                              </div>
                              <div className="flex justify-between px-2 py-1 text-black">
                                <span>出席率 {entry.attendanceRate ?? "-"}%</span>
                                <span>態度 {entry.attitudeClass ?? "-"}</span>
                                <span>
                                  {entry.finalRank
                                    ? FINAL_RANK_LABEL[entry.finalRank]
                                    : "-"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
