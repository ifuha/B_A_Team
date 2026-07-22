// src/routes/csv.ts
import { Hono } from "hono";
import { db } from "@/src/db";
import {
  subject,
  student,
  teacher,
  fullTimeTeacher,
  major,
} from "@/src/db/schema";
import { toCsv } from "@/src/lib/csv";
import { requireAuth, type AuthEnv } from "@/src/middleware/auth";
import { CsvRowError } from "@/src/lib/csv";

const csvRoutes = new Hono<AuthEnv>();

const exportTable = {
  subjects: subject,
  students: student,
  teachers: teacher,
  "full-time-teachers": fullTimeTeacher,
  majors: major,
} as const;

type ExportType = keyof typeof exportTable;

// src/lib/csv.ts に追記
export type FieldTypeRule =
  | "integer"
  | "number"
  | "email"
  | "halfWidthAlphaNumeric";

const TYPE_PATTERNS: Record<FieldTypeRule, RegExp> = {
  integer: /^-?\d+$/,
  number: /^-?\d+(\.\d+)?$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  halfWidthAlphaNumeric: /^[A-Za-z0-9]+$/,
};

// 全角文字が紛れていないかの簡易チェック(半角チェックの補助)
function containsFullWidth(value: string): boolean {
  return /[^\x01-\x7E\uFF61-\uFF9F]/.test(value);
}

export function validateFieldTypes(
  rows: Record<string, string>[],
  rules: Record<string, FieldTypeRule>,
): CsvRowError[] {
  const errors: CsvRowError[] = [];

  rows.forEach((row, i) => {
    for (const [field, rule] of Object.entries(rules)) {
      const value = row[field];
      if (value === undefined || value === "") continue; // 空欄は必須チェック側の責務

      if (!TYPE_PATTERNS[rule].test(value)) {
        errors.push({
          row: i + 1,
          field,
          message:
            rule === "integer" || rule === "number"
              ? "数値形式で入力してください（全角不可）"
              : rule === "email"
                ? "メールアドレスの形式が正しくありません"
                : "半角英数字で入力してください",
        });
      } else if (
        (rule === "integer" ||
          rule === "number" ||
          rule === "halfWidthAlphaNumeric") &&
        containsFullWidth(value)
      ) {
        errors.push({ row: i + 1, field, message: "全角文字は使用できません" });
      }
    }
  });

  return errors;
}

csvRoutes.get(
  "/export/:type",
  requireAuth({ allowedRoles: ["full_time_teacher"] }),
  async (c) => {
    const type = c.req.param("type") as ExportType;
    const table = exportTable[type];
    if (!table) return c.json({ message: "不明なtypeです" }, 400);

    const rows = await db.select().from(table);
    const csv = toCsv(rows);

    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="${type}.csv"`);
    return c.body(csv);
  },
);

export default csvRoutes;
