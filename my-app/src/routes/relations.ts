// src/routes/relations.ts
import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db";
import { teacherSubject, studentSubject, teacher, student, subject } from "@/src/db/schema";
import {
  parseCsv,
  validateRequiredFields,
  resolveNamesToIds,
  type CsvRowError,
} from "@/src/lib/csv";
import { requireAuth, type AuthEnv } from "@/src/middleware/auth";
import { validateFieldTypes } from "./csv";

const relations = new Hono<AuthEnv>();

// 科目名+年度から subjectId を解決する(科目名だけでは年度をまたいで一意にならないため)
async function resolveSubjectIdsByNameYear(
  rows: Record<string, string>[],
): Promise<{ idsByKey: Map<string, number[]>; errors: CsvRowError[] }> {
  const names = [...new Set(rows.map((r) => r["科目名"]).filter(Boolean))];
  const subjectRows = names.length
    ? await db
        .select({ id: subject.id, name: subject.name, year: subject.year })
        .from(subject)
        .where(inArray(subject.name, names))
    : [];

  const idsByKey = new Map<string, number[]>();
  for (const s of subjectRows) {
    const key = `${s.name}:${s.year}`;
    if (!idsByKey.has(key)) idsByKey.set(key, []);
    idsByKey.get(key)!.push(s.id);
  }

  const errors: CsvRowError[] = [];
  rows.forEach((r, i) => {
    if (!r["科目名"] || !r.year) return; // 空欄は必須チェック側の責務
    const key = `${r["科目名"]}:${r.year}`;
    const matches = idsByKey.get(key) ?? [];
    if (matches.length === 0) {
      errors.push({
        row: i + 1,
        field: "科目名",
        message: "該当する科目(年度)が見つかりません",
      });
    } else if (matches.length > 1) {
      errors.push({
        row: i + 1,
        field: "科目名",
        message: "同名の科目が複数存在するため特定できません",
      });
    }
  });

  return { idsByKey, errors };
}

/* ---------- 講師・科目 ---------- */
relations.get("/teacher-subject", requireAuth(), async (c) => {
  const year = c.req.query("year");
  const rows = year
    ? await db
        .select()
        .from(teacherSubject)
        .where(eq(teacherSubject.year, Number(year)))
    : await db.select().from(teacherSubject);
  return c.json(rows);
});

relations.post(
  "/teacher-subject/import",
  requireAuth({ allowedRoles: ["full_time_teacher"] }),
  async (c) => {
    const { csv } = await c.req.json<{ csv?: string }>();
    if (!csv) return c.json({ message: "csvは必須です" }, 400);

    const rows = parseCsv(csv);
    const errors = validateRequiredFields(rows, ["講師名", "科目名", "year"]);
    const typeErrors = validateFieldTypes(rows, { year: "integer" });
    if (errors.length > 0 || typeErrors.length > 0)
      return c.json(
        { message: "取り込み失敗", errors: [...errors, ...typeErrors] },
        422,
      );

    const { idsByName: teacherIdsByName, errors: teacherErrors } =
      await resolveNamesToIds(rows, "講師名", (names) =>
        db
          .select({ id: teacher.id, name: teacher.name })
          .from(teacher)
          .where(inArray(teacher.name, names)),
      );
    const { idsByKey: subjectIdsByKey, errors: subjectErrors } =
      await resolveSubjectIdsByNameYear(rows);

    const resolveErrors = [...teacherErrors, ...subjectErrors];
    if (resolveErrors.length > 0)
      return c.json({ message: "取り込み失敗", errors: resolveErrors }, 422);

    const values = rows.map((r) => ({
      teacherId: teacherIdsByName.get(r["講師名"])![0],
      subjectId: subjectIdsByKey.get(`${r["科目名"]}:${r.year}`)![0],
      year: Number(r.year),
    }));

    try {
      // 1科目1年度1講師のunique制約に違反したらここで例外
      await db.insert(teacherSubject).values(values);
    } catch {
      return c.json(
        { message: "取り込み失敗（1科目に対し講師が重複しています）" },
        422,
      );
    }

    return c.json({ message: "取り込み完了", count: values.length });
  },
);

/* ---------- 学生・科目 ---------- */
relations.get("/student-subject", requireAuth(), async (c) => {
  const subjectId = c.req.query("subjectId");
  const rows = subjectId
    ? await db
        .select()
        .from(studentSubject)
        .where(eq(studentSubject.subjectId, Number(subjectId)))
    : await db.select().from(studentSubject);
  return c.json(rows);
});

relations.post(
  "/student-subject/import",
  requireAuth({ allowedRoles: ["full_time_teacher"] }),
  async (c) => {
    const { csv } = await c.req.json<{ csv?: string }>();
    if (!csv) return c.json({ message: "csvは必須です" }, 400);

    const rows = parseCsv(csv);
    const errors = validateRequiredFields(rows, ["学籍番号", "科目名", "year"]);
    const typeErrors = validateFieldTypes(rows, { year: "integer" });
    if (errors.length > 0 || typeErrors.length > 0)
      return c.json(
        { message: "取り込み失敗", errors: [...errors, ...typeErrors] },
        422,
      );

    const { idsByName: studentIdsByNumber, errors: studentErrors } =
      await resolveNamesToIds(rows, "学籍番号", (numbers) =>
        db
          .select({ id: student.id, name: student.studentNumber })
          .from(student)
          .where(inArray(student.studentNumber, numbers)),
      );
    const { idsByKey: subjectIdsByKey, errors: subjectErrors } =
      await resolveSubjectIdsByNameYear(rows);

    const resolveErrors = [...studentErrors, ...subjectErrors];
    if (resolveErrors.length > 0)
      return c.json({ message: "取り込み失敗", errors: resolveErrors }, 422);

    const values = rows.map((r) => ({
      studentId: studentIdsByNumber.get(r["学籍番号"])![0],
      subjectId: subjectIdsByKey.get(`${r["科目名"]}:${r.year}`)![0],
      year: Number(r.year),
      isRetake: r.isRetake === "true" || r.isRetake === "1",
    }));

    try {
      await db.insert(studentSubject).values(values);
    } catch {
      return c.json(
        { message: "取り込み失敗（重複した履修登録があります）" },
        422,
      );
    }

    return c.json({ message: "取り込み完了", count: values.length });
  },
);

export default relations;
