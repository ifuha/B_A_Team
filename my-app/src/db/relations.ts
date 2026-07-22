import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  major: {
    students: r.many.student(),
  },

  student: {
    major: r.one.major({
      from: r.student.majorId,
      to: r.major.id,
    }),
    studentSubjects: r.many.studentSubject(),
    grades: r.many.grade(),
  },

  teacher: {
    teacherSubjects: r.many.teacherSubject(),
  },

  fullTimeTeacher: {
    yearConfirmations: r.many.yearConfirmation(),
  },

  subject: {
    teacherSubjects: r.many.teacherSubject(),
    studentSubjects: r.many.studentSubject(),
    weights: r.many.weight(),
    grades: r.many.grade(),
  },

  teacherSubject: {
    teacher: r.one.teacher({
      from: r.teacherSubject.teacherId,
      to: r.teacher.id,
    }),
    subject: r.one.subject({
      from: r.teacherSubject.subjectId,
      to: r.subject.id,
    }),
  },

  studentSubject: {
    student: r.one.student({
      from: r.studentSubject.studentId,
      to: r.student.id,
    }),
    subject: r.one.subject({
      from: r.studentSubject.subjectId,
      to: r.subject.id,
    }),
  },

  weight: {
    subject: r.one.subject({
      from: r.weight.subjectId,
      to: r.subject.id,
    }),
  },

  grade: {
    student: r.one.student({
      from: r.grade.studentId,
      to: r.student.id,
    }),
    subject: r.one.subject({
      from: r.grade.subjectId,
      to: r.subject.id,
    }),
  },

  yearConfirmation: {
    confirmedByTeacher: r.one.fullTimeTeacher({
      from: r.yearConfirmation.confirmedBy,
      to: r.fullTimeTeacher.id,
    }),
  },
}));