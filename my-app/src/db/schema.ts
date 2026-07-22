import {
  mysqlTable,
  mysqlEnum,
  serial,
  int,
  varchar,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/mysql-core";

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const studentStatusValues = [
  "enrolled", // 在学
  "leave", // 休学
  "withdrawn", // 退学
  "graduated", // 卒業済み
] as const;

export const finalRankValues = [
  "excellent", // 秀 100-90
  "very_good", // 優 89-80
  "good", // 良 79-70
  "pass", // 可 69-60
  "fail", // 不可 59以下
] as const;

/* -------------------------------------------------------------------------- */
/* Master tables                                                              */
/* -------------------------------------------------------------------------- */

export const major = mysqlTable("major", {
  id: serial("major_id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
});

export const fullTimeTeacher = mysqlTable("full_time_teacher", {
  id: serial("full_time_teacher_id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const teacher = mysqlTable("teacher", {
  id: serial("teacher_id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const student = mysqlTable("student", {
  id: serial("student_id").primaryKey(),
  studentNumber: varchar("student_number", { length: 50 }).notNull().unique(), // 学籍番号
  name: varchar("name", { length: 100 }).notNull(),
  readingName: varchar("reading_name", { length: 100 }).notNull(),
  status: mysqlEnum("student_status", studentStatusValues)
    .notNull()
    .default("enrolled"),
  majorId: int("major_id")
    .notNull()
    .references(() => major.id),
});

/* -------------------------------------------------------------------------- */
/* Subject (年度ごとに名称を保持。subjectCode で同一科目を横断グルーピング)      */
/* -------------------------------------------------------------------------- */

export const subject = mysqlTable(
  "subject",
  {
    id: serial("subject_id").primaryKey(),
    subjectCode: varchar("subject_code", { length: 50 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    year: int("year").notNull(),
  },
  (table) => ({
    // 同じ科目コード×年度は一意
    uniqueSubjectPerYear: unique().on(table.subjectCode, table.year),
  })
);

/* -------------------------------------------------------------------------- */
/* 講師・科目紐づけ (4.5) — 1科目につき講師は1人、年度単位                     */
/* -------------------------------------------------------------------------- */

export const teacherSubject = mysqlTable(
  "teacher_subject",
  {
    id: serial("teacher_subject_id").primaryKey(),
    teacherId: int("teacher_id")
      .notNull()
      .references(() => teacher.id),
    subjectId: int("subject_id")
      .notNull()
      .references(() => subject.id),
    year: int("year").notNull(),
  },
  (table) => ({
    // 1科目(1年度)につき講師は1人まで
    uniqueTeacherPerSubjectYear: unique().on(table.subjectId, table.year),
  })
);

/* -------------------------------------------------------------------------- */
/* 学生・科目紐づけ (4.6)                                                     */
/* -------------------------------------------------------------------------- */

export const studentSubject = mysqlTable(
  "student_subject",
  {
    id: serial("student_subject_id").primaryKey(),
    studentId: int("student_id")
      .notNull()
      .references(() => student.id),
    subjectId: int("subject_id")
      .notNull()
      .references(() => subject.id),
    year: int("year").notNull(),
    isRetake: boolean("is_retake").notNull().default(false), // 再履修フラグ
  },
  (table) => ({
    uniqueEnrollment: unique().on(
      table.studentId,
      table.subjectId,
      table.year
    ),
  })
);

/* -------------------------------------------------------------------------- */
/* 評価重み (4.7) — 半期ごと、翌年度開始前まで変更可                          */
/* -------------------------------------------------------------------------- */

export const weight = mysqlTable(
  "weight",
  {
    id: serial("weight_id").primaryKey(),
    subjectId: int("subject_id")
      .notNull()
      .references(() => subject.id),
    year: int("year").notNull(),
    term: int("term").notNull(), // 前期/後期など
    attendanceRateWeight: int("attendance_rate_weight").notNull(), // 出席率の重み
    attitudeClassWeight: int("attitude_class_weight").notNull(), // 授業態度の重み
    homeworkEvaluationWeight: int("homework_evaluation_weight").notNull(), // 課題評価の重み
    // 3項目の合計が10になる制約はアプリ側バリデーションで担保
  },
  (table) => ({
    uniqueWeightPerTerm: unique().on(table.subjectId, table.year, table.term),
  })
);

/* -------------------------------------------------------------------------- */
/* 成績 (4.8 / 4.9)                                                           */
/* -------------------------------------------------------------------------- */

export const grade = mysqlTable(
  "grade",
  {
    id: serial("grade_id").primaryKey(),
    studentId: int("student_id")
      .notNull()
      .references(() => student.id),
    subjectId: int("subject_id")
      .notNull()
      .references(() => subject.id),
    year: int("year").notNull(),
    term: int("term").notNull(),

    // 登録時点の科目名を保存(5.4: 科目名変更が過去成績に影響しないように)
    subjectNameSnapshot: varchar("subject_name_snapshot", {
      length: 100,
    }).notNull(),

    attendanceRate: int("attendance_rate"), // 0-100、未入力可
    attitudeClass: int("attitude_class"), // 1-10、未入力可
    homeworkEvaluation: int("homework_evaluation"), // 1-10、未入力可

    finalScore: int("final_score"), // 重み計算後の最終点数
    finalRank: mysqlEnum("final_rank", finalRankValues), // 秀/優/良/可/不可

    isIncomplete: boolean("is_incomplete").notNull().default(true), // 未入力有無(表示強調用)

    updatedBy: int("updated_by"), // teacher_id or full_time_teacher_id (編集者)
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    uniqueGrade: unique().on(
      table.studentId,
      table.subjectId,
      table.year,
      table.term
    ),
  })
);

/* -------------------------------------------------------------------------- */
/* 年度確定 (4.12)                                                            */
/* -------------------------------------------------------------------------- */

export const yearConfirmation = mysqlTable("year_confirmation", {
  id: serial("year_confirmation_id").primaryKey(),
  year: int("year").notNull().unique(),
  confirmedBy: int("confirmed_by")
    .notNull()
    .references(() => fullTimeTeacher.id),
  confirmedAt: timestamp("confirmed_at").defaultNow().notNull(),
  isConfirmed: boolean("is_confirmed").notNull().default(false),
});