import { DAYS, PERIODS, type Assignment, type DayEndPeriods } from "../types";

export function gridFromClipboard(html: string, plainText: string): string[][] {
  if (html.trim()) {
    const parsed = gridFromHtml(html);
    if (parsed.length > 0) return parsed;
  }

  return gridFromText(plainText);
}

export function scheduleToClipboardFormats(
  assignments: Assignment[],
  dayEndPeriods: DayEndPeriods,
): { html: string; text: string } {
  const lastUsedPeriod = Math.max(...Object.values(dayEndPeriods));
  const rows = [
    ["교시", ...DAYS],
    ...PERIODS.filter((period) => period <= lastUsedPeriod).map((period) => [
      `${period}교시`,
      ...DAYS.map((day) => {
        if (period > dayEndPeriods[day]) return "";
        return assignments
          .filter((assignment) => assignment.day === day && assignment.periods.includes(period))
          .sort((a, b) => a.grade - b.grade || a.classNumber - b.classNumber)
          .map((assignment) => `${assignment.grade}-${assignment.classNumber}`)
          .join(" / ");
      }),
    ]),
  ];

  const text = rows.map((row) => row.join("\t")).join("\n");
  const htmlRows = rows.map((row, rowIndex) => {
    const tag = rowIndex === 0 ? "th" : "td";
    return `<tr>${row.map((cell) => `<${tag} style="border:1px solid #9ca3af;padding:8px 12px;text-align:center;white-space:pre-wrap;">${escapeHtml(cell)}</${tag}>`).join("")}</tr>`;
  }).join("");
  const html = `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12pt;"><tbody>${htmlRows}</tbody></table>`;

  return { html, text };
}

export async function copyHtmlAndText(html: string, text: string): Promise<void> {
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return;
    } catch {
      // 일부 브라우저는 HTML MIME 복사를 지원하지 않아 일반 텍스트로 다시 시도한다.
    }
  }

  await navigator.clipboard.writeText(text);
}

export function createBlankTimetableGrid(): string[][] {
  return [
    ["", "월", "화", "수", "목", "금"],
    ...Array.from({ length: 6 }, (_, index) => [
      `${index + 1}교시`,
      "",
      "",
      "",
      "",
      "",
    ]),
  ];
}

export function gridFromHtml(html: string): string[][] {
  const document = new DOMParser().parseFromString(html, "text/html");
  const table = document.querySelector("table");
  if (!table) return [];

  const grid: string[][] = [];
  const occupied = new Set<string>();

  Array.from(table.rows).forEach((row, rowIndex) => {
    grid[rowIndex] ??= [];
    let columnIndex = 0;

    Array.from(row.cells).forEach((cell) => {
      while (occupied.has(`${rowIndex}:${columnIndex}`)) columnIndex += 1;

      const rowSpan = Math.max(1, cell.rowSpan || 1);
      const columnSpan = Math.max(1, cell.colSpan || 1);
      const value = normalizeCellText(cell.innerText || cell.textContent || "");

      for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
        const targetRow = rowIndex + rowOffset;
        grid[targetRow] ??= [];
        for (let columnOffset = 0; columnOffset < columnSpan; columnOffset += 1) {
          const targetColumn = columnIndex + columnOffset;
          occupied.add(`${targetRow}:${targetColumn}`);
          grid[targetRow][targetColumn] = rowOffset === 0 && columnOffset === 0 ? value : "";
        }
      }

      columnIndex += columnSpan;
    });
  });

  return rectangularize(grid);
}

export function gridFromText(text: string): string[][] {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];

  const rows = normalized.split("\n").map((line) =>
    line.split("\t").map(normalizeCellText),
  );

  return rectangularize(rows);
}

function normalizeCellText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function rectangularize(rows: string[][]): string[][] {
  const width = Math.max(0, ...rows.map((row) => row.length));
  return rows.map((row) =>
    Array.from({ length: width }, (_, index) => row[index] ?? ""),
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
