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

const TERM_LABEL: Record<number, string> = { 1: "前期", 2: "後期" };
const GRADE_COLUMN_WIDTH = 158;
const GRADE_COLUMN_GAP = 8;
const GRADE_COLUMNS_PER_ROW = 3;
const ENTRY_HEIGHT = 34;
const ENTRY_GAP = 4;

function drawGradeLevelEntry(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  entry: StudentReportRow,
  highlight: boolean,
) {
  if (highlight) {
    doc.rect(x, y, width, ENTRY_HEIGHT).fill("#fde2e2");
    doc.fillColor("black");
  } else {
    doc.rect(x, y, width, ENTRY_HEIGHT).stroke("#d0d0d0");
  }

  doc.font("NotoSansJP").fontSize(8);
  const half = width / 2;
  doc.text(entry.subjectName, x + 4, y + 4, { width: half - 6, ellipsis: true });
  doc.text(TERM_LABEL[entry.term] ?? String(entry.term), x + half, y + 4, {
    width: half - 6,
    align: "right",
  });

  doc
    .moveTo(x, y + 17)
    .lineTo(x + width, y + 17)
    .stroke("#d0d0d0");

  const third = width / 3;
  const rank = entry.finalRank ? FINAL_RANK_LABEL[entry.finalRank] : "-";
  doc.text(
    `出席率 ${entry.attendanceRate ?? "-"}%`,
    x + 4,
    y + 21,
    { width: third, ellipsis: true },
  );
  doc.text(`態度 ${entry.attitudeClass ?? "-"}`, x + third, y + 21, {
    width: third,
  });
  doc.text(rank, x + third * 2, y + 21, { width: third - 6, align: "right" });
}

export type StudentInfo = {
  name: string;
  studentNumber: string;
  majorName: string;
  status: string;
  gradeLevel: number;
};

/* 個人別成績表1名分のブロックを現在のdoc.y位置に描画する */
function drawStudentReportBlock(
  doc: PDFKit.PDFDocument,
  student: StudentInfo,
  gradeYears: Record<number, StudentReportRow[]>,
  highlightIssues: boolean,
) {
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
      `氏名: ${student.name}　　学籍番号: ${student.studentNumber}　　専攻: ${student.majorName}　　学年: ${student.gradeLevel}年生　　在学ステータス: ${
        STUDENT_STATUS_LABEL[student.status] ?? student.status
      }`,
    );
  doc.moveDown(1);

  const levels = Object.keys(gradeYears)
    .map(Number)
    .sort((a, b) => a - b);

  if (levels.length === 0) {
    doc
      .font("NotoSansJP")
      .fontSize(10)
      .text("対象データがありません", doc.page.margins.left, doc.y);
    return;
  }

  for (let rowStart = 0; rowStart < levels.length; rowStart += GRADE_COLUMNS_PER_ROW) {
    const rowLevels = levels.slice(rowStart, rowStart + GRADE_COLUMNS_PER_ROW);
    const headerY = ensurePageSpace(doc, doc.y);
    let x = doc.page.margins.left;
    const columnYs: number[] = [];

    for (const level of rowLevels) {
      doc
        .font("NotoSansJP-Bold")
        .fontSize(10)
        .text(`${level}年次`, x, headerY, { width: GRADE_COLUMN_WIDTH });
      columnYs.push(headerY + 16);
      x += GRADE_COLUMN_WIDTH + GRADE_COLUMN_GAP;
    }

    let maxY = Math.max(...columnYs);
    let colIndex = 0;
    x = doc.page.margins.left;
    for (const level of rowLevels) {
      let y = columnYs[colIndex];
      for (const entry of gradeYears[level]) {
        if (y > doc.page.height - doc.page.margins.bottom - ENTRY_HEIGHT) {
          doc.addPage();
          y = doc.page.margins.top;
        }
        const highlight =
          highlightIssues &&
          (entry.isIncomplete || entry.finalRank === "fail");
        drawGradeLevelEntry(doc, x, y, GRADE_COLUMN_WIDTH, entry, highlight);
        y += ENTRY_HEIGHT + ENTRY_GAP;
      }
      maxY = Math.max(maxY, y);
      x += GRADE_COLUMN_WIDTH + GRADE_COLUMN_GAP;
      colIndex++;
    }

    doc.y = maxY + 12;
  }
}

/* 4.11 個人別成績表 PDF(学年/年次ごとに列分けして表示、1名分) */
export async function generateStudentReportPdf(
  student: StudentInfo,
  gradeYears: Record<number, StudentReportRow[]>,
  highlightIssues: boolean,
): Promise<Buffer> {
  const doc = createDoc();
  drawStudentReportBlock(doc, student, gradeYears, highlightIssues);
  return docToBuffer(doc);
}

/* 4.11 個人別成績表 PDF(全生徒分、1名1ページ) */
export async function generateAllStudentsReportPdf(
  students: {
    student: StudentInfo;
    gradeYears: Record<number, StudentReportRow[]>;
  }[],
  highlightIssues: boolean,
): Promise<Buffer> {
  const doc = createDoc();

  if (students.length === 0) {
    doc
      .font("NotoSansJP")
      .fontSize(10)
      .text("対象データがありません", doc.page.margins.left, doc.y);
    return docToBuffer(doc);
  }

  students.forEach(({ student, gradeYears }, i) => {
    if (i > 0) doc.addPage();
    drawStudentReportBlock(doc, student, gradeYears, highlightIssues);
  });

  return docToBuffer(doc);
}
