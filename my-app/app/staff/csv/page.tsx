"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/src/components/AppHeader";
import { getJson, postJson } from "@/src/lib/api-client";

type Me = {
  id: number;
  role: "teacher" | "full_time_teacher";
  mustChangePassword: boolean;
  name: string;
};

type CsvRowError = { row: number; field: string; message: string };

type EntityConfig = {
  key: string;
  label: string;
  importPath: string;
  exportPath?: string;
};

const ENTITIES: EntityConfig[] = [
  {
    key: "majors",
    label: "専攻",
    importPath: "/masters/majors/import",
    exportPath: "/csv/export/majors",
  },
  {
    key: "subjects",
    label: "科目",
    importPath: "/masters/subjects/import",
    exportPath: "/csv/export/subjects",
  },
  {
    key: "students",
    label: "生徒",
    importPath: "/masters/students/import",
    exportPath: "/csv/export/students",
  },
  {
    key: "teachers",
    label: "講師",
    importPath: "/masters/teachers/import",
    exportPath: "/csv/export/teachers",
  },
  {
    key: "full-time-teachers",
    label: "専任職員",
    importPath: "/masters/full-time-teachers/import",
    exportPath: "/csv/export/full-time-teachers",
  },
  {
    key: "teacher-subject",
    label: "講師・科目紐づけ",
    importPath: "/relations/teacher-subject/import",
  },
  {
    key: "student-subject",
    label: "学生・科目紐づけ",
    importPath: "/relations/student-subject/import",
  },
];

function EntityRow({ entity }: { entity: EntityConfig }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<CsvRowError[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleImport(file: File) {
    setSubmitting(true);
    setMessage(null);
    setErrors([]);

    const csv = await file.text();
    const result = await postJson<{ message: string; count?: number }>(
      entity.importPath,
      { csv },
    );

    setSubmitting(false);
    if (!result.ok) {
      setMessage(result.message);
      const body = result.data as { errors?: CsvRowError[] } | null;
      if (Array.isArray(body?.errors)) setErrors(body.errors);
      return;
    }
    setMessage(
      result.data.count !== undefined
        ? `${result.data.message}(${result.data.count}件)`
        : result.data.message,
    );
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-gray-800">
          {entity.label}
        </h2>
        <div className="flex items-center gap-3">
          {entity.exportPath && (
            <a
              href={`/api${entity.exportPath}`}
              className="rounded-sm border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              エクスポート
            </a>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={submitting}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-sm bg-[#4C6B9A] px-3 py-1.5 text-sm text-white hover:bg-[#3f5a85] disabled:opacity-60"
          >
            {submitting ? "取り込み中..." : "インポート"}
          </button>
        </div>
      </div>

      {message && (
        <p className="mt-3 text-sm text-gray-700" role="status">
          {message}
        </p>
      )}

      {errors.length > 0 && (
        <table className="mt-2 w-full text-xs text-red-700">
          <thead>
            <tr className="text-left">
              <th className="pr-4">行</th>
              <th className="pr-4">項目</th>
              <th>内容</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((err, i) => (
              <tr key={i}>
                <td className="pr-4">{err.row}</td>
                <td className="pr-4">{err.field}</td>
                <td>{err.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function StaffCsv() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

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
        title="CSV入出力"
        left={
          <button
            type="button"
            onClick={() => router.push("/staff")}
            className="rounded-sm bg-white/10 px-4 py-1.5 text-sm hover:bg-white/20"
          >
            戻る
          </button>
        }
      />

      <main className="flex-1 space-y-4 p-6">
        {ENTITIES.map((entity) => (
          <EntityRow key={entity.key} entity={entity} />
        ))}
      </main>
    </div>
  );
}
