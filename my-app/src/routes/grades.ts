// src/routes/grades.ts
import { Hono } from "hono";
import { and, eq, gte, inArray, or } from "drizzle-orm";
import { db } from "@/src/db";
import {
  grade,
  teacherSubject,
  subject,
  weight,
  student,
  major,
  studentSubject,
} from "@/src/db/schema";
import { isYearConfirmed } from "@/src/lib/year-guard";
import {
  calculateFinalScore,
  calculateFinalRank,
} from "@/src/lib/grade-calculator";
import { computeGradeLevel } from "@/src/lib/grade-level";
import {
  getOwnedYearsForSubject,
  getOwnedSubjectYearPairs,
} from "@/src/lib/authorization";
import { requireAuth, type AuthEnv } from "@/src/middleware/auth";

const grades = new Hono<AuthEnv>();

async function assertOwnsSubject(
  userId: number,
  subjectId: number,
  year: number,
) {
  const [assignment] = await db
    .select()
    .from(teacherSubject)
    .where(
      and(
        eq(teacherSubject.teacherId, userId),
        eq(teacherSubject.subjectId, subjectId),
        eq(teacherSubject.year, year),
      ),
    );
  return !!assignment;
}

/* GET /grades （権限:講師=過去3年分、専任職員=全期間） 4.13 */
grades.get("/", requireAuth(), async (c) => {
  const user = c.get("user");
  const conditions = [];

  if (user.role === "teacher") {
    const cutoffYear = new Date().getFullYear() - 3;
    conditions.push(gte(grade.year, cutoffYear));
  }

  const rows = conditions.length
    ? await db
        .select()
        .from(grade)
        .where(and(...conditions))
    : await db.select().from(grade);

  return c.json(rows);
});

/* GET /grades/subject/:subjectId （6.7: 教員は担当外の科目は見れない） */
grades.get("/subject/:subjectId", requireAuth(), async (c) => {
  const user = c.get("user");
  const subjectId = Number(c.req.param("subjectId"));

  if (user.role === "teacher") {
    const ownedYears = await getOwnedYearsForSubject(user.id, subjectId);
    if (ownedYears.length === 0) {
      return c.json({ message: "担当外の科目です" }, 403);
    }

    const cutoffYear = new Date().getFullYear() - 3;
    const visibleYears = ownedYears.filter((y) => y >= cutoffYear);
    if (visibleYears.length === 0) return c.json([]);

    const rows = await db
      .select()
      .from(grade)
      .where(
        and(eq(grade.subjectId, subjectId), inArray(grade.year, visibleYears)),
      );
    return c.json(rows);
  }

  const rows = await db
    .select()
    .from(grade)
    .where(eq(grade.subjectId, subjectId));
  return c.json(rows);
});

/* GET /grades/student/:studentId （講師=担当科目×過去3年分のみ、専任職員=全件 6.7/4.13） */
grades.get("/student/:studentId", requireAuth(), async (c) => {
  const user = c.get("user");
  const studentId = Number(c.req.param("studentId"));

  if (user.role === "teacher") {
    const pairs = await getOwnedSubjectYearPairs(user.id);
    if (pairs.length === 0) return c.json([]);

    const cutoffYear = new Date().getFullYear() - 3;
    const ownershipCondition = or(
      ...pairs
        .filter((p) => p.year >= cutoffYear)
        .map((p) =>
          and(eq(grade.subjectId, p.subjectId), eq(grade.year, p.year)),
        ),
    );
    if (!ownershipCondition) return c.json([]);

    const rows = await db
      .select()
      .from(grade)
      .where(and(eq(grade.studentId, studentId), ownershipCondition));
    return c.json(rows);
  }

  const rows = await db
    .select()
    .from(grade)
    .where(eq(grade.studentId, studentId));
  return c.json(rows);
});

