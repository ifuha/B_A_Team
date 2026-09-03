"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/src/components/AppHeader";
import { getJson, postJson } from "@/src/lib/api-client";
import { FINAL_RANK_LABEL } from "@/src/lib/grade-labels";

type Me = {
  id: number;
  role: "teacher" | "full_time_teacher";
  mustChangePassword: boolean;
  name: string;
};

type TeacherSubjectRow = { id: number; teacherId: number; subjectId: number; year: number };
type SubjectRow = { id: number; name: string; year: number };

type EntrySheetStudent = {
  id: number;
  name: string;
  studentNumber: string;
  majorName: string;
  gradeLevel: number;
  gradeId: number | null;
  attendanceRate: number | null;
  attitudeClass: number | null;
  homeworkEvaluation: number | null;
  finalRank: string | null;
  isIncomplete: boolean;
};

type WeightRow = {
  id: number;
  subjectId: number;
  year: number;
  term: number;
  attendanceRateWeight: number;
  attitudeClassWeight: number;
  homeworkEvaluationWeight: number;
};

type EntrySheetResponse = {
  subjectName: string;
  weight: WeightRow | null;
  students: EntrySheetStudent[];
};

type EditValue = {
  attendanceRate: string;
  attitudeClass: string;
  homeworkEvaluation: string;
};

