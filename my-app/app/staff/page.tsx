"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/src/components/AppHeader";
import GradeEditModal, {
  type OverviewStudent,
  type OverviewSubject,
} from "@/src/components/GradeEditModal";
import YearCloseConfirmModal from "@/src/components/YearCloseConfirmModal";
import { getJson, postJson } from "@/src/lib/api-client";
import { FINAL_RANK_LABEL } from "@/src/lib/grade-labels";

const GRADE_LEVEL_OPTIONS = [1, 2, 3, 4];

type Me = {
  id: number;
  role: "teacher" | "full_time_teacher";
  mustChangePassword: boolean;
  name: string;
};

type OverviewResponse = {
  year: number;
  term: number;
  subjects: OverviewSubject[];
  students: OverviewStudent[];
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export default function StaffHome() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  const [year, setYear] = useState(CURRENT_YEAR);
  const [term, setTerm] = useState(1);
  const [gradeLevel, setGradeLevel] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [onlyFail, setOnlyFail] = useState(false);

  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editTarget, setEditTarget] = useState<OverviewStudent[] | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    (async () => {
      const result = await getJson<Me>("/auth/me");
      if (!result.ok) {
        router.replace("/");
        return;
      }
      if (result.data.role !== "full_time_teacher") {
        router.replace("/teacher");
        return;
      }
      setMe(result.data);
    })();
  }, [router]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      year: String(year),
      term: String(term),
    });
    if (gradeLevel !== "") params.set("gradeLevel", String(gradeLevel));
    if (search) params.set("search", search);
    if (onlyIncomplete) params.set("incomplete", "true");
    if (onlyFail) params.set("fail", "true");

    const result = await getJson<OverviewResponse>(
      `/reports/overview?${params.toString()}`,
    );
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setData(result.data);
    setSelectedIds(new Set());
  }, [year, term, gradeLevel, search, onlyIncomplete, onlyFail]);

  useEffect(() => {
    if (!me) return;
    loadOverview();
  }, [me, loadOverview]);

  async function handleLogout() {
    await postJson("/auth/logout", {});
    router.replace("/");
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirmCloseYear() {
    setClosing(true);
    setConfirmMessage(null);
    const result = await postJson<{ message: string; incompleteCount?: number }>(
      "/years/close",
      { year },
    );
    setClosing(false);
    setShowCloseConfirm(false);
    if (result.ok) {
      setConfirmMessage(result.data.message);
      loadOverview();
    } else {
      setConfirmMessage(result.message);
    }
  }

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
        title={`${me.name} 専任職員`}
        left={
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-sm bg-white/10 px-4 py-1.5 text-sm hover:bg-white/20"
          >
            ログアウト
          </button>
        }
        right={
          <>
            <button
              type="button"
              onClick={() => router.push("/staff/csv")}
              className="rounded-sm bg-white/10 px-4 py-1.5 text-sm hover:bg-white/20"
            >
              CSV
            </button>
            <button
              type="button"
              onClick={() => setShowCloseConfirm(true)}
              className="rounded-sm bg-white/10 px-4 py-1.5 text-sm hover:bg-white/20"
            >
              成績確定
            </button>
          </>
        }
      />

      <main className="flex-1 p-6">
        {confirmMessage && (
          <div className="mb-4 rounded border border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-800">
            {confirmMessage}
          </div>
        )}

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
                term === 1
                  ? "bg-[#2E4374] text-white"
                  : "bg-white text-gray-700"
              }`}
            >
              前期
            </button>
            <button
              type="button"
              onClick={() => setTerm(2)}
              className={`px-4 py-1.5 text-sm ${
                term === 2
                  ? "bg-[#2E4374] text-white"
                  : "bg-white text-gray-700"
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
            onClick={() => setOnlyIncomplete((v) => !v)}
            className={`rounded-sm border px-3 py-1.5 text-sm ${
              onlyIncomplete
                ? "border-yellow-500 bg-yellow-100 text-yellow-900"
                : "border-gray-300 bg-white text-gray-600"
            }`}
          >
            未入力
          </button>
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

          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={() =>
              setEditTarget(students.filter((s) => selectedIds.has(s.id)))
            }
            className="rounded-sm bg-[#4C6B9A] px-4 py-1.5 text-sm text-white hover:bg-[#3f5a85] disabled:opacity-40"
          >
            選択した生徒の成績変更({selectedIds.size})
          </button>

          <button
            type="button"
            onClick={() => router.push(`/staff/pdf/students?year=${year}`)}
            className="rounded-sm bg-[#4C6B9A] px-4 py-1.5 text-sm text-white hover:bg-[#3f5a85]"
          >
            PDF出力
          </button>
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
                <th className="w-16 px-3 py-2" />
                <th className="px-3 py-2 font-semibold text-gray-700">名前</th>
                <th className="px-3 py-2 font-semibold text-gray-700">
                  学籍番号
                </th>
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
                    colSpan={3 + subjects.length}
                    className="px-3 py-6 text-center text-gray-500"
                  >
                    読み込み中...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td
                    colSpan={3 + subjects.length}
                    className="px-3 py-6 text-center text-gray-500"
                  >
                    対象データがありません
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => toggleSelect(s.id)}
                    className={`cursor-pointer border-b border-gray-100 ${
                      selectedIds.has(s.id)
                        ? "bg-blue-50 hover:bg-blue-100"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditTarget([s]);
                        }}
                        className="rounded-sm bg-[#4C6B9A] px-3 py-1 text-xs text-white hover:bg-[#3f5a85]"
                      >
                        変更
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/staff/pdf/student/${s.id}`);
                        }}
                        className="text-[#2E4374] underline hover:text-[#1c2c4c]"
                      >
                        {s.name}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {s.studentNumber}
                    </td>
                    {subjects.map((subj) => {
                      const notEnrolled = !(subj.id in s.grades);
                      const cell = s.grades[subj.id];
                      const isFail = cell?.finalRank === "fail";
                      const isIncomplete = !notEnrolled && (!cell || cell.isIncomplete);
                      return (
                        <td
                          key={subj.id}
                          className={`whitespace-nowrap px-3 py-2 ${
                            notEnrolled
                              ? "text-gray-400"
                              : isFail
                                ? "bg-red-100 text-red-800"
                                : isIncomplete
                                  ? "bg-yellow-50 text-yellow-800"
                                  : ""
                          }`}
                        >
                          {notEnrolled
                            ? "未履修"
                            : cell?.finalRank
                              ? FINAL_RANK_LABEL[cell.finalRank]
                              : !cell || cell.isIncomplete
                                ? "未入力"
                                : "計算待ち"}
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

      {editTarget && (
        <GradeEditModal
          students={editTarget}
          subjects={subjects}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            loadOverview();
          }}
        />
      )}

      {showCloseConfirm && (
        <YearCloseConfirmModal
          gradeLevelLabel={gradeLevel === "" ? "全学年" : `${gradeLevel}年生`}
          termLabel={term === 1 ? "前期" : "後期"}
          onCancel={() => setShowCloseConfirm(false)}
          onConfirm={handleConfirmCloseYear}
          confirming={closing}
        />
      )}
    </div>
  );
}