/* GET /grades/entry-sheet: 講師ホーム画面用、担当科目1つ分の履修生徒×成績入力シート */
grades.get(
  "/entry-sheet",
  requireAuth({ allowedRoles: ["teacher"] }),
  async (c) => {
    const user = c.get("user");
    const subjectId = Number(c.req.query("subjectId"));
    const year = Number(c.req.query("year")) || new Date().getFullYear();
    const term = Number(c.req.query("term")) || 1;
    const search = c.req.query("search")?.trim();
    const onlyIncomplete = c.req.query("incomplete") === "true";
    const onlyFail = c.req.query("fail") === "true";

    if (!subjectId) return c.json({ message: "subjectIdは必須です" }, 400);

    const owns = await assertOwnsSubject(user.id, subjectId, year);
    if (!owns) return c.json({ message: "担当外の科目です" }, 403);

    const [subj] = await db
      .select()
      .from(subject)
      .where(eq(subject.id, subjectId));
    if (!subj) return c.json({ message: "科目が見つかりません" }, 404);

    const [w] = await db
      .select()
      .from(weight)
      .where(
        and(
          eq(weight.subjectId, subjectId),
          eq(weight.year, year),
          eq(weight.term, term),
        ),
      );

    const enrolled = await db
      .select({
        id: student.id,
        name: student.name,
        studentNumber: student.studentNumber,
        majorName: major.name,
        enrollmentYear: student.enrollmentYear,
      })
      .from(studentSubject)
      .innerJoin(student, eq(studentSubject.studentId, student.id))
      .innerJoin(major, eq(student.majorId, major.id))
      .where(
        and(
          eq(studentSubject.subjectId, subjectId),
          eq(studentSubject.year, year),
        ),
      );

    const gradeRows = await db
      .select()
      .from(grade)
      .where(
        and(
          eq(grade.subjectId, subjectId),
          eq(grade.year, year),
          eq(grade.term, term),
        ),
      );
    const gradeByStudent = new Map(gradeRows.map((g) => [g.studentId, g]));

    let students = enrolled.map((s) => {
      const g = gradeByStudent.get(s.id);
      return {
        id: s.id,
        name: s.name,
        studentNumber: s.studentNumber,
        majorName: s.majorName,
        gradeLevel: computeGradeLevel(s.enrollmentYear, year),
        gradeId: g?.id ?? null,
        attendanceRate: g?.attendanceRate ?? null,
        attitudeClass: g?.attitudeClass ?? null,
        homeworkEvaluation: g?.homeworkEvaluation ?? null,
        finalRank: g?.finalRank ?? null,
        isIncomplete: g ? g.isIncomplete : true,
      };
    });

    if (search) {
      students = students.filter(
        (s) => s.name.includes(search) || s.studentNumber.includes(search),
      );
    }
    if (onlyIncomplete) students = students.filter((s) => s.isIncomplete);
    if (onlyFail) students = students.filter((s) => s.finalRank === "fail");

    return c.json({ subjectName: subj.name, weight: w ?? null, students });
  },
);

