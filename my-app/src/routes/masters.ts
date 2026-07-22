// src/routes/masters.ts
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import {
  subject,
  student,
  teacher,
  fullTimeTeacher,
  major,
} from "@/src/db/schema";
import { hashPassword } from "@/src/lib/password";
import {
  parseCsv,
  validateRequiredFields,
  type CsvRowError,
} from "@/src/lib/csv";
import { requireAuth, type AuthEnv } from "@/src/middleware/auth";
import { validateFieldTypes } from "./csv";

const masters = new Hono<AuthEnv>();

/* ---------- 専攻 majors ---------- */
masters.get("/majors", requireAuth(), async (c) => {
  const rows = await db.select().from(major);
  return c.json(rows);
});

masters.post(
  "/majors/import",
  requireAuth({ allowedRoles: ["full_time_teacher"] }),
  async (c) => {
    const { csv } = await c.req.json<{ csv?: string }>();
    if (!csv) return c.json({ message: "csvは必須です" }, 400);

    const rows = parseCsv(csv);
    const errors = validateRequiredFields(rows, ["name"]);
    if (errors.length > 0)
      return c.json({ message: "取り込み失敗", errors }, 422);

    await db
      .insert(major)
      .values(rows.map((r) => ({ name: r.name })))
      .onDuplicateKeyUpdate({ set: { name: rows[0]?.name } }); // 名称重複時は要件に応じて調整

    return c.json({ message: "取り込み完了", count: rows.length });
  },
);

/* ---------- 科目 subjects ---------- */
masters.get("/subjects", requireAuth(), async (c) => {
  const year = c.req.query("year");
  const rows = year
    ? await db
        .select()
        .from(subject)
        .where(eq(subject.year, Number(year)))
    : await db.select().from(subject);
  return c.json(rows);
});

masters.post(
  "/subjects/import",
  requireAuth({ allowedRoles: ["full_time_teacher"] }),
  async (c) => {
    const { csv } = await c.req.json<{ csv?: string }>();
    if (!csv) return c.json({ message: "csvは必須です" }, 400);

    const rows = parseCsv(csv);
    const errors = validateRequiredFields(rows, [
      "subjectCode",
      "name",
      "year",
    ]);
    const typeErrors = validateFieldTypes(rows, { year: "integer" });
    if (errors.length > 0)
      return c.json({ message: "取り込み失敗", errors }, 422);

    const values = rows.map((r) => ({
      subjectCode: r.subjectCode,
      name: r.name,
      year: Number(r.year),
    }));

    try {
      await db.insert(subject).values(values);
    } catch {
      return c.json({ message: "取り込み失敗（重複または不正なデータ）" }, 422);
    }

    return c.json({ message: "取り込み完了", count: values.length });
  },
);

/* ---------- 学生 students ---------- */
masters.get("/students", requireAuth(), async (c) => {
  const rows = await db.select().from(student);
  return c.json(rows);
});

masters.post(
  "/students/import",
  requireAuth({ allowedRoles: ["full_time_teacher"] }),
  async (c) => {
    const { csv } = await c.req.json<{ csv?: string }>();
    if (!csv) return c.json({ message: "csvは必須です" }, 400);

    const rows = parseCsv(csv);
    const errors = validateRequiredFields(rows, [
      "studentNumber",
      "name",
      "readingName",
      "majorId",
    ]);
    if (errors.length > 0)
      return c.json({ message: "取り込み失敗", errors }, 422);

    const values = rows.map((r) => ({
      studentNumber: r.studentNumber,
      name: r.name,
      readingName: r.readingName,
      majorId: Number(r.majorId),
      status:
        (r.status as (typeof student.$inferInsert)["status"]) || "enrolled",
    }));

    try {
      await db.insert(student).values(values);
    } catch {
      return c.json({ message: "取り込み失敗（重複または不正なデータ）" }, 422);
    }

    return c.json({ message: "取り込み完了", count: values.length });
  },
);

/* ---------- 講師 teachers / 専任職員 full-time-teachers ---------- */
async function importStaffCsv(
  csv: string,
  table: typeof teacher | typeof fullTimeTeacher,
): Promise<{ errors: CsvRowError[] } | { count: number }> {
  const rows = parseCsv(csv);
  const errors = validateRequiredFields(rows, ["name", "email", "password"]);
  const typeErrors = validateFieldTypes(rows, { email: "email" });
  if (errors.length > 0) return { errors };

  const values = await Promise.all(
    rows.map(async (r) => ({
      name: r.name,
      email: r.email,
      password: await hashPassword(r.password),
      mustChangePassword: true,
    })),
  );

  await db.insert(table).values(values);
  return { count: values.length };
}

masters.get("/teachers", requireAuth(), async (c) => {
  const rows = await db
    .select({ id: teacher.id, name: teacher.name, email: teacher.email })
    .from(teacher);
  return c.json(rows);
});

masters.post(
  "/teachers/import",
  requireAuth({ allowedRoles: ["full_time_teacher"] }),
  async (c) => {
    const { csv } = await c.req.json<{ csv?: string }>();
    if (!csv) return c.json({ message: "csvは必須です" }, 400);

    const result = await importStaffCsv(csv, teacher);
    if ("errors" in result)
      return c.json({ message: "取り込み失敗", errors: result.errors }, 422);
    return c.json({ message: "取り込み完了", count: result.count });
  },
);

masters.get("/full-time-teachers", requireAuth(), async (c) => {
  const rows = await db
    .select({
      id: fullTimeTeacher.id,
      name: fullTimeTeacher.name,
      email: fullTimeTeacher.email,
    })
    .from(fullTimeTeacher);
  return c.json(rows);
});

masters.post(
  "/full-time-teachers/import",
  requireAuth({ allowedRoles: ["full_time_teacher"] }),
  async (c) => {
    const { csv } = await c.req.json<{ csv?: string }>();
    if (!csv) return c.json({ message: "csvは必須です" }, 400);

    const result = await importStaffCsv(csv, fullTimeTeacher);
    if ("errors" in result)
      return c.json({ message: "取り込み失敗", errors: result.errors }, 422);
    return c.json({ message: "取り込み完了", count: result.count });
  },
);

export default masters;
