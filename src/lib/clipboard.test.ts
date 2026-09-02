import { describe, expect, it } from "vitest";
import { scheduleToClipboardFormats } from "./clipboard";
import type { Assignment, DayEndPeriods } from "../types";

describe("scheduleToClipboardFormats", () => {
  it("현재 편성안을 엑셀과 한글에서 붙여넣을 수 있는 표로 만든다", () => {
    const assignments: Assignment[] = [
      { grade: 4, classNumber: 1, day: "월", periods: [1, 2] },
      { grade: 4, classNumber: 2, day: "월", periods: [1, 2] },
    ];
    const dayEndPeriods: DayEndPeriods = { "월": 5, "화": 5, "수": 5, "목": 5, "금": 5 };
    const formats = scheduleToClipboardFormats(assignments, dayEndPeriods);

    expect(formats.text.split("\n")[0]).toBe("교시\t월\t화\t수\t목\t금");
    expect(formats.text).toContain("1교시\t4-1 / 4-2");
    expect(formats.text).toContain("2교시\t4-1 / 4-2");
    expect(formats.text).not.toContain("6교시");
    expect(formats.html).toContain("<table");
    expect(formats.html).toContain("4-1 / 4-2");
  });
});
