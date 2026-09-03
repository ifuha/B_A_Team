"use client";
import { useEffect, useRef, useState } from "react";

export type OverviewCell = {
  gradeId: number;
  attendanceRate: number | null;
  attitudeClass: number | null;
  homeworkEvaluation: number | null;
  finalRank: string | null;
  isIncomplete: boolean;
} | null;

export type OverviewStudent = {
  id: number;
  name: string;
  studentNumber: string;
  majorId: number;
  gradeLevel: number;
  grades: Record<number, OverviewCell>;
};

export type OverviewSubject = { id: number; name: string };

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

export default function GradeEditModal({
  students,
  subjects,
  onClose,
  onSaved,
}: {
  students: OverviewStudent[];
  subjects: OverviewSubject[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const buildInitialValues = () => {
    const initial: Record<string, EditValue> = {};
    for (const s of students) {
      for (const subj of subjects) {
        const cell = s.grades[subj.id];
        if (!cell) continue;
        initial[`${s.id}:${subj.id}`] = {
          attendanceRate: cell.attendanceRate?.toString() ?? "",
          attitudeClass: cell.attitudeClass?.toString() ?? "",
          homeworkEvaluation: cell.homeworkEvaluation?.toString() ?? "",
        };
      }
    }
    return initial;
  };

  const initialValuesRef = useRef(buildInitialValues());
  const [values, setValues] = useState<Record<string, EditValue>>(
    () => initialValuesRef.current,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  const isDirty =
    JSON.stringify(values) !== JSON.stringify(initialValuesRef.current);

  // 未保存の変更がある状態でタブを閉じる/リロードしようとした場合の警告(4.8)
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty) return;
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function handleCancel() {
    if (isDirty) {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  }

  function updateValue(key: string, field: keyof EditValue, value: string) {
    setValues((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    for (const s of students) {
      for (const subj of subjects) {
        const cell = s.grades[subj.id];
        if (!cell) continue;
        const key = `${s.id}:${subj.id}`;
        const v = values[key];

        const result = await patchJson(`/grades/${cell.gradeId}`, {
          attendanceRate: v.attendanceRate === "" ? null : Number(v.attendanceRate),
          attitudeClass: v.attitudeClass === "" ? null : Number(v.attitudeClass),
          homeworkEvaluation:
            v.homeworkEvaluation === "" ? null : Number(v.homeworkEvaluation),
        });

        if (!result.ok) {
          setError(
            `${s.name} / ${subj.name}: ${result.message ?? "更新に失敗しました"}`,
          );
          setSaving(false);
          return;
        }
      }
    }

    setSaving(false);
    onSaved();
  }

  const editableRows = students.flatMap((s) =>
    subjects
      .filter((subj) => s.grades[subj.id])
      .map((subj) => ({ student: s, subject: subj })),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-md bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-bold text-gray-900">成績変更</h2>

        {editableRows.length === 0 ? (
          <p className="text-sm text-gray-600">
            編集可能な成績がありません(未入力の科目は講師による初回入力が必要です)
          </p>
        ) : (
          <div className="space-y-4">
            {editableRows.map(({ student, subject }) => {
              const key = `${student.id}:${subject.id}`;
              const v = values[key];
              return (
                <div key={key} className="rounded border border-gray-200 p-3">
                  <p className="mb-2 text-sm font-medium text-gray-800">
                    {student.name}({student.studentNumber}) / {subject.name}
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      出席率
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={v.attendanceRate}
                        onChange={(e) =>
                          updateValue(key, "attendanceRate", e.target.value)
                        }
                        className="h-8 w-20 rounded-sm border border-gray-400 bg-gray-100 px-2 text-sm"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      授業態度
                      <select
                        value={v.attitudeClass}
                        onChange={(e) =>
                          updateValue(key, "attitudeClass", e.target.value)
                        }
                        className="h-8 rounded-sm border border-gray-400 bg-gray-100 px-2 text-sm"
                      >
                        <option value="">-</option>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      課題評価
                      <select
                        value={v.homeworkEvaluation}
                        onChange={(e) =>
                          updateValue(key, "homeworkEvaluation", e.target.value)
                        }
                        className="h-8 rounded-sm border border-gray-400 bg-gray-100 px-2 text-sm"
                      >
                        <option value="">-</option>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-sm border border-gray-400 px-5 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            キャンセル
          </button>
          {editableRows.length > 0 && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-sm bg-[#4C6B9A] px-5 py-2 text-sm font-medium text-white hover:bg-[#3f5a85] disabled:opacity-60"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          )}
        </div>
      </div>

      {showUnsavedWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-md bg-white shadow-lg">
            <div className="flex items-center gap-2 border-2 border-[#2E4374] bg-[#FDF6DC] px-4 py-3 text-[#8A6D1D]">
              <span aria-hidden>⚠</span>
              <span className="font-semibold">変更が保存していません</span>
            </div>
            <div className="flex flex-col items-center gap-6 p-8">
              <p className="text-center text-sm text-black">
                このまま移動してしまうと、
                <br />
                編集した内容が元に戻ります
              </p>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowUnsavedWarning(false)}
                  className="rounded-sm border border-gray-400 px-5 py-2 text-sm text-black hover:bg-gray-100"
                >
                  変更を続ける
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowUnsavedWarning(false);
                    await handleSave();
                  }}
                  disabled={saving}
                  className="rounded-sm bg-[#4C6B9A] px-5 py-2 text-sm font-medium text-white hover:bg-[#3f5a85] disabled:opacity-60"
                >
                  保存してホームに移動
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
