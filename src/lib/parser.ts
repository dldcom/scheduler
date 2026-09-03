import { DAYS, type Day, type Lesson, type ParsedTable } from "../types";

const DAY_PATTERN = /^(월|화|수|목|금)(?:요일)?$/;
const PERIOD_PATTERN = /(?:^|\s)([1-6])\s*교시/;
const CLASS_PATTERN = /(?:(\d+)\s*[-–—]\s*(\d+)|(\d+)\s*학년\s*(\d+)\s*반)\s*([^0-9]*?)(?=(?:\d+\s*[-–—]\s*\d+|\d+\s*학년\s*\d+\s*반)|$)/g;

export function parseTimetableGrid(rows: string[][], sourceTableId: string): ParsedTable {
  const warnings: ParsedTable["warnings"] = [];
  const lessons: Lesson[] = [];
  const header = findDayHeader(rows);

  if (!header) {
    return {
      lessons,
      warnings: [{ row: 0, column: 0, value: "", message: "요일(월~금)을 찾지 못했어요." }],
      detectedDays: [],
      detectedPeriods: [],
    };
  }

  const detectedPeriods = new Set<number>();

  rows.forEach((row, rowIndex) => {
    if (rowIndex === header.rowIndex) return;
    const period = findPeriod(row);
    if (!period) return;
    detectedPeriods.add(period);

    header.columns.forEach(({ day, columnIndex }) => {
      const value = row[columnIndex]?.trim() ?? "";
      if (!value) return;

      const parsedLessons = parseLessonCell(value);
      if (parsedLessons.length === 0) {
        warnings.push({
          row: rowIndex,
          column: columnIndex,
          value,
          message: "‘4-1’처럼 학년과 반을 적어 주세요.",
        });
        return;
      }

      parsedLessons.forEach((parsed) => {
        lessons.push({ ...parsed, day, period, sourceTableId });
      });
    });
  });

  if (detectedPeriods.size === 0) {
    warnings.push({ row: 0, column: 0, value: "", message: "교시를 찾지 못했어요." });
  }

  return {
    lessons,
    warnings,
    detectedDays: header.columns.map((item) => item.day),
    detectedPeriods: [...detectedPeriods].sort((a, b) => a - b),
  };
}

export function parseLessonCell(value: string): Array<Pick<Lesson, "grade" | "classNumber" | "subject">> {
  const normalized = value
    .replace(/\r\n?/g, "\n")
    .replace(/[•·]/g, " ")
    .replace(/\n+/g, " ")
    .trim();

  const matches: Array<Pick<Lesson, "grade" | "classNumber" | "subject">> = [];
  CLASS_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CLASS_PATTERN.exec(normalized)) !== null) {
    const grade = Number(match[1] ?? match[3]);
    const classNumber = Number(match[2] ?? match[4]);
    const subject = cleanSubject(match[5]);

    if (grade > 0 && classNumber > 0) {
      matches.push({ grade, classNumber, subject });
    }
  }

  return matches;
}

export function consolidateLessons(lessons: Lesson[]): Lesson[] {
  const consolidated = new Map<string, Lesson>();

  lessons.forEach((lesson) => {
    const key = `${lesson.grade}:${lesson.classNumber}:${lesson.day}:${lesson.period}`;
    const existing = consolidated.get(key);
    if (!existing) {
      consolidated.set(key, { ...lesson });
      return;
    }

    const subjects = new Set(
      `${existing.subject} · ${lesson.subject}`
        .split(" · ")
        .map((subject) => subject.trim())
        .filter(Boolean),
    );
    const sourceIds = new Set(`${existing.sourceTableId},${lesson.sourceTableId}`.split(","));
    consolidated.set(key, {
      ...existing,
      subject: [...subjects].join(" · "),
      sourceTableId: [...sourceIds].join(","),
    });
  });

  return [...consolidated.values()];
}

function cleanSubject(value: string | undefined): string {
  const subject = (value ?? "")
    .replace(/^[\s,;/]+|[\s,;/]+$/g, "")
    .replace(/\s+/g, " ");
  return subject || "전담 수업";
}

function findDayHeader(rows: string[][]): {
  rowIndex: number;
  columns: Array<{ day: Day; columnIndex: number }>;
} | null {
  let best: { rowIndex: number; columns: Array<{ day: Day; columnIndex: number }> } | null = null;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const columns = row.flatMap((value, columnIndex) => {
      const match = value.trim().match(DAY_PATTERN);
      return match && DAYS.includes(match[1] as Day)
        ? [{ day: match[1] as Day, columnIndex }]
        : [];
    });

    if (!best || columns.length > best.columns.length) best = { rowIndex, columns };
  }

  return best && best.columns.length >= 2 ? best : null;
}

function findPeriod(row: string[]): number | null {
  for (const value of row) {
    const match = value.match(PERIOD_PATTERN);
    if (match) return Number(match[1]);
  }
  return null;
}
