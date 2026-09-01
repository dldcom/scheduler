import {
  DAYS,
  PERIODS,
  type Assignment,
  type ClassInfo,
  type Day,
  type LectureDuration,
  type Lesson,
  type ScheduleResult,
} from "../types";

type Candidate = { day: Day; periods: number[] };

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
  simultaneousLimit: number,
): ScheduleResult {
  const classes = getClasses(lessons, grade);
  if (classes.length === 0) {
    return { ok: false, message: `${grade}학년 반 정보를 찾지 못했습니다.`, blockedClasses: [] };
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
        periods.every((period) => !busy.has(`${classInfo.classNumber}:${day}:${period}`))
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

  function search(index: number): boolean {
    if (index >= orderedClasses.length) return true;
    const classInfo = orderedClasses[index];
    const available = candidates.get(classKey(classInfo))!
      .filter((candidate) => candidate.periods.every((period) => (load.get(slotKey(candidate.day, period)) ?? 0) < simultaneousLimit))
      .sort((a, b) => candidateScore(a, load) - candidateScore(b, load) || compareCandidates(a, b));

    for (const candidate of available) {
      candidate.periods.forEach((period) => {
        const key = slotKey(candidate.day, period);
        load.set(key, (load.get(key) ?? 0) + 1);
      });
      assignments.push({ ...classInfo, day: candidate.day, periods: [...candidate.periods] });

      if (search(index + 1)) return true;

      assignments.pop();
      candidate.periods.forEach((period) => {
        const key = slotKey(candidate.day, period);
        load.set(key, (load.get(key) ?? 1) - 1);
      });
    }

    return false;
  }

  if (!search(0)) {
    return {
      ok: false,
      message: "가능한 시간은 있지만 동시 수업 가능 반 수 제한 안에서 모든 반을 배정할 수 없습니다.",
      blockedClasses: orderedClasses,
    };
  }

  return {
    ok: true,
    assignments: assignments.sort((a, b) => a.classNumber - b.classNumber),
  };
}

function classKey(item: ClassInfo): string {
  return `${item.grade}-${item.classNumber}`;
}

function slotKey(day: Day, period: number): string {
  return `${day}:${period}`;
}

function candidateScore(candidate: Candidate, load: Map<string, number>): number {
  const periodLoad = candidate.periods.reduce((sum, period) => sum + (load.get(slotKey(candidate.day, period)) ?? 0), 0);
  const dayLoad = PERIODS.reduce((sum, period) => sum + (load.get(slotKey(candidate.day, period)) ?? 0), 0);
  return periodLoad * 10 + dayLoad;
}

function compareCandidates(a: Candidate, b: Candidate): number {
  return DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.periods[0] - b.periods[0];
}
