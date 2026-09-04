import { describe, expect, it } from "vitest";
import { buildConsolidatedTimetable } from "./preview";
import type { Lesson } from "../types";

function lesson(
  classNumber: number,
  day: Lesson["day"],
  period: number,
  subject: string,
  sourceTableId: string,
): Lesson {
  return { grade: 4, classNumber, day, period, subject, sourceTableId };
}

describe("buildConsolidatedTimetable", () => {
  it("여러 전담 시간표에서 인식한 반과 과목을 하나의 시간표에 모은다", () => {
    const rows = buildConsolidatedTimetable([
      lesson(2, "월", 1, "체육", "source-b"),
      lesson(1, "월", 1, "영어", "source-a"),
      lesson(3, "화", 2, "음악", "source-c"),
    ]);

    expect(rows[0].period).toBe(1);
    expect(rows[0].cells["월"]).toEqual([
      { grade: 4, classNumber: 1, subject: "영어" },
      { grade: 4, classNumber: 2, subject: "체육" },
    ]);
    expect(rows[0].cells["화"]).toEqual([]);
    expect(rows[1].cells["화"]).toEqual([
      { grade: 4, classNumber: 3, subject: "음악" },
    ]);
  });
});
