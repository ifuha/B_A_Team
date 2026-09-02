// src/lib/pdf-report.ts
import PDFDocument from "pdfkit";
import path from "path";
import type { FinalRank } from "@/src/lib/grade-calculator";

const FONT_REGULAR = path.join(
  process.cwd(),
  "src/assets/fonts/NotoSansCJKjp-Regular.woff",
);
const FONT_BOLD = path.join(
  process.cwd(),
  "src/assets/fonts/NotoSansCJKjp-Bold.woff",
);

const FINAL_RANK_LABEL: Record<FinalRank, string> = {
  excellent: "秀",
  very_good: "優",
  good: "良",
  pass: "可",
  fail: "不可",
};

const STUDENT_STATUS_LABEL: Record<string, string> = {
  enrolled: "在学",
  leave: "休学",
  withdrawn: "退学",
  graduated: "卒業済み",
};

type Column = { label: string; width: number };

function createDoc() {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.registerFont("NotoSansJP", FONT_REGULAR);
  doc.registerFont("NotoSansJP-Bold", FONT_BOLD);
  return doc;
}

function docToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function drawRow(
  doc: PDFKit.PDFDocument,
  y: number,
  columns: Column[],
  cells: string[],
  options: { bold?: boolean; highlight?: boolean } = {},
) {
  const rowHeight = 18;
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);

  if (options.highlight) {
    doc
      .rect(doc.page.margins.left, y - 3, tableWidth, rowHeight)
      .fill("#fde2e2");
    doc.fillColor("black");
  }

  doc.font(options.bold ? "NotoSansJP-Bold" : "NotoSansJP").fontSize(9);
  let x = doc.page.margins.left;
  columns.forEach((col, i) => {
    doc.text(cells[i] ?? "-", x, y, { width: col.width, ellipsis: true });
    x += col.width;
  });
}

function ensurePageSpace(doc: PDFKit.PDFDocument, y: number): number {
  if (y > doc.page.height - doc.page.margins.bottom - 20) {
    doc.addPage();
    return doc.page.margins.top;
  }
  return y;
}

export type SubjectReportRow = {
  studentName: string;
  studentNumber: string;
  majorName: string;
  attendanceRate: number | null;
  attitudeClass: number | null;
  homeworkEvaluation: number | null;
  finalRank: FinalRank | null;
  isIncomplete: boolean;
};

/* 4.10 科目別成績表 PDF */
export async function generateSubjectReportPdf(
  subjectName: string,
  rows: SubjectReportRow[],
  highlightIssues: boolean,
): Promise<Buffer> {
  const doc = createDoc();

  doc.font("NotoSansJP-Bold").fontSize(16).text(`科目別成績表: ${subjectName}`);
  doc
    .font("NotoSansJP")
    .fontSize(9)
    .fillColor("gray")
    .text(`出力日: ${new Date().toISOString().slice(0, 10)}`);
  doc.fillColor("black");
  doc.moveDown(1);

  const columns: Column[] = [
    { label: "学籍番号", width: 80 },
    { label: "生徒名", width: 90 },
    { label: "専攻", width: 90 },
    { label: "出席率", width: 55 },
    { label: "授業態度", width: 55 },
    { label: "課題評価", width: 55 },
    { label: "成績結果", width: 55 },
  ];

  let y = doc.y;
  drawRow(
    doc,
    y,
    columns,
    columns.map((c) => c.label),
    { bold: true },
  );
  y += 18;
  doc
    .moveTo(doc.page.margins.left, y - 4)
    .lineTo(doc.page.width - doc.page.margins.right, y - 4)
    .stroke();

  for (const row of rows) {
    y = ensurePageSpace(doc, y);
    const highlight =
      highlightIssues && (row.isIncomplete || row.finalRank === "fail");
    drawRow(
      doc,
      y,
      columns,
      [
        row.studentNumber,
        row.studentName,
        row.majorName,
        row.attendanceRate?.toString() ?? "-",
        row.attitudeClass?.toString() ?? "-",
        row.homeworkEvaluation?.toString() ?? "-",
        row.finalRank ? FINAL_RANK_LABEL[row.finalRank] : "-",
      ],
      { highlight },
    );
    y += 18;
  }

  if (rows.length === 0) {
    doc.font("NotoSansJP").fontSize(10).text("対象データがありません", doc.page.margins.left, y);
  }

  return docToBuffer(doc);
}

export type StudentReportRow = {
  subjectName: string;
  year: number;
  term: number;
  attendanceRate: number | null;
  attitudeClass: number | null;
  homeworkEvaluation: number | null;
  finalRank: FinalRank | null;
  isIncomplete: boolean;
};

/* 4.11 個人別成績表 PDF */
export async function generateStudentReportPdf(
  student: {
    name: string;
    studentNumber: string;
    majorName: string;
    status: string;
  },
  rows: StudentReportRow[],
  highlightIssues: boolean,
): Promise<Buffer> {
  const doc = createDoc();

  doc.font("NotoSansJP-Bold").fontSize(16).text("個人別成績表");
  doc
    .font("NotoSansJP")
    .fontSize(9)
    .fillColor("gray")
    .text(`出力日: ${new Date().toISOString().slice(0, 10)}`);
  doc.fillColor("black");
  doc.moveDown(0.5);

  doc
    .font("NotoSansJP")
    .fontSize(11)
    .text(
      `氏名: ${student.name}　　学籍番号: ${student.studentNumber}　　専攻: ${student.majorName}　　在学ステータス: ${
        STUDENT_STATUS_LABEL[student.status] ?? student.status
      }`,
    );
  doc.moveDown(1);

  const columns: Column[] = [
    { label: "年度", width: 45 },
    { label: "学期", width: 40 },
    { label: "科目名", width: 110 },
    { label: "出席率", width: 55 },
    { label: "授業態度", width: 55 },
    { label: "課題評価", width: 55 },
    { label: "成績結果", width: 55 },
  ];

  let y = doc.y;
  drawRow(
    doc,
    y,
    columns,
    columns.map((c) => c.label),
    { bold: true },
  );
  y += 18;
  doc
    .moveTo(doc.page.margins.left, y - 4)
    .lineTo(doc.page.width - doc.page.margins.right, y - 4)
    .stroke();

  for (const row of rows) {
    y = ensurePageSpace(doc, y);
    const highlight =
      highlightIssues && (row.isIncomplete || row.finalRank === "fail");
    drawRow(
      doc,
      y,
      columns,
      [
        row.year.toString(),
        row.term.toString(),
        row.subjectName,
        row.attendanceRate?.toString() ?? "-",
        row.attitudeClass?.toString() ?? "-",
        row.homeworkEvaluation?.toString() ?? "-",
        row.finalRank ? FINAL_RANK_LABEL[row.finalRank] : "-",
      ],
      { highlight },
    );
    y += 18;
  }

  if (rows.length === 0) {
    doc.font("NotoSansJP").fontSize(10).text("対象データがありません", doc.page.margins.left, y);
  }

  return docToBuffer(doc);
}
