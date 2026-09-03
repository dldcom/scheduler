import { describe, expect, it } from "vitest";
import { scheduleToClipboardFormats } from "./clipboard";
import type { Assignment, DayEndPeriods, DayPeriodSelection } from "../types";

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
    expect(formats.html).toContain("table-layout:fixed");
    expect(formats.html).toContain("mso-number-format:'@'");
    expect(formats.html).toContain("4-1 / 4-2");
  });

  it("개별 선택하지 않은 교시는 빈 칸으로 내보낸다", () => {
    const assignments: Assignment[] = [
      { grade: 4, classNumber: 1, day: "월", periods: [1] },
      { grade: 4, classNumber: 2, day: "월", periods: [3] },
    ];
    const dayPeriods: DayPeriodSelection = { "월": [1, 3], "화": [], "수": [], "목": [], "금": [] };
    const formats = scheduleToClipboardFormats(assignments, dayPeriods);
    const rows = formats.text.split("\n");

    expect(rows[1]).toBe("1교시\t4-1\t\t\t\t");
    expect(rows[2]).toBe("2교시\t\t\t\t\t");
    expect(rows[3]).toBe("3교시\t4-2\t\t\t\t");
  });
});
