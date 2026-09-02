import { describe, expect, it } from "vitest";
import { createSchedule, getAllowedPeriodBlocks, getClasses } from "./scheduler";
import { parseTimetableGrid } from "./parser";
import type { Lesson } from "../types";

function lesson(classNumber: number, day: Lesson["day"], period: number): Lesson {
  return { grade: 4, classNumber, day, period, subject: "전담", sourceTableId: "test" };
}

describe("getAllowedPeriodBlocks", () => {
  it("2교시 강의는 지정된 블록만 사용한다", () => {
    expect(getAllowedPeriodBlocks(2)).toEqual([[1, 2], [3, 4], [5, 6]]);
  });
});

describe("getClasses", () => {
  it("가장 큰 반 번호까지 중간 반을 포함한다", () => {
    expect(getClasses([lesson(1, "월", 1), lesson(4, "화", 2)], 4)).toEqual([
      { grade: 4, classNumber: 1 },
      { grade: 4, classNumber: 2 },
      { grade: 4, classNumber: 3 },
      { grade: 4, classNumber: 4 },
    ]);
  });
});

describe("createSchedule", () => {
  it("전담시간과 겹치지 않고 동시 수업 제한을 지킨다", () => {
    const lessons = [lesson(1, "월", 1), lesson(2, "월", 3), lesson(3, "화", 1)];
    const result = createSchedule(lessons, 4, 2, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const assignments = result.solutions[0];
    expect(assignments).toHaveLength(3);
    const used = new Set<string>();
    assignments.forEach((assignment) => {
      assignment.periods.forEach((period) => {
        const key = `${assignment.day}:${period}`;
        expect(used.has(key)).toBe(false);
        used.add(key);
        expect(lessons.some((item) =>
          item.classNumber === assignment.classNumber && item.day === assignment.day && item.period === period,
        )).toBe(false);
      });
    });
  });

  it("제공된 4학년 전담 시간표를 읽어 7개 반을 편성한다", () => {
    const rows = [
      ["", "월", "화", "수", "목", "금"],
      ["1교시\n9:00~9:40", "", "4-7 체육", "4-1 체육", "4-5 체육", "4-4 체육"],
      ["2교시\n9:50~10:30", "4-5 영어", "4-1 영어\n4-6 체육", "4-2 체육", "4-3 영어\n4-6 체육", "4-7 영어\n4-3 체육"],
      ["3교시\n10:40~11:20", "4-6 영어", "4-2 영어\n4-5 체육", "4-3 체육", "4-2 영어\n4-7 체육", "4-6 영어\n4-2 체육"],
      ["4교시\n11:30~12:10", "4-7 영어", "4-3 영어", "4-4 체육", "4-1 영어", "4-5 영어\n4-1 체육"],
      ["5교시\n12:20~13:00", "4-4 영어", "4-4 영어", "", "", ""],
      ["6교시\n13:50~14:30", "", "", "", "", ""],
    ];
    const parsed = parseTimetableGrid(rows, "image-sample");
    expect(parsed.lessons).toHaveLength(28);

    const result = createSchedule(parsed.lessons, 4, 2, 1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.solutions[0]).toHaveLength(7);
  });

  it("요일별 마지막 교시 이후에는 배정하지 않는다", () => {
    const lessons = [lesson(1, "월", 1), lesson(2, "화", 1), lesson(3, "수", 1)];
    const dayEndPeriods = { "월": 5, "화": 5, "수": 5, "목": 5, "금": 5 } as const;
    const result = createSchedule(lessons, 4, 2, 1, dayEndPeriods);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.solutions[0].forEach((assignment) => {
      expect(Math.max(...assignment.periods)).toBeLessThanOrEqual(dayEndPeriods[assignment.day]);
      expect(assignment.periods).not.toContain(6);
    });
  });

  it("가능한 편성안을 여러 개 반환한다", () => {
    const lessons = [lesson(1, "금", 1)];
    const dayEndPeriods = { "월": 4, "화": 0, "수": 0, "목": 0, "금": 0 } as const;
    const result = createSchedule(lessons, 4, 2, 1, dayEndPeriods);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.solutions).toHaveLength(2);
    expect(result.solutions.map((solution) => solution[0].periods)).toEqual([[1, 2], [3, 4]]);
    expect(result.truncated).toBe(false);
  });

  it("경우의 수가 많으면 100개에서 안전하게 제한한다", () => {
    const lessons = [lesson(1, "월", 6), lesson(2, "화", 6), lesson(3, "수", 6)];
    const dayEndPeriods = { "월": 4, "화": 4, "수": 4, "목": 4, "금": 4 } as const;
    const result = createSchedule(lessons, 4, 1, 1, dayEndPeriods);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.solutions).toHaveLength(100);
    expect(result.truncated).toBe(true);
  });

  it("선택한 반 수를 최대치가 아니라 정확한 묶음 크기로 적용한다", () => {
    const lessons = [
      lesson(1, "월", 6),
      lesson(2, "화", 6),
      lesson(3, "수", 6),
      lesson(4, "목", 6),
    ];
    const dayEndPeriods = { "월": 2, "화": 2, "수": 0, "목": 0, "금": 0 } as const;
    const result = createSchedule(lessons, 4, 1, 2, dayEndPeriods);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.solutions.forEach((solution) => {
      const counts = new Map<string, number>();
      solution.forEach((assignment) => {
        const key = `${assignment.day}:${assignment.periods.join("-")}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
      expect([...counts.values()].every((count) => count === 2)).toBe(true);
    });
  });

  it("홀수 개 반은 두 반씩 묶고 남은 한 반을 단독 배정한다", () => {
    const lessons = [lesson(1, "월", 6), lesson(2, "화", 6), lesson(3, "수", 6)];
    const dayEndPeriods = { "월": 2, "화": 2, "수": 0, "목": 0, "금": 0 } as const;
    const result = createSchedule(lessons, 4, 1, 2, dayEndPeriods);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.solutions.forEach((solution) => {
      const counts = new Map<string, number>();
      solution.forEach((assignment) => {
        const key = `${assignment.day}:${assignment.periods.join("-")}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
      expect([...counts.values()].sort()).toEqual([1, 2]);
    });
  });
});
