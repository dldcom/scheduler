import { describe, expect, it } from "vitest";
import { consolidateLessons, parseLessonCell, parseTimetableGrid } from "./parser";

describe("parseLessonCell", () => {
  it("학년-반과 과목을 추출한다", () => {
    expect(parseLessonCell("4-5 영어")).toEqual([
      { grade: 4, classNumber: 5, subject: "영어" },
    ]);
  });

  it("한 셀의 여러 반과 학년/반 표기를 추출한다", () => {
    expect(parseLessonCell("4-1 영어\n4-6 체육\n5학년 2반 음악")).toEqual([
      { grade: 4, classNumber: 1, subject: "영어" },
      { grade: 4, classNumber: 6, subject: "체육" },
      { grade: 5, classNumber: 2, subject: "음악" },
    ]);
  });
});

describe("parseTimetableGrid", () => {
  it("요일과 교시 위치를 이용해 전담시간을 만든다", () => {
    const rows = [
      ["", "월", "화", "수", "목", "금"],
      ["1교시 9:00~9:40", "", "4-7 체육", "4-1 체육", "4-5 체육", "4-4 체육"],
      ["2교시 9:50~10:30", "4-5 영어", "4-1 영어\n4-6 체육", "4-2 체육", "", ""],
    ];
    const parsed = parseTimetableGrid(rows, "source-1");
    expect(parsed.warnings).toHaveLength(0);
    expect(parsed.lessons).toHaveLength(8);
    expect(parsed.lessons).toContainEqual({
      grade: 4,
      classNumber: 6,
      subject: "체육",
      day: "화",
      period: 2,
      sourceTableId: "source-1",
    });
  });
});

describe("consolidateLessons", () => {
  it("같은 반의 같은 시간을 합치고 과목 사유를 보존한다", () => {
    const common = { grade: 4, classNumber: 1, day: "월" as const, period: 1 };
    const consolidated = consolidateLessons([
      { ...common, subject: "영어", sourceTableId: "a" },
      { ...common, subject: "체육", sourceTableId: "b" },
    ]);
    expect(consolidated).toEqual([
      { ...common, subject: "영어 · 체육", sourceTableId: "a,b" },
    ]);
  });
});
