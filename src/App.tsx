import { useEffect, useMemo, useState, type ClipboardEvent } from "react";
import GuideTour, { type TourStep } from "./components/GuideTour";
import {
  copyHtmlAndText,
  createBlankTimetableGrid,
  gridFromClipboard,
  scheduleToClipboardFormats,
} from "./lib/clipboard";
import { consolidateLessons, parseTimetableGrid } from "./lib/parser";
import { createSchedule, getClasses } from "./lib/scheduler";
import {
  DAYS,
  PERIODS,
  type Day,
  type DayEndPeriods,
  type LectureDuration,
  type ScheduleResult,
  type SourceTable,
} from "./types";

const EMPTY_DAY_END_PERIODS: DayEndPeriods = {
  "월": 0,
  "화": 0,
  "수": 0,
  "목": 0,
  "금": 0,
};

function App() {
  const [sources, setSources] = useState<SourceTable[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [duration, setDuration] = useState<LectureDuration>(2);
  const [simultaneousClassCount, setSimultaneousClassCount] = useState(1);
  const [dayEndPeriods, setDayEndPeriods] = useState<DayEndPeriods>(EMPTY_DAY_END_PERIODS);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [pasteMessage, setPasteMessage] = useState("");
  const [guideStep, setGuideStep] = useState<TourStep | null>(null);

  const lessons = useMemo(
    () => consolidateLessons(sources.flatMap((source) => source.parsed.lessons)),
    [sources],
  );
  const classes = useMemo(() => getClasses(lessons), [lessons]);
  const grades = useMemo(() => [...new Set(classes.map((item) => item.grade))], [classes]);
  const selectedClasses = useMemo(
    () => classes.filter((item) => item.grade === selectedGrade),
    [classes, selectedGrade],
  );
  const warningCount = sources.reduce((sum, source) => sum + source.parsed.warnings.length, 0);

  useEffect(() => {
    if (grades.length === 0) {
      setSelectedGrade(null);
    } else if (selectedGrade === null || !grades.includes(selectedGrade)) {
      setSelectedGrade(grades[0]);
    }
  }, [grades, selectedGrade]);

  useEffect(() => {
    setResult(null);
  }, [sources, selectedGrade, duration, simultaneousClassCount, dayEndPeriods]);

  useEffect(() => {
    if (guideStep === 5 && result) setGuideStep(6);
  }, [guideStep, result]);

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");
    const rows = gridFromClipboard(html, text);

    if (rows.length === 0) {
      setPasteMessage("표 내용을 읽지 못했습니다. 셀 범위를 다시 복사해 주세요.");
      return;
    }

    const id = crypto.randomUUID();
    const sourceNumber = sources.length + 1;
    const parsed = parseTimetableGrid(rows, id);
    setSources((current) => [
      ...current,
      { id, name: `전담 시간표 ${sourceNumber}`, rows, parsed },
    ]);
    setPasteMessage(`${rows.length}행 표를 추가했습니다.`);
  }

  function addBlankTimetable() {
    const id = crypto.randomUUID();
    const rows = createBlankTimetableGrid();
    const sourceNumber = sources.length + 1;
    setSources((current) => [
      ...current,
      {
        id,
        name: `직접 입력 시간표 ${sourceNumber}`,
        rows,
        parsed: parseTimetableGrid(rows, id),
      },
    ]);
    setPasteMessage("빈 시간표를 추가했습니다. 각 칸에 학년-반과 과목을 입력해 주세요.");
  }

  function updateCell(sourceId: string, rowIndex: number, columnIndex: number, value: string) {
    setSources((current) =>
      current.map((source) => {
        if (source.id !== sourceId) return source;
        const rows = source.rows.map((row) => [...row]);
        rows[rowIndex][columnIndex] = value;
        return { ...source, rows, parsed: parseTimetableGrid(rows, source.id) };
      }),
    );
  }

  function renameSource(sourceId: string, name: string) {
    setSources((current) =>
      current.map((source) => source.id === sourceId ? { ...source, name } : source),
    );
  }

  function removeSource(sourceId: string) {
    setSources((current) => current.filter((source) => source.id !== sourceId));
  }

  function runScheduler() {
    if (selectedGrade === null) return;
    setResult(createSchedule(
      lessons,
      selectedGrade,
      duration,
      Math.max(1, simultaneousClassCount),
      dayEndPeriods,
    ));
  }

  function selectDayEndPeriod(day: Day, period: number) {
    setDayEndPeriods((current) => ({
      ...current,
      [day]: current[day] === period ? 0 : period,
    }));
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">EXTERNAL CLASS SCHEDULER</p>
          <h1>외부강의 편성 도우미</h1>
          <p className="hero-copy">
            전담 시간표를 그대로 붙여넣으세요. 반별로 비어 있는 시간을 찾아 외부강의를 자동으로 배정합니다.
          </p>
        </div>
        <button className="help-button" type="button" onClick={() => setGuideStep(0)}>사용방법</button>
      </header>

      <main>
        <section className="panel input-panel">
          <div className="section-heading">
            <span className="step">01</span>
            <div>
              <h2>전담 시간표 붙여넣기</h2>
              <p>엑셀이나 한글에서 시간표 셀 전체를 복사한 다음 아래 영역에 붙여넣으세요.</p>
            </div>
          </div>

          <div
            className="paste-zone"
            data-guide="input"
            tabIndex={0}
            role="textbox"
            aria-label="전담 시간표 붙여넣기 영역"
            onPaste={handlePaste}
          >
            <span className="paste-icon" aria-hidden="true">⌘</span>
            <strong>여기를 클릭하고 Ctrl + V</strong>
            <span>표를 붙여넣을 때마다 시간표가 하나씩 추가됩니다.</span>
          </div>
          <div className="input-alternative">
            <span>또는</span>
            <button type="button" onClick={addBlankTimetable}>빈 시간표 직접 입력</button>
          </div>
          {pasteMessage && <p className="paste-message" role="status">{pasteMessage}</p>}

          <div className="source-list" data-guide="manual-input">
            {sources.map((source) => (
              <SourcePreview
                key={source.id}
                source={source}
                onCellChange={updateCell}
                onNameChange={renameSource}
                onRemove={removeSource}
              />
            ))}
          </div>
        </section>

        <section data-guide="recognition" className={`panel ${sources.length === 0 ? "muted-panel" : ""}`}>
          <div className="section-heading">
            <span className="step">02</span>
            <div>
              <h2>인식 결과</h2>
              <p>표에서 찾은 반과 전담시간입니다. 반 번호는 발견된 가장 큰 번호까지 자동으로 포함합니다.</p>
            </div>
          </div>

          {sources.length === 0 ? (
            <EmptyState text="시간표를 붙여넣으면 여기에 반별 전담시간이 표시됩니다." />
          ) : (
            <>
              <div className="recognition-summary">
                <SummaryItem label="시간표" value={`${sources.length}개`} />
                <SummaryItem label="인식한 수업" value={`${lessons.length}개`} />
                <SummaryItem label="학년" value={grades.map((grade) => `${grade}학년`).join(", ")} />
                <SummaryItem label="확인 필요" value={`${warningCount}개`} warning={warningCount > 0} />
              </div>

              <div className="grade-tabs" role="tablist" aria-label="학년 선택">
                {grades.map((grade) => (
                  <button
                    key={grade}
                    type="button"
                    className={grade === selectedGrade ? "active" : ""}
                    onClick={() => setSelectedGrade(grade)}
                  >
                    {grade}학년
                  </button>
                ))}
              </div>

              <div className="class-cards">
                {selectedClasses.map((classInfo) => {
                  const classLessons = lessons.filter(
                    (lesson) => lesson.grade === classInfo.grade && lesson.classNumber === classInfo.classNumber,
                  );
                  return (
                    <article className="class-card" key={`${classInfo.grade}-${classInfo.classNumber}`}>
                      <div className="class-card-title">
                        <strong>{classInfo.grade}-{classInfo.classNumber}</strong>
                        <span>{classLessons.length}시간</span>
                      </div>
                      {classLessons.length > 0 ? (
                        <ul>
                          {classLessons
                            .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.period - b.period)
                            .map((lesson, index) => (
                              <li key={`${lesson.sourceTableId}-${lesson.day}-${lesson.period}-${index}`}>
                                <span>{lesson.day} {lesson.period}교시</span>
                                <em>{lesson.subject}</em>
                              </li>
                            ))}
                        </ul>
                      ) : <p className="no-busy-time">전담시간 없음</p>}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <section className={`panel schedule-panel ${lessons.length === 0 ? "muted-panel" : ""}`}>
          <div className="section-heading">
            <span className="step">03</span>
            <div>
              <h2>외부강의 자동 편성</h2>
              <p>강의 조건을 정하면 전담시간과 겹치지 않는 조합을 계산합니다.</p>
            </div>
          </div>

          <DayPeriodSelector values={dayEndPeriods} onSelect={selectDayEndPeriod} />

          <div className="config-row" data-guide="lecture-config">
            <label>
              <span>각 반의 강의 시간</span>
              <select value={duration} onChange={(event) => setDuration(Number(event.target.value) as LectureDuration)}>
                <option value={1}>1교시</option>
                <option value={2}>2교시 연속</option>
                <option value={3}>3교시 연속</option>
                <option value={4}>4교시 연속</option>
              </select>
            </label>
            <label>
              <span>동시에 수업하는 반 수</span>
              <div className="number-field">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={simultaneousClassCount}
                  onChange={(event) => setSimultaneousClassCount(Math.max(1, Number(event.target.value) || 1))}
                />
                <span>개 반</span>
              </div>
            </label>
            <button
              className="primary-button"
              data-guide="schedule-button"
              type="button"
              disabled={selectedGrade === null || !DAYS.some((day) => dayEndPeriods[day] > 0)}
              onClick={runScheduler}
            >
              {selectedGrade ? `${selectedGrade}학년 자동 편성` : "자동 편성"}
            </button>
          </div>
          <p className="rule-note">
            반 수가 나누어떨어지지 않으면 나머지 반은 별도 타임에 배정됩니다. 예: 7개 반 ÷ 2개 반 → 2·2·2·1반
          </p>
          {duration === 2 && <p className="rule-note">2교시 강의는 1~2, 3~4, 5~6교시 블록에만 배정됩니다.</p>}

          {result && <ScheduleOutput result={result} grade={selectedGrade!} dayEndPeriods={dayEndPeriods} />}
        </section>
      </main>

      <footer>입력한 시간표는 서버로 전송되지 않고 현재 브라우저에서만 처리됩니다.</footer>
      {guideStep !== null && (
        <GuideTour
          step={guideStep}
          onStepChange={setGuideStep}
          onClose={() => setGuideStep(null)}
          onAddBlank={() => {
            addBlankTimetable();
            setGuideStep(1);
          }}
          hasLessons={lessons.length > 0}
          hasDayPeriods={DAYS.some((day) => dayEndPeriods[day] > 0)}
        />
      )}
    </div>
  );
}

function SourcePreview({
  source,
  onCellChange,
  onNameChange,
  onRemove,
}: {
  source: SourceTable;
  onCellChange: (sourceId: string, row: number, column: number, value: string) => void;
  onNameChange: (sourceId: string, name: string) => void;
  onRemove: (sourceId: string) => void;
}) {
  const warningCells = new Set(source.parsed.warnings.map((warning) => `${warning.row}:${warning.column}`));
  return (
    <details className="source-card" open>
      <summary>
        <input
          value={source.name}
          aria-label="시간표 이름"
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onNameChange(source.id, event.target.value)}
        />
        <span>{source.parsed.lessons.length}개 수업 인식</span>
        {source.parsed.warnings.length > 0 && <b>{source.parsed.warnings.length}개 확인 필요</b>}
        <button type="button" onClick={(event) => { event.preventDefault(); onRemove(source.id); }}>삭제</button>
      </summary>
      <div className="table-scroll">
        <table className="editable-grid">
          <tbody>
            {source.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((value, columnIndex) => (
                  <td key={columnIndex} className={warningCells.has(`${rowIndex}:${columnIndex}`) ? "warning-cell" : ""}>
                    <textarea
                      value={value}
                      aria-label={`${rowIndex + 1}행 ${columnIndex + 1}열`}
                      onChange={(event) => onCellChange(source.id, rowIndex, columnIndex, event.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {source.parsed.warnings.length > 0 && (
        <ul className="warnings">
          {source.parsed.warnings.map((warning, index) => (
            <li key={`${warning.row}-${warning.column}-${index}`}>{warning.message}{warning.value ? `: “${warning.value}”` : ""}</li>
          ))}
        </ul>
      )}
    </details>
  );
}

function DayPeriodSelector({
  values,
  onSelect,
}: {
  values: DayEndPeriods;
  onSelect: (day: Day, period: number) => void;
}) {
  return (
    <div className="day-period-selector" data-guide="day-periods">
      <div className="day-period-heading">
        <div>
          <strong>요일별 수업 교시</strong>
          <p>각 요일의 마지막 교시를 누르세요. 선택한 교시까지 자동으로 채워집니다.</p>
        </div>
        <span>선택한 범위 안에서만 외부강의를 배정합니다.</span>
      </div>
      <div className="day-period-grid" role="group" aria-label="요일별 마지막 수업 교시 선택">
        <div className="period-corner">교시</div>
        {DAYS.map((day) => (
          <div className="day-header" key={day}>
            <strong>{day}</strong>
            <span>{values[day] > 0 ? `${values[day]}교시까지` : "선택 안 함"}</span>
          </div>
        ))}
        {PERIODS.map((period) => [
          <div className="period-label" key={`label-${period}`}>{period}</div>,
          ...DAYS.map((day) => {
            const selected = period <= values[day];
            const isEnd = period === values[day];
            return (
              <button
                key={`${day}-${period}`}
                type="button"
                className={`${selected ? "selected" : ""} ${isEnd ? "end-period" : ""}`}
                aria-label={`${day}요일 ${period}교시까지 수업`}
                aria-pressed={isEnd}
                onClick={() => onSelect(day, period)}
              >
                {selected ? "✓" : ""}
              </button>
            );
          }),
        ])}
      </div>
    </div>
  );
}

function ScheduleOutput({
  result,
  grade,
  dayEndPeriods,
}: {
  result: ScheduleResult;
  grade: number;
  dayEndPeriods: DayEndPeriods;
}) {
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    setSolutionIndex(0);
    setCopyStatus("idle");
  }, [result]);

  if (!result.ok) {
    return (
      <div className="result-box failure" data-guide="schedule-result" role="alert">
        <strong>편성하지 못했습니다.</strong>
        <p>{result.message}</p>
        {result.blockedClasses.length > 0 && (
          <p>확인할 반: {result.blockedClasses.map((item) => `${item.grade}-${item.classNumber}`).join(", ")}</p>
        )}
      </div>
    );
  }

  const assignments = result.solutions[solutionIndex] ?? result.solutions[0];
  const solutionCountLabel = result.truncated
    ? `${result.solutions.length}개 이상`
    : `${result.solutions.length}개`;

  async function copyCurrentSchedule() {
    const formats = scheduleToClipboardFormats(assignments, dayEndPeriods);
    try {
      await copyHtmlAndText(formats.html, formats.text);
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <div className="result-box success" data-guide="schedule-result">
      <div className="result-heading">
        <div>
          <span>편성 완료</span>
          <h3>{grade}학년 외부강의 시간표</h3>
        </div>
        <div className="result-heading-actions">
          <strong>{assignments.length}개 반 · 편성안 {solutionCountLabel}</strong>
          <button type="button" onClick={copyCurrentSchedule}>엑셀·한글로 복사</button>
        </div>
      </div>
      {copyStatus !== "idle" && (
        <p className={`copy-result-status ${copyStatus}`} role="status">
          {copyStatus === "success"
            ? "표를 복사했습니다. 엑셀이나 한글에서 Ctrl+V로 붙여넣으세요."
            : "클립보드에 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해 주세요."}
        </p>
      )}
      {result.solutions.length > 1 && (
        <div className="solution-navigator">
          <button
            type="button"
            disabled={solutionIndex === 0}
            onClick={() => setSolutionIndex((current) => Math.max(0, current - 1))}
          >
            이전
          </button>
          <label>
            <span>편성안</span>
            <select
              value={solutionIndex}
              onChange={(event) => setSolutionIndex(Number(event.target.value))}
            >
              {result.solutions.map((_, index) => (
                <option key={index} value={index}>{index + 1}번</option>
              ))}
            </select>
            <span>/ {solutionCountLabel}</span>
          </label>
          <button
            type="button"
            disabled={solutionIndex >= result.solutions.length - 1}
            onClick={() => setSolutionIndex((current) => Math.min(result.solutions.length - 1, current + 1))}
          >
            다음
          </button>
        </div>
      )}
      <div className="table-scroll">
        <table className="result-table">
          <thead>
            <tr><th>교시</th>{DAYS.map((day) => <th key={day}>{day}</th>)}</tr>
          </thead>
          <tbody>
            {PERIODS.map((period) => (
              <tr key={period}>
                <th>{period}교시</th>
                {DAYS.map((day) => {
                  const assigned = assignments.filter(
                    (item) => item.day === day && item.periods.includes(period),
                  );
                  return (
                    <td key={day} className={period > dayEndPeriods[day] ? "closed-slot" : ""}>
                      {assigned.map((item) => <span className="assignment-chip" key={`${item.grade}-${item.classNumber}`}>{item.grade}-{item.classNumber}</span>)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="assignment-list">
        {assignments.map((item) => (
          <div key={`${item.grade}-${item.classNumber}`}>
            <strong>{item.grade}-{item.classNumber}</strong>
            <span>{item.day}요일 {formatPeriods(item.periods)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatPeriods(periods: number[]): string {
  return periods.length === 1 ? `${periods[0]}교시` : `${periods[0]}~${periods.at(-1)}교시`;
}

function SummaryItem({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className={warning ? "summary-item warning" : "summary-item"}><span>{label}</span><strong>{value}</strong></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><span aria-hidden="true">＋</span><p>{text}</p></div>;
}

export default App;
