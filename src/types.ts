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

/** 이전 버전의 '요일별 마지막 교시' 입력과 호환하기 위한 타입입니다. */
export type DayEndPeriods = Record<Day, number>;
/** 요일마다 외부강의를 넣을 수 있는 교시를 개별적으로 선택합니다. */
export type DayPeriodSelection = Record<Day, number[]>;
export type DayPeriodInput = DayPeriodSelection | DayEndPeriods;

export function normalizeDayPeriodSelection(input: DayPeriodInput): DayPeriodSelection {
  return DAYS.reduce((result, day) => {
    const value = input[day];
    result[day] = Array.isArray(value)
      ? [...new Set(value)].filter((period) => period >= 1 && period <= PERIODS.length).sort((a, b) => a - b)
      : PERIODS.filter((period) => period <= Math.max(0, Math.min(PERIODS.length, value)));
    return result;
  }, {} as DayPeriodSelection);
}

export type Assignment = ClassInfo & {
  day: Day;
  periods: number[];
};

export type ScheduleResult =
  | { ok: true; solutions: Assignment[][]; truncated: boolean }
  | { ok: false; message: string; blockedClasses: ClassInfo[] };
