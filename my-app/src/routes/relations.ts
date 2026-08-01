// src/routes/relations.ts
import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { teacherSubject, studentSubject } from "@/src/db/schema";
import { parseCsv, validateRequiredFields } from "@/src/lib/csv";
import { requireAuth, type AuthEnv } from "@/src/middleware/auth";
import { validateFieldTypes } from "./csv";

const relations = new Hono<AuthEnv>();

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
    const errors = validateRequiredFields(rows, [
      "teacherId",
      "subjectId",
      "year",
    ]);
    const typeErrors = validateFieldTypes(rows, {
      teacherId: "integer",
      subjectId: "integer",
      year: "integer",
    });
    if (errors.length > 0)
      return c.json({ message: "取り込み失敗", errors }, 422);

    const values = rows.map((r) => ({
      teacherId: Number(r.teacherId),
      subjectId: Number(r.subjectId),
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
    const errors = validateRequiredFields(rows, [
      "studentId",
      "subjectId",
      "year",
    ]);
    const typeErrors = validateFieldTypes(rows, {
      teacherId: "integer",
      subjectId: "integer",
      year: "integer",
    });
    if (errors.length > 0)
      return c.json({ message: "取り込み失敗", errors }, 422);

    const values = rows.map((r) => ({
      studentId: Number(r.studentId),
      subjectId: Number(r.subjectId),
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
