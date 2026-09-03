export type SavedSourceTable = {
  name: string;
  rows: string[][];
};

export type SavedTimetable = {
  id: string;
  name: string;
  savedAt: number;
  sources: SavedSourceTable[];
};

export const SAVED_TIMETABLES_KEY = "external-lecture-scheduler:saved-timetables:v1";

export function readSavedTimetables(): SavedTimetable[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(SAVED_TIMETABLES_KEY);
    if (!raw) return [];
    return parseSavedTimetables(raw);
  } catch {
    return [];
  }
}

export function writeSavedTimetables(items: SavedTimetable[]): boolean {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.setItem(SAVED_TIMETABLES_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function parseSavedTimetables(raw: string): SavedTimetable[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];

    return value.flatMap((item, index) => {
      if (!isRecord(item)) return [];
      const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : `전담 시간표 ${index + 1}`;
      const sources = parseSources(item.sources);
      if (sources.length === 0) return [];

      return [{
        id: typeof item.id === "string" && item.id ? item.id : `saved-${Date.now()}-${index}`,
        name,
        savedAt: typeof item.savedAt === "number" && Number.isFinite(item.savedAt) ? item.savedAt : Date.now(),
        sources,
      }];
    });
  } catch {
    return [];
  }
}

function parseSources(value: unknown): SavedSourceTable[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item) || !Array.isArray(item.rows)) return [];
    const rows = item.rows.flatMap((row) => {
      if (!Array.isArray(row)) return [];
      return [row.map((cell) => typeof cell === "string" ? cell : cell == null ? "" : String(cell))];
    });
    if (rows.length === 0 || rows.every((row) => row.length === 0)) return [];

    return [{
      name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : "전담 시간표",
      rows,
    }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