/* GET /grades/my-history: 講師ホーム「過去の成績一覧」用、担当科目全体の 生徒×科目 成績ピボット */
grades.get(
  "/my-history",
  requireAuth({ allowedRoles: ["teacher"] }),
  async (c) => {
    const user = c.get("user");
    const year = Number(c.req.query("year")) || new Date().getFullYear();
    const term = Number(c.req.query("term")) || 1;
    const gradeLevel = c.req.query("gradeLevel")
      ? Number(c.req.query("gradeLevel"))
      : null;
    const onlyFail = c.req.query("fail") === "true";
    const search = c.req.query("search")?.trim();

    const pairs = await getOwnedSubjectYearPairs(user.id);
    const mySubjectIds = [
      ...new Set(pairs.filter((p) => p.year === year).map((p) => p.subjectId)),
    ];
    if (mySubjectIds.length === 0) {
      return c.json({ subjects: [], students: [] });
    }

    const subjectRows = await db
      .select({ id: subject.id, name: subject.name })
      .from(subject)
      .where(inArray(subject.id, mySubjectIds));

    const enrolled = await db
      .selectDistinct({
        id: student.id,
        name: student.name,
        studentNumber: student.studentNumber,
        enrollmentYear: student.enrollmentYear,
      })
      .from(studentSubject)
      .innerJoin(student, eq(studentSubject.studentId, student.id))
      .where(
        and(
          inArray(studentSubject.subjectId, mySubjectIds),
          eq(studentSubject.year, year),
        ),
      );

    const gradeRows = await db
      .select()
      .from(grade)
      .where(
        and(
          inArray(grade.subjectId, mySubjectIds),
          eq(grade.year, year),
          eq(grade.term, term),
        ),
      );
    const gradeByKey = new Map(
      gradeRows.map((g) => [`${g.studentId}:${g.subjectId}`, g]),
    );

    type Cell = {
      gradeId: number;
      finalRank: string | null;
      isIncomplete: boolean;
    } | null;

    let students = enrolled.map((s) => {
      const cells: Record<number, Cell> = {};
      for (const subj of subjectRows) {
        const g = gradeByKey.get(`${s.id}:${subj.id}`);
        cells[subj.id] = g
          ? { gradeId: g.id, finalRank: g.finalRank, isIncomplete: g.isIncomplete }
          : null;
      }
      return {
        id: s.id,
        name: s.name,
        studentNumber: s.studentNumber,
        gradeLevel: computeGradeLevel(s.enrollmentYear, year),
        grades: cells,
      };
    });

    if (gradeLevel !== null) {
      students = students.filter((s) => s.gradeLevel === gradeLevel);
    }
    if (search) {
      students = students.filter(
        (s) => s.name.includes(search) || s.studentNumber.includes(search),
      );
    }
    if (onlyFail) {
      students = students.filter((s) =>
        Object.values(s.grades).some((cell) => cell?.finalRank === "fail"),
      );
    }

    return c.json({ subjects: subjectRows, students });
  },
);

/* GET /grades/validate: 未入力 or 不可(59以下)の成績を一覧（専任教員向け） */
grades.get(
  "/validate",
  requireAuth({ allowedRoles: ["full_time_teacher"] }),
  async (c) => {
    const rows = await db
      .select()
      .from(grade)
      .where(eq(grade.isIncomplete, true));
    const failing = await db
      .select()
      .from(grade)
      .where(eq(grade.finalRank, "fail"));
    return c.json({ incomplete: rows, failing });
  },
);

/* POST /grades （講師が入力） */
grades.post("/", requireAuth({ allowedRoles: ["teacher"] }), async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{
    studentId: number;
    subjectId: number;
    year: number;
    term: number;
    attendanceRate?: number;
    attitudeClass?: number;
    homeworkEvaluation?: number;
  }>();

  if (await isYearConfirmed(body.year)) {
    return c.json({ message: "確定済みの年度は編集できません" }, 403);
  }

  const owns = await assertOwnsSubject(user.id, body.subjectId, body.year);
  if (!owns) return c.json({ message: "担当外の科目です" }, 403);

  if (
    body.attendanceRate !== undefined &&
    (body.attendanceRate < 1 || body.attendanceRate > 100)
  ) {
    return c.json({ message: "出席率は1〜100で入力してください" }, 400);
  }
  if (
    body.attitudeClass !== undefined &&
    (body.attitudeClass < 1 || body.attitudeClass > 10)
  ) {
    return c.json({ message: "授業態度は1〜10で入力してください" }, 400);
  }
  if (
    body.homeworkEvaluation !== undefined &&
    (body.homeworkEvaluation < 1 || body.homeworkEvaluation > 10)
  ) {
    return c.json({ message: "課題評価は1〜10で入力してください" }, 400);
  }

  const [subj] = await db
    .select()
    .from(subject)
    .where(eq(subject.id, body.subjectId));
  if (!subj) return c.json({ message: "科目が見つかりません" }, 404);

  const isIncomplete =
    body.attendanceRate === undefined ||
    body.attitudeClass === undefined ||
    body.homeworkEvaluation === undefined;

  let finalScore: number | null = null;
  let finalRank = null;

  if (!isIncomplete) {
    const [w] = await db
      .select()
      .from(weight)
      .where(
        and(
          eq(weight.subjectId, body.subjectId),
          eq(weight.year, body.year),
          eq(weight.term, body.term),
        ),
      );
    if (w) {
      finalScore = calculateFinalScore(
        {
          attendanceRate: body.attendanceRate!,
          attitudeClass: body.attitudeClass!,
          homeworkEvaluation: body.homeworkEvaluation!,
        },
        w,
      );
      finalRank = calculateFinalRank(finalScore);
    }
  }

  try {
    const [inserted] = await db
      .insert(grade)
      .values({
        studentId: body.studentId,
        subjectId: body.subjectId,
        year: body.year,
        term: body.term,
        subjectNameSnapshot: subj.name,
        attendanceRate: body.attendanceRate ?? null,
        attitudeClass: body.attitudeClass ?? null,
        homeworkEvaluation: body.homeworkEvaluation ?? null,
        finalScore,
        finalRank,
        isIncomplete,
        updatedBy: user.id,
      })
      .$returningId();

    return c.json({ id: inserted.id }, 201);
  } catch {
    return c.json(
      { message: "この学生・科目・学期の成績は既に登録されています" },
      422,
    );
  }
});

