"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/src/components/AppHeader";
import { getJson } from "@/src/lib/api-client";
import { FINAL_RANK_LABEL } from "@/src/lib/grade-labels";

type Me = {
  id: number;
  role: "teacher" | "full_time_teacher";
  mustChangePassword: boolean;
  name: string;
};

type Cell = {
  gradeId: number;
  finalRank: string | null;
  isIncomplete: boolean;
} | null;

type HistoryStudent = {
  id: number;
  name: string;
  studentNumber: string;
  gradeLevel: number;
  grades: Record<number, Cell>;
};

type HistoryResponse = {
  subjects: { id: number; name: string }[];
  students: HistoryStudent[];
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
const GRADE_LEVEL_OPTIONS = [1, 2, 3, 4];

export default function TeacherHistory() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  const [year, setYear] = useState(CURRENT_YEAR);
  const [term, setTerm] = useState(1);
  const [gradeLevel, setGradeLevel] = useState<number | "">("");
  const [onlyFail, setOnlyFail] = useState(false);
  const [search, setSearch] = useState("");

  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const result = await getJson<Me>("/auth/me");
      if (!result.ok) {
        router.replace("/");
        return;
      }
      if (result.data.role !== "teacher") {
        router.replace("/staff");
        return;
      }
      setMe(result.data);
    })();
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ year: String(year), term: String(term) });
    if (gradeLevel !== "") params.set("gradeLevel", String(gradeLevel));
    if (onlyFail) params.set("fail", "true");
    if (search) params.set("search", search);

    const result = await getJson<HistoryResponse>(
      `/grades/my-history?${params.toString()}`,
    );
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setData(result.data);
  }, [year, term, gradeLevel, onlyFail, search]);

  useEffect(() => {
    if (!me) return;
    load();
  }, [me, load]);

  if (!me) {
    return (
      <div className="flex min-h-screen flex-col bg-[#EFF2F7]">
        <AppHeader />
      </div>
    );
  }

  const subjects = data?.subjects ?? [];
  const students = data?.students ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-[#EFF2F7]">
      <AppHeader
        title="過去の成績一覧"
        left={
          <button
            type="button"
            onClick={() => router.push("/teacher")}
            className="rounded-sm bg-white/10 px-4 py-1.5 text-sm hover:bg-white/20"
          >
            戻る
          </button>
        }
      />

      <main className="flex-1 p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md bg-white p-4 shadow-sm">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-9 rounded-sm border border-gray-300 px-2 text-sm"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}年度
              </option>
            ))}
          </select>

          <div className="flex overflow-hidden rounded-sm border border-gray-300">
            <button
              type="button"
              onClick={() => setTerm(1)}
              className={`px-4 py-1.5 text-sm ${
                term === 1 ? "bg-[#2E4374] text-white" : "bg-white text-gray-700"
              }`}
            >
              前期
            </button>
            <button
              type="button"
              onClick={() => setTerm(2)}
              className={`px-4 py-1.5 text-sm ${
                term === 2 ? "bg-[#2E4374] text-white" : "bg-white text-gray-700"
              }`}
            >
              後期
            </button>
          </div>

          <select
            value={gradeLevel}
            onChange={(e) =>
              setGradeLevel(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="h-9 rounded-sm border border-gray-300 px-2 text-sm"
          >
            <option value="">全学年</option>
            {GRADE_LEVEL_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}年生
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setOnlyFail((v) => !v)}
            className={`rounded-sm border px-3 py-1.5 text-sm ${
              onlyFail
                ? "border-red-400 bg-red-100 text-red-800"
                : "border-gray-300 bg-white text-gray-600"
            }`}
          >
            不可
          </button>

          <input
            type="text"
            placeholder="検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 flex-1 min-w-[10rem] rounded-sm border border-gray-300 px-3 text-sm"
          />
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="overflow-x-auto rounded-md bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-3 py-2 font-semibold text-gray-700">名前</th>
                <th className="px-3 py-2 font-semibold text-gray-700">学籍番号</th>
                {subjects.map((subj) => (
                  <th
                    key={subj.id}
                    className="whitespace-nowrap px-3 py-2 font-semibold text-gray-700"
                  >
                    {subj.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={2 + subjects.length}
                    className="px-3 py-6 text-center text-gray-500"
                  >
                    読み込み中...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td
                    colSpan={2 + subjects.length}
                    className="px-3 py-6 text-center text-gray-500"
                  >
                    対象データがありません
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100">
                    <td className="whitespace-nowrap px-3 py-2">{s.name}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {s.studentNumber}
                    </td>
                    {subjects.map((subj) => {
                      const cell = s.grades[subj.id];
                      const isFail = cell?.finalRank === "fail";
                      return (
                        <td
                          key={subj.id}
                          className={`whitespace-nowrap px-3 py-2 ${
                            isFail ? "bg-red-100 text-red-800" : ""
                          }`}
                        >
                          {cell?.finalRank
                            ? FINAL_RANK_LABEL[cell.finalRank]
                            : "未確定"}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
