// src/routes/reports.ts
import { Hono, type Context } from "hono";
import { and, eq, gte, inArray, lte, or } from "drizzle-orm";
import { db } from "@/src/db";
import { grade, student, major, subject, studentSubject } from "@/src/db/schema";
import {
  getOwnedYearsForSubject,
  getOwnedSubjectYearPairs,
} from "@/src/lib/authorization";
import { computeGradeLevel } from "@/src/lib/grade-level";
import {
  generateSubjectReportPdf,
  generateStudentReportPdf,
  generateAllStudentsReportPdf,
} from "@/src/lib/pdf-report";
import { requireAuth, type AuthEnv } from "@/src/middleware/auth";

const reports = new Hono<AuthEnv>();

/* GET /reports/subject/:subjectId （6.7: 教員は担当外の科目は見れない） */
reports.get("/subject/:subjectId", requireAuth(), async (c) => {
  const user = c.get("user");
  const subjectId = Number(c.req.param("subjectId"));

  const conditions = [eq(grade.subjectId, subjectId)];
  if (user.role === "teacher") {
    const ownedYears = await getOwnedYearsForSubject(user.id, subjectId);
    if (ownedYears.length === 0) {
      return c.json({ message: "担当外の科目です" }, 403);
    }

    const cutoffYear = new Date().getFullYear() - 3;
    const visibleYears = ownedYears.filter((y) => y >= cutoffYear);
    if (visibleYears.length === 0) return c.json([]);

    conditions.push(inArray(grade.year, visibleYears));
  }

  const rows = await db
    .select({
      studentId: student.id,
      studentName: student.name,
      studentNumber: student.studentNumber,
      majorId: student.majorId,
      attendanceRate: grade.attendanceRate,
      attitudeClass: grade.attitudeClass,
      homeworkEvaluation: grade.homeworkEvaluation,
      finalRank: grade.finalRank,
    })
    .from(grade)
    .innerJoin(student, eq(grade.studentId, student.id))
    .where(and(...conditions));

  return c.json(rows);
});

/* GET /reports/student/:studentId （講師=担当科目×過去3年分のみ、専任職員=全件 6.7/4.13） */
reports.get("/student/:studentId", requireAuth(), async (c) => {
  const user = c.get("user");
  const studentId = Number(c.req.param("studentId"));
  const from = c.req.query("from"); // year
  const to = c.req.query("to");

  const conditions = [eq(grade.studentId, studentId)];
  if (from) conditions.push(gte(grade.year, Number(from)));
  if (to) conditions.push(lte(grade.year, Number(to)));

  if (user.role === "teacher") {
    const pairs = await getOwnedSubjectYearPairs(user.id);
    const cutoffYear = new Date().getFullYear() - 3;
    const ownershipCondition = or(
      ...pairs
        .filter((p) => p.year >= cutoffYear)
        .map((p) =>
          and(eq(grade.subjectId, p.subjectId), eq(grade.year, p.year)),
        ),
    );
    if (!ownershipCondition) return c.json([]);
    conditions.push(ownershipCondition);
  }

  const rows = await db
    .select()
    .from(grade)
    .where(and(...conditions));
  return c.json(rows);
});

