import { DAYS, PERIODS, type Day, type Lesson } from "../types";

export type PreviewLesson = Pick<Lesson, "grade" | "classNumber" | "subject">;

export type ConsolidatedPreviewRow = {
  period: number;
  cells: Record<Day, PreviewLesson[]>;
};

export function buildConsolidatedTimetable(lessons: Lesson[]): ConsolidatedPreviewRow[] {
  return PERIODS.map((period) => ({
    period,
    cells: DAYS.reduce((cells, day) => {
      cells[day] = lessons
        .filter((lesson) => lesson.day === day && lesson.period === period)
        .sort((a, b) => a.grade - b.grade || a.classNumber - b.classNumber)
        .map(({ grade, classNumber, subject }) => ({ grade, classNumber, subject }));
      return cells;
    }, {} as Record<Day, PreviewLesson[]>),
  }));
}
