export function gridFromClipboard(html: string, plainText: string): string[][] {
  if (html.trim()) {
    const parsed = gridFromHtml(html);
    if (parsed.length > 0) return parsed;
  }

  return gridFromText(plainText);
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