/* PATCH /grades/:id （講師=自分の担当分、専任職員=全件編集可 4.8） */
grades.patch("/:id", requireAuth(), async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  const body = await c.req.json<Partial<typeof grade.$inferInsert>>();

  const [existing] = await db.select().from(grade).where(eq(grade.id, id));
  if (!existing) return c.json({ message: "見つかりません" }, 404);

  if (await isYearConfirmed(existing.year)) {
    return c.json({ message: "確定済みの年度は編集できません" }, 403);
  }

  if (user.role === "teacher") {
    const owns = await assertOwnsSubject(
      user.id,
      existing.subjectId,
      existing.year,
    );
    if (!owns) return c.json({ message: "担当外の科目です" }, 403);
  }

  const merged = { ...existing, ...body };
  const isIncomplete =
    merged.attendanceRate === null ||
    merged.attitudeClass === null ||
    merged.homeworkEvaluation === null;

  let finalScore: number | null = null;
  let finalRank = null;

  if (!isIncomplete) {
    const [w] = await db
      .select()
      .from(weight)
      .where(
        and(
          eq(weight.subjectId, merged.subjectId),
          eq(weight.year, merged.year),
          eq(weight.term, merged.term),
        ),
      );
    if (w) {
      finalScore = calculateFinalScore(
        {
          attendanceRate: merged.attendanceRate,
          attitudeClass: merged.attitudeClass,
          homeworkEvaluation: merged.homeworkEvaluation,
        },
        w,
      );
      finalRank = calculateFinalRank(finalScore);
    }
  }

  await db
    .update(grade)
    .set({ ...body, isIncomplete, finalScore, finalRank, updatedBy: user.id })
    .where(eq(grade.id, id));

  return c.json({ message: "更新しました" });
});

/* POST /grades/calculate: 重み変更後などに指定科目・年度・学期の成績を一括再計算 */
grades.post(
  "/calculate",
  requireAuth({ allowedRoles: ["teacher", "full_time_teacher"] }),
  async (c) => {
    const { subjectId, year, term } = await c.req.json<{
      subjectId: number;
      year: number;
      term: number;
    }>();

    const [w] = await db
      .select()
      .from(weight)
      .where(
        and(
          eq(weight.subjectId, subjectId),
          eq(weight.year, year),
          eq(weight.term, term),
        ),
      );
    if (!w) return c.json({ message: "重みが設定されていません" }, 404);

    const targetGrades = await db
      .select()
      .from(grade)
      .where(
        and(
          eq(grade.subjectId, subjectId),
          eq(grade.year, year),
          eq(grade.term, term),
        ),
      );

    let updated = 0;
    for (const g of targetGrades) {
      if (
        g.attendanceRate === null ||
        g.attitudeClass === null ||
        g.homeworkEvaluation === null
      ) {
        continue;
      }
      const finalScore = calculateFinalScore(g, w);
      const finalRank = calculateFinalRank(finalScore);
      await db
        .update(grade)
        .set({ finalScore, finalRank })
        .where(eq(grade.id, g.id));
      updated++;
    }

    return c.json({ message: "再計算しました", updated });
  },
);

export default grades;
