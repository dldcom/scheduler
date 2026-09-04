import { describe, expect, it } from "vitest";
import { GUIDE_STEPS } from "./GuideTour";

describe("GuideTour steps", () => {
  it("provides the three-step main workflow guide", () => {
    expect(GUIDE_STEPS).toHaveLength(3);
    expect(GUIDE_STEPS.map((step) => step.target)).toEqual([
      "timetable-input",
      "day-periods",
      "lecture-config",
    ]);
    expect(GUIDE_STEPS.map((step) => step.label)).toEqual(["1 / 3", "2 / 3", "3 / 3"]);
    expect(GUIDE_STEPS[0].showCopyExample).toBe(true);
    expect(GUIDE_STEPS[2].action).toBe("confirm");
  });
});