/* GET /reports/overview （専任職員ホーム画面: 年度×学期で絞った 生徒×科目 成績一覧。専任職員のみ） */
reports.get(
  "/overview",
  requireAuth({ allowedRoles: ["full_time_teacher"] }),
  async (c) => {
    const year = Number(c.req.query("year")) || new Date().getFullYear();
    const term = Number(c.req.query("term")) || 1;
    const search = c.req.query("search")?.trim();
    const onlyIncomplete = c.req.query("incomplete") === "true";
    const onlyFail = c.req.query("fail") === "true";

    const subjectRows = await db
      .selectDistinct({ id: subject.id, name: subject.name })
      .from(subject)
      .innerJoin(studentSubject, eq(studentSubject.subjectId, subject.id))
      .where(eq(studentSubject.year, year))
      .orderBy(subject.id);

    const studentRows = await db
      .selectDistinct({
        id: student.id,
        name: student.name,
        studentNumber: student.studentNumber,
        majorId: student.majorId,
      })
      .from(student)
      .innerJoin(studentSubject, eq(studentSubject.studentId, student.id))
      .where(eq(studentSubject.year, year))
      .orderBy(student.id);

    const gradeRows = await db
      .select()
      .from(grade)
      .where(and(eq(grade.year, year), eq(grade.term, term)));

    const gradeByKey = new Map<string, (typeof gradeRows)[number]>();
    for (const g of gradeRows) {
      gradeByKey.set(`${g.studentId}:${g.subjectId}`, g);
    }

    type Cell = {
      gradeId: number;
      attendanceRate: number | null;
      attitudeClass: number | null;
      homeworkEvaluation: number | null;
      finalRank: string | null;
      isIncomplete: boolean;
    } | null;

    let students = studentRows
      .filter(
        (s) =>
          !search ||
          s.name.includes(search) ||
          s.studentNumber.includes(search),
      )
      .map((s) => {
        const cells: Record<number, Cell> = {};
        for (const subj of subjectRows) {
          const g = gradeByKey.get(`${s.id}:${subj.id}`);
          cells[subj.id] = g
            ? {
                gradeId: g.id,
                attendanceRate: g.attendanceRate,
                attitudeClass: g.attitudeClass,
                homeworkEvaluation: g.homeworkEvaluation,
                finalRank: g.finalRank,
                isIncomplete: g.isIncomplete,
              }
            : null;
        }
        return {
          id: s.id,
          name: s.name,
          studentNumber: s.studentNumber,
          majorId: s.majorId,
          grades: cells,
        };
      });

    if (onlyIncomplete) {
      students = students.filter((s) =>
        Object.values(s.grades).some((cell) => !cell || cell.isIncomplete),
      );
    }
    if (onlyFail) {
      students = students.filter((s) =>
        Object.values(s.grades).some((cell) => cell?.finalRank === "fail"),
      );
    }

    return c.json({ year, term, subjects: subjectRows, students });
  },
);

/* GET /reports/subject/:subjectId/pdf （4.4/4.10 科目別成績表PDF、6.7: 教員は担当外の科目は見れない） */
reports.get("/subject/:subjectId/pdf", requireAuth(), async (c) => {
  const user = c.get("user");
  const subjectId = Number(c.req.param("subjectId"));

  const [subjectRow] = await db
    .select({ name: subject.name })
    .from(subject)
    .where(eq(subject.id, subjectId));
  if (!subjectRow) return c.json({ message: "科目が見つかりません" }, 404);

  const conditions = [eq(grade.subjectId, subjectId)];
  if (user.role === "teacher") {
    const ownedYears = await getOwnedYearsForSubject(user.id, subjectId);
    if (ownedYears.length === 0) {
      return c.json({ message: "担当外の科目です" }, 403);
    }

    const cutoffYear = new Date().getFullYear() - 3;
    const visibleYears = ownedYears.filter((y) => y >= cutoffYear);
    if (visibleYears.length === 0) {
      const pdf = await generateSubjectReportPdf(subjectRow.name, [], false);
      return respondWithPdf(c, pdf, `subject_${subjectId}_report.pdf`);
    }
    conditions.push(inArray(grade.year, visibleYears));
  }

  const rows = await db
    .select({
      studentName: student.name,
      studentNumber: student.studentNumber,
      majorName: major.name,
      attendanceRate: grade.attendanceRate,
      attitudeClass: grade.attitudeClass,
      homeworkEvaluation: grade.homeworkEvaluation,
      finalRank: grade.finalRank,
      isIncomplete: grade.isIncomplete,
    })
    .from(grade)
    .innerJoin(student, eq(grade.studentId, student.id))
    .innerJoin(major, eq(student.majorId, major.id))
    .where(and(...conditions));

  const pdf = await generateSubjectReportPdf(subjectRow.name, rows, false);
  return respondWithPdf(c, pdf, `subject_${subjectId}_report.pdf`);
});

type AuthUser = { id: number; role: "teacher" | "full_time_teacher" };