async function patchJson(path: string, body: unknown) {
  const res = await fetch(`/api${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, message: data?.message as string | undefined };
}

const CURRENT_YEAR = new Date().getFullYear();

export default function TeacherHome() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  const [year] = useState(CURRENT_YEAR);
  const [term, setTerm] = useState(1);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    null,
  );

  const [sheet, setSheet] = useState<EntrySheetResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [homeworkWeight, setHomeworkWeight] = useState("");
  const [attitudeWeight, setAttitudeWeight] = useState("");
  const [attendanceWeight, setAttendanceWeight] = useState("");
  const [values, setValues] = useState<Record<number, EditValue>>({});

  const [search, setSearch] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [onlyFail, setOnlyFail] = useState(false);

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

  useEffect(() => {
    if (!me) return;
    (async () => {
      const [relResult, subjResult] = await Promise.all([
        getJson<TeacherSubjectRow[]>(`/relations/teacher-subject?year=${year}`),
        getJson<SubjectRow[]>(`/masters/subjects?year=${year}`),
      ]);
      if (!relResult.ok || !subjResult.ok) return;

      const mySubjectIds = new Set(
        relResult.data.filter((r) => r.teacherId === me.id).map((r) => r.subjectId),
      );
      const mySubjects = subjResult.data.filter((s) => mySubjectIds.has(s.id));
      setSubjects(mySubjects);
      if (mySubjects.length > 0) setSelectedSubjectId(mySubjects[0].id);
    })();
  }, [me, year]);

  const loadSheet = useCallback(async () => {
    if (!selectedSubjectId) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      subjectId: String(selectedSubjectId),
      year: String(year),
      term: String(term),
    });
    if (search) params.set("search", search);
    if (onlyIncomplete) params.set("incomplete", "true");
    if (onlyFail) params.set("fail", "true");

    const result = await getJson<EntrySheetResponse>(
      `/grades/entry-sheet?${params.toString()}`,
    );
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      setSheet(null);
      return;
    }
    setSheet(result.data);
    setHomeworkWeight(result.data.weight?.homeworkEvaluationWeight.toString() ?? "");
    setAttitudeWeight(result.data.weight?.attitudeClassWeight.toString() ?? "");
    setAttendanceWeight(result.data.weight?.attendanceRateWeight.toString() ?? "");

    const initialValues: Record<number, EditValue> = {};
    for (const s of result.data.students) {
      initialValues[s.id] = {
        attendanceRate: s.attendanceRate?.toString() ?? "",
        attitudeClass: s.attitudeClass?.toString() ?? "",
        homeworkEvaluation: s.homeworkEvaluation?.toString() ?? "",
      };
    }
    setValues(initialValues);
  }, [selectedSubjectId, year, term, search, onlyIncomplete, onlyFail]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  async function handleLogout() {
    await postJson("/auth/logout", {});
    router.replace("/");
  }

  function updateValue(studentId: number, field: keyof EditValue, value: string) {
    setValues((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  }

  async function handleSave() {
    if (!sheet || !selectedSubjectId) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    const total =
      Number(homeworkWeight || 0) +
      Number(attitudeWeight || 0) +
      Number(attendanceWeight || 0);
    if (homeworkWeight || attitudeWeight || attendanceWeight) {
      if (total !== 10) {
        setSaving(false);
        setError("重みの合計は10である必要があります");
        return;
      }
      const weightBody = {
        subjectId: selectedSubjectId,
        year,
        term,
        homeworkEvaluationWeight: Number(homeworkWeight),
        attitudeClassWeight: Number(attitudeWeight),
        attendanceRateWeight: Number(attendanceWeight),
      };
      const weightResult = sheet.weight
        ? await patchJson(`/weights/${sheet.weight.id}`, weightBody)
        : await postJson("/weights", weightBody);
      if (!weightResult.ok) {
        setSaving(false);
        setError(weightResult.message ?? "重みの保存に失敗しました");
        return;
      }
    }

    for (const s of sheet.students) {
      const v = values[s.id];
      const body = {
        studentId: s.id,
        subjectId: selectedSubjectId,
        year,
        term,
        attendanceRate: v.attendanceRate === "" ? undefined : Number(v.attendanceRate),
        attitudeClass: v.attitudeClass === "" ? undefined : Number(v.attitudeClass),
        homeworkEvaluation:
          v.homeworkEvaluation === "" ? undefined : Number(v.homeworkEvaluation),
      };

      const unchanged =
        (s.attendanceRate?.toString() ?? "") === v.attendanceRate &&
        (s.attitudeClass?.toString() ?? "") === v.attitudeClass &&
        (s.homeworkEvaluation?.toString() ?? "") === v.homeworkEvaluation;
      if (unchanged) continue;

      const result = s.gradeId
        ? await patchJson(`/grades/${s.gradeId}`, {
            attendanceRate: body.attendanceRate ?? null,
            attitudeClass: body.attitudeClass ?? null,
            homeworkEvaluation: body.homeworkEvaluation ?? null,
          })
        : await postJson(`/grades`, body);

      if (!result.ok) {
        setSaving(false);
        setError(`${s.name}: ${result.message ?? "保存に失敗しました"}`);
        return;
      }
    }

    setSaving(false);
    setMessage("変更を保存しました");
    loadSheet();
  }

  if (!me) {
    return (
      <div className="flex min-h-screen flex-col bg-[#EFF2F7]">
        <AppHeader />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#EFF2F7]">
      <AppHeader
        title="SANSUN学園 成績管理"
        left={
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-sm bg-white/10 px-4 py-1.5 text-sm hover:bg-white/20"
          >
            ログアウト
          </button>
        }
      />

      <div className="flex flex-1">
        <aside className="w-56 shrink-0 bg-[#2E4374] p-4 text-white">
          <p className="mb-6 text-center text-sm font-semibold">{me.name}講師</p>

          <h2 className="mb-2 text-sm font-semibold">担当科目</h2>
          <div className="mb-6 space-y-2">
            {subjects.map((subj) => (
              <button
                key={subj.id}
                type="button"
                onClick={() => setSelectedSubjectId(subj.id)}
                className={`block w-full rounded-sm px-3 py-2 text-left text-sm ${
                  selectedSubjectId === subj.id
                    ? "bg-white text-[#2E4374]"
                    : "bg-white/10 hover:bg-white/20"
                }`}
              >
                {subj.name}
              </button>
            ))}
            {subjects.length === 0 && (
              <p className="text-xs text-white/70">担当科目がありません</p>
            )}
          </div>

          <h2 className="mb-2 text-sm font-semibold">過去の成績</h2>
          <button
            type="button"
            onClick={() => router.push("/teacher/history")}
            className="block w-full rounded-sm bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
          >
            一覧を見る
          </button>
        </aside>

        <main className="flex-1 p-6">
          <div className="mb-4 rounded-md bg-[#2E4374] p-6 text-white">
            <h2 className="mb-4 text-center text-lg font-semibold">重みの設定</h2>
            <div className="flex justify-center gap-8">
              <label className="flex items-center gap-2 text-sm">
                課題
                <input
                  type="number"
                  value={homeworkWeight}
                  onChange={(e) => setHomeworkWeight(e.target.value)}
                  className="h-8 w-16 rounded-sm border border-gray-400 bg-white px-2 text-sm text-gray-900"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                授業態度
                <input
                  type="number"
                  value={attitudeWeight}
                  onChange={(e) => setAttitudeWeight(e.target.value)}
                  className="h-8 w-16 rounded-sm border border-gray-400 bg-white px-2 text-sm text-gray-900"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                出席率
                <input
                  type="number"
                  value={attendanceWeight}
                  onChange={(e) => setAttendanceWeight(e.target.value)}
                  className="h-8 w-16 rounded-sm border border-gray-400 bg-white px-2 text-sm text-gray-900"
                />
              </label>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md bg-white p-4 shadow-sm">
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
              onClick={handleSave}
              disabled={saving || !sheet}
              className="rounded-sm bg-[#4C6B9A] px-4 py-1.5 text-sm text-white hover:bg-[#3f5a85] disabled:opacity-40"
            >
              {saving ? "保存中..." : "変更を保存"}
            </button>
          </div>

          {message && (
            <p className="mb-4 rounded border border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-800">
              {message}
            </p>
          )}
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
                  <th className="px-3 py-2 font-semibold text-gray-700">専攻</th>
                  <th className="px-3 py-2 font-semibold text-gray-700">学年</th>
                  <th className="px-3 py-2 font-semibold text-gray-700">課題(1-10)</th>
                  <th className="px-3 py-2 font-semibold text-gray-700">授業態度(1-10)</th>
                  <th className="px-3 py-2 font-semibold text-gray-700">出席率(%)</th>
                  <th className="px-3 py-2 font-semibold text-gray-700">成績</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                      読み込み中...
                    </td>
                  </tr>
                ) : !sheet || sheet.students.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                      対象データがありません
                    </td>
                  </tr>
                ) : (
                  sheet.students.map((s) => {
                    const v = values[s.id] ?? {
                      attendanceRate: "",
                      attitudeClass: "",
                      homeworkEvaluation: "",
                    };
                    return (
                      <tr key={s.id} className="border-b border-gray-100">
                        <td className="whitespace-nowrap px-3 py-2">{s.name}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {s.studentNumber}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {s.majorName}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {s.gradeLevel}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={v.homeworkEvaluation}
                            onChange={(e) =>
                              updateValue(s.id, "homeworkEvaluation", e.target.value)
                            }
                            className="h-8 rounded-sm border border-gray-300 bg-white px-2 text-sm"
                          >
                            <option value="">未入力</option>
                            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={v.attitudeClass}
                            onChange={(e) =>
                              updateValue(s.id, "attitudeClass", e.target.value)
                            }
                            className="h-8 rounded-sm border border-gray-300 bg-white px-2 text-sm"
                          >
                            <option value="">未入力</option>
                            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={1}
                            max={100}
                            placeholder="未入力"
                            value={v.attendanceRate}
                            onChange={(e) =>
                              updateValue(s.id, "attendanceRate", e.target.value)
                            }
                            className="h-8 w-20 rounded-sm border border-gray-300 bg-white px-2 text-sm"
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {s.finalRank ? FINAL_RANK_LABEL[s.finalRank] : "未確定"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
