import {
  DAYS,
  PERIODS,
  type Assignment,
  type ClassInfo,
  type Day,
  type DayEndPeriods,
  type LectureDuration,
  type Lesson,
  type ScheduleResult,
} from "../types";

type Candidate = { day: Day; periods: number[] };
const MAX_SOLUTIONS = 100;
const MAX_SEARCH_NODES = 250_000;

export function getClasses(lessons: Lesson[], grade?: number): ClassInfo[] {
  const maximumClassByGrade = new Map<number, number>();
  lessons.forEach(({ grade: lessonGrade, classNumber }) => {
    if (grade !== undefined && lessonGrade !== grade) return;
    maximumClassByGrade.set(
      lessonGrade,
      Math.max(maximumClassByGrade.get(lessonGrade) ?? 0, classNumber),
    );
  });

  return [...maximumClassByGrade.entries()]
    .sort(([gradeA], [gradeB]) => gradeA - gradeB)
    .flatMap(([lessonGrade, maximumClass]) =>
      Array.from({ length: maximumClass }, (_, index) => ({
        grade: lessonGrade,
        classNumber: index + 1,
      })),
    );
}

export function getAllowedPeriodBlocks(duration: LectureDuration): number[][] {
  if (duration === 1) return PERIODS.map((period) => [period]);
  if (duration === 2) return [[1, 2], [3, 4], [5, 6]];

  const blocks: number[][] = [];
  for (let start = 1; start + duration - 1 <= 6; start += 1) {
    blocks.push(Array.from({ length: duration }, (_, offset) => start + offset));
  }
  return blocks;
}

export function createSchedule(
  lessons: Lesson[],
  grade: number,
  duration: LectureDuration,
  simultaneousClassCount: number,
  dayEndPeriods: DayEndPeriods = { "월": 6, "화": 6, "수": 6, "목": 6, "금": 6 },
): ScheduleResult {
  const classes = getClasses(lessons, grade);
  if (classes.length === 0) {
    return { ok: false, message: `${grade}학년 반 정보를 찾지 못했습니다.`, blockedClasses: [] };
  }
  if (simultaneousClassCount > classes.length) {
    return {
      ok: false,
      message: `전체 반 수(${classes.length}개)보다 동시에 수업하는 반 수가 많습니다.`,
      blockedClasses: classes,
    };
  }

  const busy = new Set(
    lessons
      .filter((lesson) => lesson.grade === grade)
      .map((lesson) => `${lesson.classNumber}:${lesson.day}:${lesson.period}`),
  );
  const blocks = getAllowedPeriodBlocks(duration);
  const candidates = new Map<string, Candidate[]>();

  classes.forEach((classInfo) => {
    const classCandidates = DAYS.flatMap((day) =>
      blocks.flatMap((periods) =>
        periods.every((period) =>
          period <= dayEndPeriods[day]
          && !busy.has(`${classInfo.classNumber}:${day}:${period}`),
        )
          ? [{ day, periods }]
          : [],
      ),
    );
    candidates.set(classKey(classInfo), classCandidates);
  });

  const blockedClasses = classes.filter((item) => candidates.get(classKey(item))!.length === 0);
  if (blockedClasses.length > 0) {
    return {
      ok: false,
      message: "전담시간과 겹치지 않는 연속 교시가 없는 반이 있습니다.",
      blockedClasses,
    };
  }

  const orderedClasses = [...classes].sort((a, b) => {
    const candidateDifference = candidates.get(classKey(a))!.length - candidates.get(classKey(b))!.length;
    return candidateDifference || a.classNumber - b.classNumber;
  });
  const load = new Map<string, number>();
  const assignments: Assignment[] = [];
  const solutions: Assignment[][] = [];
  let visitedNodes = 0;
  let searchLimitReached = false;

  function search(index: number): void {
    if (solutions.length > MAX_SOLUTIONS || searchLimitReached) return;
    visitedNodes += 1;
    if (visitedNodes > MAX_SEARCH_NODES) {
      searchLimitReached = true;
      return;
    }
    if (index >= orderedClasses.length) {
      if (!hasValidGroupSizes(assignments, simultaneousClassCount)) return;
      solutions.push(
        assignments
          .map((assignment) => ({ ...assignment, periods: [...assignment.periods] }))
          .sort((a, b) => a.classNumber - b.classNumber),
      );
      return;
    }
    const classInfo = orderedClasses[index];
    const available = candidates.get(classKey(classInfo))!
      .filter((candidate) => candidate.periods.every((period) => (load.get(slotKey(candidate.day, period)) ?? 0) < simultaneousClassCount))
      .sort((a, b) => candidateScore(a, load) - candidateScore(b, load) || compareCandidates(a, b));

    for (const candidate of available) {
      candidate.periods.forEach((period) => {
        const key = slotKey(candidate.day, period);
        load.set(key, (load.get(key) ?? 0) + 1);
      });
      assignments.push({ ...classInfo, day: candidate.day, periods: [...candidate.periods] });

      search(index + 1);

      assignments.pop();
      candidate.periods.forEach((period) => {
        const key = slotKey(candidate.day, period);
        load.set(key, (load.get(key) ?? 1) - 1);
      });
      if (solutions.length > MAX_SOLUTIONS || searchLimitReached) return;
    }
  }

  search(0);

  if (solutions.length === 0) {
    return {
      ok: false,
      message: searchLimitReached
        ? "가능한 조합이 너무 많아 안전한 계산 범위 안에서 편성안을 찾지 못했습니다."
        : `가능한 시간은 있지만 모든 강의를 ${simultaneousClassCount}개 반씩 묶어 배정할 수 없습니다.`,
      blockedClasses: orderedClasses,
    };
  }

  return {
    ok: true,
    solutions: solutions.slice(0, MAX_SOLUTIONS),
    truncated: solutions.length > MAX_SOLUTIONS || searchLimitReached,
  };
}

function classKey(item: ClassInfo): string {
  return `${item.grade}-${item.classNumber}`;
}

function hasValidGroupSizes(assignments: Assignment[], groupSize: number): boolean {
  const groups = new Map<string, number>();
  assignments.forEach((assignment) => {
    const key = `${assignment.day}:${assignment.periods.join("-")}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  });

  const fullGroupCount = Math.floor(assignments.length / groupSize);
  const remainder = assignments.length % groupSize;
  const groupCounts = [...groups.values()];
  const expectedGroupCount = fullGroupCount + (remainder > 0 ? 1 : 0);

  return groupCounts.length === expectedGroupCount
    && groupCounts.filter((count) => count === groupSize).length === fullGroupCount
    && (remainder === 0 || groupCounts.filter((count) => count === remainder).length === 1);
}

function slotKey(day: Day, period: number): string {
  return `${day}:${period}`;
}

function candidateScore(candidate: Candidate, load: Map<string, number>): number {
  const periodLoad = candidate.periods.reduce((sum, period) => sum + (load.get(slotKey(candidate.day, period)) ?? 0), 0);
  const dayLoad = PERIODS.reduce((sum, period) => sum + (load.get(slotKey(candidate.day, period)) ?? 0), 0);
  return periodLoad > 0 ? -100 - periodLoad : dayLoad;
}

function compareCandidates(a: Candidate, b: Candidate): number {
  return DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.periods[0] - b.periods[0];
}