/* 個人別成績表(4.11)の元データ取得。PDF出力とプレビュー画面(/detail)で共用 */
async function getStudentReportData(
  user: AuthUser,
  studentId: number,
  from?: string,
  to?: string,
) {
  const [studentRow] = await db
    .select({
      name: student.name,
      studentNumber: student.studentNumber,
      status: student.status,
      majorName: major.name,
      enrollmentYear: student.enrollmentYear,
    })
    .from(student)
    .innerJoin(major, eq(student.majorId, major.id))
    .where(eq(student.id, studentId));
  if (!studentRow) return null;

  const conditions = [eq(grade.studentId, studentId)];
  if (from) conditions.push(gte(grade.year, Number(from)));
  if (to) conditions.push(lte(grade.year, Number(to)));

  if (user.role === "teacher") {
    const pairs = await getOwnedSubjectYearPairs(user.id);
    const cutoffYear = new Date().getFullYear() - 3;
    const ownershipCondition = or(
      ...pairs
        .filter((p) => p.year >= cutoffYear)
        .map((p) =>
          and(eq(grade.subjectId, p.subjectId), eq(grade.year, p.year)),
        ),
    );
    if (!ownershipCondition) return { studentRow, rows: [] };
    conditions.push(ownershipCondition);
  }

  const rows = await db
    .select({
      subjectName: grade.subjectNameSnapshot,
      year: grade.year,
      term: grade.term,
      attendanceRate: grade.attendanceRate,
      attitudeClass: grade.attitudeClass,
      homeworkEvaluation: grade.homeworkEvaluation,
      finalRank: grade.finalRank,
      isIncomplete: grade.isIncomplete,
    })
    .from(grade)
    .where(and(...conditions));

  return { studentRow, rows };
}

/* 指定年度に履修登録がある全生徒分の個人別成績表データを一括取得(N+1回避のためgradeは1クエリでまとめて取得) */
async function getAllStudentsReportData(user: AuthUser, year: number) {
  const studentRows = await db
    .selectDistinct({
      id: student.id,
      name: student.name,
      studentNumber: student.studentNumber,
      status: student.status,
      majorName: major.name,
      enrollmentYear: student.enrollmentYear,
    })
    .from(student)
    .innerJoin(major, eq(student.majorId, major.id))
    .innerJoin(studentSubject, eq(studentSubject.studentId, student.id))
    .where(eq(studentSubject.year, year))
    .orderBy(student.id);

  if (studentRows.length === 0) return [];

  const studentIds = studentRows.map((s) => s.id);
  const conditions = [inArray(grade.studentId, studentIds)];

  if (user.role === "teacher") {
    const pairs = await getOwnedSubjectYearPairs(user.id);
    const cutoffYear = new Date().getFullYear() - 3;
    const ownershipCondition = or(
      ...pairs
        .filter((p) => p.year >= cutoffYear)
        .map((p) =>
          and(eq(grade.subjectId, p.subjectId), eq(grade.year, p.year)),
        ),
    );
    if (!ownershipCondition) {
      return studentRows.map((s) => ({ studentRow: s, gradeYears: {} }));
    }
    conditions.push(ownershipCondition);
  }

  const gradeRows = await db
    .select({
      studentId: grade.studentId,
      subjectName: grade.subjectNameSnapshot,
      year: grade.year,
      term: grade.term,
      attendanceRate: grade.attendanceRate,
      attitudeClass: grade.attitudeClass,
      homeworkEvaluation: grade.homeworkEvaluation,
      finalRank: grade.finalRank,
      isIncomplete: grade.isIncomplete,
    })
    .from(grade)
    .where(and(...conditions));

  const rowsByStudent = new Map<number, typeof gradeRows>();
  for (const row of gradeRows) {
    if (!rowsByStudent.has(row.studentId)) rowsByStudent.set(row.studentId, []);
    rowsByStudent.get(row.studentId)!.push(row);
  }

  return studentRows.map((s) => {
    const gradeYears: Record<number, typeof gradeRows> = {};
    for (const row of rowsByStudent.get(s.id) ?? []) {
      const level = computeGradeLevel(s.enrollmentYear, row.year);
      if (!gradeYears[level]) gradeYears[level] = [];
      gradeYears[level].push(row);
    }
    return { studentRow: s, gradeYears };
  });
}

