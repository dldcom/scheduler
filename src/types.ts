export const DAYS = ["월", "화", "수", "목", "금"] as const;
export const PERIODS = [1, 2, 3, 4, 5, 6] as const;

export type Day = (typeof DAYS)[number];

export type Lesson = {
  grade: number;
  classNumber: number;
  subject: string;
  day: Day;
  period: number;
  sourceTableId: string;
};

export type ParseWarning = {
  row: number;
  column: number;
  value: string;
  message: string;
};

export type ParsedTable = {
  lessons: Lesson[];
  warnings: ParseWarning[];
  detectedDays: Day[];
  detectedPeriods: number[];
};

export type SourceTable = {
  id: string;
  name: string;
  rows: string[][];
  parsed: ParsedTable;
};

export type ClassInfo = {
  grade: number;
  classNumber: number;
};

export type LectureDuration = 1 | 2 | 3 | 4;

export type DayEndPeriods = Record<Day, number>;

export type Assignment = ClassInfo & {
  day: Day;
  periods: number[];
};

export type ScheduleResult =
  | { ok: true; solutions: Assignment[][]; truncated: boolean }
  | { ok: false; message: string; blockedClasses: ClassInfo[] };
