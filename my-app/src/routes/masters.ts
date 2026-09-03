// src/routes/masters.ts
import { Hono } from "hono";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/src/db";
import {
  subject,
  student,
  teacher,
  fullTimeTeacher,
  major,
  teacherSubject,
} from "@/src/db/schema";
import { hashPassword } from "@/src/lib/password";
import {
  parseCsv,
  validateRequiredFields,
  resolveNamesToIds,
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
    if (errors.length > 0 || typeErrors.length > 0)
      return c.json(
        { message: "取り込み失敗", errors: [...errors, ...typeErrors] },
        422,
      );

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

/* 科目名+担当講師名から「科目作成」と「講師・科目紐づけ」を一括で行う
   (専攻,科目名,担当講師 形式のCSV向け。専攻列は参考情報として保存しない。
   subjectCodeは科目名をそのまま使用し、年度は現在年を自動適用する) */
masters.post(
  "/subjects/import-with-teacher",
  requireAuth({ allowedRoles: ["full_time_teacher"] }),
  async (c) => {
    const { csv } = await c.req.json<{ csv?: string }>();
    if (!csv) return c.json({ message: "csvは必須です" }, 400);

    const rows = parseCsv(csv);
    const errors = validateRequiredFields(rows, ["科目名", "担当講師"]);
    if (errors.length > 0)
      return c.json({ message: "取り込み失敗", errors }, 422);

    const year = new Date().getFullYear();

    const { idsByName: teacherIdsByName, errors: teacherErrors } =
      await resolveNamesToIds(rows, "担当講師", (names) =>
        db
          .select({ id: teacher.id, name: teacher.name })
          .from(teacher)
          .where(inArray(teacher.name, names)),
      );
    if (teacherErrors.length > 0) {
      return c.json({ message: "取り込み失敗", errors: teacherErrors }, 422);
    }

    let count = 0;
    try {
      await db.transaction(async (tx) => {
        for (const r of rows) {
          const teacherId = teacherIdsByName.get(r["担当講師"])![0];
          const [inserted] = await tx
            .insert(subject)
            .values({ subjectCode: r["科目名"], name: r["科目名"], year })
            .$returningId();
          await tx.insert(teacherSubject).values({
            teacherId,
            subjectId: inserted.id,
            year,
          });
          count++;
        }
      });
    } catch {
      return c.json(
        {
          message: `取り込み失敗（${count + 1}行目付近で登録に失敗しました。同名の科目が既に${year}年度に存在する可能性があります）`,
        },
        422,
      );
    }

    return c.json({ message: "取り込み完了", count });
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

    // 学籍番号/氏名/氏名（ひらがな）は英語ヘッダー・日本語ヘッダーどちらでも受け付ける
    const rows = parseCsv(csv).map((r) => ({
      ...r,
      studentNumber: r.studentNumber || r["学籍番号"] || "",
      name: r.name || r["氏名"] || "",
      readingName: r.readingName || r["氏名（ひらがな）"] || "",
    }));

    const errors = validateRequiredFields(rows, [
      "studentNumber",
      "name",
      "readingName",
      "専攻",
    ]);
    const typeErrors = validateFieldTypes(rows, {
      enrollmentYear: "integer",
    });
    if (errors.length > 0 || typeErrors.length > 0)
      return c.json(
        { message: "取り込み失敗", errors: [...errors, ...typeErrors] },
        422,
      );

    const { idsByName: majorIdsByName, errors: majorErrors } =
      await resolveNamesToIds(rows, "専攻", (names) =>
        db
          .select({ id: major.id, name: major.name })
          .from(major)
          .where(inArray(major.name, names)),
      );
    if (majorErrors.length > 0)
      return c.json({ message: "取り込み失敗", errors: majorErrors }, 422);

    const currentYear = new Date().getFullYear();
    const values = rows.map((r) => ({
      studentNumber: r.studentNumber,
      name: r.name,
      readingName: r.readingName,
      majorId: majorIdsByName.get(r["専攻"])![0],
      enrollmentYear: r.enrollmentYear ? Number(r.enrollmentYear) : currentYear,
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
  if (errors.length > 0 || typeErrors.length > 0)
    return { errors: [...errors, ...typeErrors] };

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