/* GET /reports/students/detail （全生徒分の個人別成績表プレビュー用JSON） */
reports.get("/students/detail", requireAuth(), async (c) => {
  const user = c.get("user");
  const year = Number(c.req.query("year")) || new Date().getFullYear();

  const data = await getAllStudentsReportData(user, year);

  return c.json({
    students: data.map(({ studentRow, gradeYears }) => ({
      student: {
        id: studentRow.id,
        name: studentRow.name,
        studentNumber: studentRow.studentNumber,
        majorName: studentRow.majorName,
        gradeLevel: computeGradeLevel(studentRow.enrollmentYear),
      },
      gradeYears,
    })),
  });
});

/* GET /reports/students/pdf （全生徒分の個人別成績表PDF、1名1ページ） */
reports.get("/students/pdf", requireAuth(), async (c) => {
  const user = c.get("user");
  const year = Number(c.req.query("year")) || new Date().getFullYear();

  const data = await getAllStudentsReportData(user, year);

  const pdf = await generateAllStudentsReportPdf(
    data.map(({ studentRow, gradeYears }) => ({
      student: {
        name: studentRow.name,
        studentNumber: studentRow.studentNumber,
        majorName: studentRow.majorName,
        status: studentRow.status,
        gradeLevel: computeGradeLevel(studentRow.enrollmentYear),
      },
      gradeYears,
    })),
    user.role === "full_time_teacher",
  );
  return respondWithPdf(c, pdf, `students_${year}_report.pdf`);
});

/* GET /reports/student/:studentId/detail （4.11 個人別成績表のPDF出力プレビュー用JSON） */
reports.get("/student/:studentId/detail", requireAuth(), async (c) => {
  const user = c.get("user");
  const studentId = Number(c.req.param("studentId"));
  const from = c.req.query("from");
  const to = c.req.query("to");

  const data = await getStudentReportData(user, studentId, from, to);
  if (!data) return c.json({ message: "生徒が見つかりません" }, 404);

  const { studentRow, rows } = data;
  const currentGradeLevel = computeGradeLevel(studentRow.enrollmentYear);

  const gradeYears: Record<number, typeof rows> = {};
  for (const row of rows) {
    const level = computeGradeLevel(studentRow.enrollmentYear, row.year);
    if (!gradeYears[level]) gradeYears[level] = [];
    gradeYears[level].push(row);
  }

  return c.json({
    student: {
      name: studentRow.name,
      studentNumber: studentRow.studentNumber,
      majorName: studentRow.majorName,
      gradeLevel: currentGradeLevel,
    },
    gradeYears,
  });
});

/* GET /reports/student/:studentId/pdf （4.4/4.11 個人別成績表PDF、6.7: 教員は担当外の科目は見れない） */
reports.get("/student/:studentId/pdf", requireAuth(), async (c) => {
  const user = c.get("user");
  const studentId = Number(c.req.param("studentId"));
  const from = c.req.query("from"); // year
  const to = c.req.query("to");

  const data = await getStudentReportData(user, studentId, from, to);
  if (!data) return c.json({ message: "生徒が見つかりません" }, 404);

  const { studentRow, rows } = data;

  const gradeYears: Record<number, typeof rows> = {};
  for (const row of rows) {
    const level = computeGradeLevel(studentRow.enrollmentYear, row.year);
    if (!gradeYears[level]) gradeYears[level] = [];
    gradeYears[level].push(row);
  }

  // 4.11: 不可・出席率不足は専任職員向けに強調表示
  const pdf = await generateStudentReportPdf(
    {
      ...studentRow,
      gradeLevel: computeGradeLevel(studentRow.enrollmentYear),
    },
    gradeYears,
    user.role === "full_time_teacher",
  );
  return respondWithPdf(c, pdf, `student_${studentId}_report.pdf`);
});

function respondWithPdf(c: Context<AuthEnv>, pdf: Buffer, filename: string) {
  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  return c.body(new Uint8Array(pdf));
}

export default reports;
