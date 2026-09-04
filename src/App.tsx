import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import GuideTour, { type TourStep } from "./components/GuideTour";
import {
  copyHtmlAndText,
  createBlankTimetableGrid,
  gridFromClipboard,
  scheduleToClipboardFormats,
} from "./lib/clipboard";
import { consolidateLessons, parseTimetableGrid } from "./lib/parser";
import { buildConsolidatedTimetable } from "./lib/preview";
import { createSchedule, getClasses } from "./lib/scheduler";
import {
  readSavedTimetables,
  writeSavedTimetables,
  type SavedTimetable,
} from "./lib/storage";
import {
  DAYS,
  PERIODS,
  type Day,
  type DayPeriodSelection,
  type LectureDuration,
  type Lesson,
  type ScheduleResult,
  type SourceTable,
} from "./types";

const EMPTY_DAY_PERIODS: DayPeriodSelection = {
  "월": [],
  "화": [],
  "수": [],
  "목": [],
  "금": [],
};

function App() {
  const [sources, setSources] = useState<SourceTable[]>([]);
  const [selectedTimetableId, setSelectedTimetableId] = useState<string | null>(null);
  const [timetableName, setTimetableName] = useState("");
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [duration, setDuration] = useState<LectureDuration>(2);
  const [simultaneousClassCount, setSimultaneousClassCount] = useState(1);
  const [dayPeriods, setDayPeriods] = useState<DayPeriodSelection>(EMPTY_DAY_PERIODS);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [selectionMessage, setSelectionMessage] = useState("");
  const [timetableMessage, setTimetableMessage] = useState("");
  const [guideStep, setGuideStep] = useState<TourStep | null>(null);
  const [savedTimetables, setSavedTimetables] = useState<SavedTimetable[]>([]);
  const [savedModalOpen, setSavedModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [blankTimetableOpen, setBlankTimetableOpen] = useState(false);

  const lessons = useMemo(
    () => consolidateLessons(sources.flatMap((source) => source.parsed.lessons)),
    [sources],
  );
  const classes = useMemo(() => getClasses(lessons), [lessons]);
  const grades = useMemo(() => [...new Set(classes.map((item) => item.grade))], [classes]);
  useEffect(() => {
    const saved = readSavedTimetables();
    setSavedTimetables(saved);
  }, []);

  useEffect(() => {
    if (grades.length === 0) {
      setSelectedGrade(null);
    } else if (selectedGrade === null || !grades.includes(selectedGrade)) {
      setSelectedGrade(grades[0]);
    }
  }, [grades, selectedGrade]);

  useEffect(() => {
    setResult(null);
  }, [sources, selectedGrade, duration, simultaneousClassCount, dayPeriods]);

  function saveTimetable(item: SavedTimetable): string | null {
    const existing = savedTimetables.find((saved) => saved.id === item.id || saved.name === item.name);
    const savedItem = existing ? { ...item, id: existing.id } : item;
    const next = [savedItem, ...savedTimetables.filter((saved) => saved.id !== savedItem.id)];
    if (!writeSavedTimetables(next)) return null;
    setSavedTimetables(next);
    return savedItem.id;
  }

  function removeSavedTimetable(item: SavedTimetable): boolean {
    if (!window.confirm(`‘${item.name}’ 시간표를 삭제할까요?`)) return false;
    const next = savedTimetables.filter((saved) => saved.id !== item.id);
    if (!writeSavedTimetables(next)) return false;
    setSavedTimetables(next);
    return true;
  }

  function startNewTimetable() {
    setSources([]);
    setSelectedTimetableId(null);
    setTimetableName("");
    setSelectedGrade(null);
    setDayPeriods(EMPTY_DAY_PERIODS);
    setResult(null);
    setSelectionMessage("");
    setTimetableMessage("");
    setSavedModalOpen(false);
    setSaveModalOpen(false);
    setBlankTimetableOpen(false);
    window.setTimeout(() => {
      const input = document.querySelector<HTMLElement>('[data-guide="timetable-input"] .paste-zone');
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
      input?.focus();
    }, 80);
  }

  function openSaveModal() {
    if (sources.length === 0) {
      setTimetableMessage("시간표를 먼저 입력해 주세요.");
      return;
    }
    setSaveMessage("");
    setSaveModalOpen(true);
  }

  function loadSavedTimetable(item: SavedTimetable) {
    const nextSources = item.sources.map((source, index) => {
      const id = crypto.randomUUID();
      const rows = source.rows.map((row) => [...row]);
      return {
        id,
        name: source.name || `전담 시간표 ${index + 1}`,
        rows,
        parsed: parseTimetableGrid(rows, id),
      };
    });
    setSources(nextSources);
    setSelectedTimetableId(item.id);
    setTimetableName(item.name);
    setSelectedGrade(null);
    setDayPeriods(EMPTY_DAY_PERIODS);
    setResult(null);
    setSelectionMessage("시간표가 선택되었습니다.");
    setTimetableMessage("");
    setSavedModalOpen(false);
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(".schedule-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function runScheduler() {
    if (selectedGrade === null) return;
    setResult(createSchedule(
      lessons,
      selectedGrade,
      duration,
      Math.max(1, simultaneousClassCount),
      dayPeriods,
    ));
  }

  function handleTimetablePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const rows = gridFromClipboard(
      event.clipboardData.getData("text/html"),
      event.clipboardData.getData("text/plain"),
    );
    if (rows.length === 0) {
      setTimetableMessage("표를 읽지 못했어요. 표 전체를 다시 복사해 주세요.");
      return;
    }

    const id = crypto.randomUUID();
    setSources((current) => [
      ...current,
      {
        id,
        name: `전담 시간표 ${current.length + 1}`,
        rows,
        parsed: parseTimetableGrid(rows, id),
      },
    ]);
    setSelectedTimetableId(null);
    setTimetableName((current) => current || "전담 시간표");
    setSelectionMessage("");
    setTimetableMessage(`시간표를 추가했어요. (${rows.length}행)`);
  }

  function addBlankTimetable(rows: string[][]) {
    const id = crypto.randomUUID();
    setSources((current) => [
      ...current,
      {
        id,
        name: `직접 입력 시간표 ${current.length + 1}`,
        rows,
        parsed: parseTimetableGrid(rows, id),
      },
    ]);
    setSelectedTimetableId(null);
    setTimetableName((current) => current || "전담 시간표");
    setSelectionMessage("");
    setTimetableMessage("빈 표를 만들었어요. 각 칸에 내용을 입력해 주세요.");
    setBlankTimetableOpen(false);
  }

  function updateTimetableCell(sourceId: string, rowIndex: number, columnIndex: number, value: string) {
    setSources((current) => current.map((source) => {
      if (source.id !== sourceId) return source;
      const rows = source.rows.map((row) => [...row]);
      rows[rowIndex][columnIndex] = value;
      return { ...source, rows, parsed: parseTimetableGrid(rows, source.id) };
    }));
    setSelectionMessage("");
    setTimetableMessage("");
  }

  function renameTimetableSource(sourceId: string, name: string) {
    setSources((current) => current.map((source) => source.id === sourceId ? { ...source, name } : source));
    setSelectionMessage("");
  }

  function removeTimetableSource(sourceId: string) {
    setSources((current) => current.filter((source) => source.id !== sourceId));
    setSelectionMessage("");
  }

  function saveCurrentTimetable() {
    if (sources.length === 0) {
      setSaveMessage("시간표를 먼저 입력해 주세요.");
      return;
    }
    const name = timetableName.trim();
    if (!name) {
      setSaveMessage("시간표 이름을 입력해 주세요.");
      return;
    }

    const savedId = saveTimetable({
      id: selectedTimetableId ?? crypto.randomUUID(),
      name,
      savedAt: Date.now(),
      sources: sources.map((source) => ({
        name: source.name,
        rows: source.rows.map((row) => [...row]),
      })),
    });
    if (!savedId) {
      setSaveMessage("저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.");
      return;
    }

    setSelectedTimetableId(savedId);
    setSaveModalOpen(false);
    setSaveMessage("");
    setSelectionMessage("시간표가 저장되었습니다.");
    setTimetableMessage("");
  }

  function toggleDayPeriod(day: Day, period: number) {
    setDayPeriods((current) => {
      const periods = current[day].includes(period)
        ? current[day].filter((item) => item !== period)
        : [...current[day], period].sort((a, b) => a - b);
      return { ...current, [day]: periods };
    });
  }

  function setDayPeriodRange(
    startDay: Day,
    endDay: Day,
    startPeriod: number,
    endPeriod: number,
    selected: boolean,
  ) {
    const firstDay = Math.min(DAYS.indexOf(startDay), DAYS.indexOf(endDay));
    const lastDay = Math.max(DAYS.indexOf(startDay), DAYS.indexOf(endDay));
    const firstPeriod = Math.min(startPeriod, endPeriod);
    const lastPeriod = Math.max(startPeriod, endPeriod);
    const rangeDays = DAYS.slice(firstDay, lastDay + 1);
    setDayPeriods((current) => {
      const range = PERIODS.filter((period) => period >= firstPeriod && period <= lastPeriod);
      const next = { ...current };
      rangeDays.forEach((day) => {
        next[day] = selected
          ? [...new Set([...current[day], ...range])].sort((a, b) => a - b)
          : current[day].filter((period) => !range.includes(period as (typeof PERIODS)[number]));
      });
      return next;
    });
  }

  return (
    <div className="app-shell">
      <div className="app-title-row">
        <h1>강의 시간표 도우미</h1>
      </div>

      <main>
        <section className="panel timetable-selection-panel" data-guide="timetable-select">
          <div className="section-heading timetable-selection-heading">
            <div className="timetable-selection-title">
              <h2>1. 전담 시간표 가져오기</h2>
              <button className="help-button selection-help-button" type="button" onClick={() => setGuideStep(0)}>
                사용 방법
              </button>
            </div>
            <button className="selection-open-button selection-load-button" type="button" onClick={() => setSavedModalOpen(true)}>
              저장 목록에서 불러오기
            </button>
          </div>

          <div className="timetable-input-area" data-guide="timetable-input">
            <div
              className="paste-zone"
              tabIndex={0}
              role="textbox"
              aria-label="전담 시간표 붙여넣기"
              onPaste={handleTimetablePaste}
            >
              <span className="paste-icon" aria-hidden="true">⌘</span>
              <strong>시간표 붙여넣기 영역</strong>
              <span>한글·엑셀 표를 복사한 뒤 Ctrl + V</span>
            </div>
            <div className="input-alternative">
              <span>또는</span>
              <button type="button" onClick={() => setBlankTimetableOpen(true)}>빈 시간표 작성하기</button>
            </div>
          </div>
          {timetableMessage && <p className="paste-message" role="status">{timetableMessage}</p>}

          {sources.length > 0 && (
            <div className="timetable-preview" data-guide="timetable-preview">
              <div className="timetable-preview-heading">
                <h3>미리보기</h3>
                <span>{lessons.length}개 수업 인식</span>
              </div>
              <ConsolidatedTimetablePreview lessons={lessons} />
              <div className="consolidated-preview-footer">
                <button className="saved-save-button" type="button" onClick={openSaveModal}>
                  시간표 저장하기
                </button>
              </div>
              {selectionMessage && <p className="selection-status" role="status">{selectionMessage}</p>}
              <details className="source-input-details">
                <summary>
                  <span>입력한 원본 시간표 펼쳐보기</span>
                  <span>{sources.length}개 표</span>
                </summary>
                <div className="source-list">
                  {sources.map((source) => (
                    <SourcePreview
                      key={source.id}
                      source={source}
                      onCellChange={updateTimetableCell}
                      onNameChange={renameTimetableSource}
                      onRemove={removeTimetableSource}
                    />
                  ))}
                </div>
              </details>
            </div>
          )}
        </section>

        {sources.length > 0 && <section className="panel schedule-panel">
          <div className="section-heading">
            <div>
              <h2>2. 배정 조건 정하기</h2>
            </div>
          </div>

          <div className="schedule-grade-picker" data-guide="grade-picker">
            <span>학년</span>
            <div role="tablist" aria-label="편성할 학년 선택">
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
          </div>

          <DayPeriodSelector
            values={dayPeriods}
            onToggle={toggleDayPeriod}
            onRangeChange={setDayPeriodRange}
          />

          <div className="config-row" data-guide="lecture-config">
            <label>
              <span>강의시간</span>
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
              disabled={selectedGrade === null || !DAYS.some((day) => dayPeriods[day].length > 0)}
              onClick={runScheduler}
            >
              결과표 만들기
            </button>
          </div>
        </section>}

        {result && <section className="panel result-panel">
          <div className="section-heading result-section-heading">
            <h2>3. 결과표</h2>
          </div>
          <ScheduleOutput result={result} dayPeriods={dayPeriods} />
        </section>}
      </main>

      {guideStep !== null && (
        <GuideTour
          step={guideStep}
          onStepChange={setGuideStep}
          onClose={() => setGuideStep(null)}
          onOpenSaved={() => {
            setGuideStep(null);
            setSavedModalOpen(true);
          }}
          hasLessons={lessons.length > 0}
          hasDayPeriods={DAYS.some((day) => dayPeriods[day].length > 0)}
        />
      )}
      {savedModalOpen && (
        <SavedTimetableModal
          savedTimetables={savedTimetables}
          onClose={() => setSavedModalOpen(false)}
          onLoad={loadSavedTimetable}
          onDelete={removeSavedTimetable}
          onNew={startNewTimetable}
        />
      )}
      {saveModalOpen && (
        <TimetableSaveModal
          value={timetableName}
          message={saveMessage}
          onChange={(value) => {
            setTimetableName(value);
            setSaveMessage("");
            setSelectionMessage("");
          }}
          onClose={() => {
            setSaveModalOpen(false);
            setSaveMessage("");
          }}
          onSave={saveCurrentTimetable}
        />
      )}
      {blankTimetableOpen && (
        <BlankTimetableModal
          onClose={() => setBlankTimetableOpen(false)}
          onSave={addBlankTimetable}
        />
      )}
    </div>
  );
}

function ConsolidatedTimetablePreview({ lessons }: { lessons: Lesson[] }) {
  const rows = buildConsolidatedTimetable(lessons);
  const classCount = new Set(lessons.map((lesson) => `${lesson.grade}-${lesson.classNumber}`)).size;

  return (
    <div className="consolidated-preview">
      <div className="consolidated-preview-heading">
        <div>
          <strong>인식된 전담 시간표</strong>
          <span>여러 개의 전담 시간표에서 찾은 반과 과목을 한곳에 모았어요.</span>
        </div>
        <em>{classCount}개 반 · {lessons.length}개 수업</em>
      </div>
      <div className="table-scroll consolidated-table-scroll">
        <table className="consolidated-table">
          <thead>
            <tr>
              <th>교시</th>
              {DAYS.map((day) => <th key={day}>{day}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.period}>
                <th>{row.period}교시</th>
                {DAYS.map((day) => (
                  <td key={day}>
                    {row.cells[day].length > 0 ? (
                      <ul className="consolidated-lesson-list">
                        {row.cells[day].map((lesson) => (
                          <li key={`${lesson.grade}-${lesson.classNumber}`}>
                            <strong>{lesson.grade}-{lesson.classNumber}</strong>
                            <span>{lesson.subject}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="consolidated-empty-cell">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    <details className="source-card">
      <summary>
        <input
          value={source.name}
          aria-label="시간표 이름"
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onNameChange(source.id, event.target.value)}
        />
        <span>{source.parsed.lessons.length}개 수업 찾음</span>
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

function BlankTimetableModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (rows: string[][]) => void;
}) {
  const [rows, setRows] = useState<string[][]>(() => createBlankTimetableGrid());

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    setRows((current) => current.map((row, currentRowIndex) => {
      if (currentRowIndex !== rowIndex) return row;
      return row.map((cell, currentColumnIndex) => currentColumnIndex === columnIndex ? value : cell);
    }));
  }

  return (
    <div
      className="input-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="input-modal blank-timetable-modal" role="dialog" aria-modal="true" aria-labelledby="blank-timetable-title">
        <header className="input-modal-header">
          <div>
            <span>새 시간표 작성</span>
            <h2 id="blank-timetable-title">빈 시간표 작성하기</h2>
          </div>
          <button className="input-modal-close" type="button" onClick={onClose} aria-label="빈 시간표 작성 닫기">×</button>
        </header>
        <div className="input-modal-body">
          <p>각 칸에 전담 수업을 입력해 주세요. 예: <strong>4-1 영어</strong></p>
          <div className="table-scroll blank-timetable-scroll">
            <table className="editable-grid blank-timetable-grid">
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((value, columnIndex) => (
                      <td key={columnIndex}>
                        <textarea
                          value={value}
                          aria-label={`${rowIndex + 1}행 ${columnIndex + 1}열`}
                          onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <footer className="input-modal-actions">
          <button className="saved-cancel-button" type="button" onClick={onClose}>취소</button>
          <button className="saved-save-button" type="button" onClick={() => onSave(rows.map((row) => [...row]))}>시간표 추가하기</button>
        </footer>
      </section>
    </div>
  );
}

function TimetableSaveModal({
  value,
  message,
  onChange,
  onClose,
  onSave,
}: {
  value: string;
  message: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="input-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="input-modal save-timetable-modal" role="dialog" aria-modal="true" aria-labelledby="save-timetable-title" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
        <header className="input-modal-header">
          <div>
            <span>저장 목록에 추가</span>
            <h2 id="save-timetable-title">시간표 저장하기</h2>
          </div>
          <button className="input-modal-close" type="button" onClick={onClose} aria-label="시간표 저장 닫기">×</button>
        </header>
        <div className="input-modal-body save-timetable-body">
          <label htmlFor="save-timetable-name">시간표 이름</label>
          <input
            id="save-timetable-name"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="예: 4학년 전담 시간표"
            maxLength={60}
            autoFocus
          />
          <p>이 이름으로 저장 목록에서 다시 불러올 수 있어요.</p>
          {message && <p className="input-modal-message" role="alert">{message}</p>}
        </div>
        <footer className="input-modal-actions">
          <button className="saved-cancel-button" type="button" onClick={onClose}>취소</button>
          <button className="saved-save-button" type="submit">저장하기</button>
        </footer>
      </form>
    </div>
  );
}

function SavedTimetableWelcome({
  hasSavedTimetables,
}: {
  hasSavedTimetables: boolean;
}) {
  return (
    <div className="saved-editor saved-modal-welcome" role="status">
      <h3>{hasSavedTimetables ? "시간표를 선택하세요." : "저장된 시간표가 없습니다."}</h3>
    </div>
  );
}

function SavedTimetablePreview({
  item,
  onBack,
  onSelect,
}: {
  item: SavedTimetable;
  onBack: () => void;
  onSelect: () => void;
}) {
  return (
    <div className="saved-editor saved-timetable-preview">
      <div className="saved-editor-heading">
        <h3>{item.name}</h3>
      </div>
      <div className="selected-preview-list">
        {item.sources.map((source) => (
          <article className="selected-preview-card" key={`${item.id}-${source.name}`}>
            <div className="selected-preview-card-heading">
              <strong>{source.name}</strong>
            </div>
            <div className="selected-preview-table-scroll">
              <table className="selected-preview-table">
                <tbody>
                  {source.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((value, columnIndex) => <td key={columnIndex}>{value}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </div>
      <div className="saved-preview-actions">
        <button className="saved-cancel-button" type="button" onClick={onBack}>목록으로</button>
        <button className="saved-save-button" type="button" onClick={onSelect}>선택</button>
      </div>
    </div>
  );
}

function SavedTimetableModal({
  savedTimetables,
  onClose,
  onLoad,
  onDelete,
  onNew,
}: {
  savedTimetables: SavedTimetable[];
  onClose: () => void;
  onLoad: (item: SavedTimetable) => void;
  onDelete: (item: SavedTimetable) => boolean;
  onNew: () => void;
}) {
  const [previewItem, setPreviewItem] = useState<SavedTimetable | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function deleteSavedItem(item: SavedTimetable) {
    if (onDelete(item) && previewItem?.id === item.id) setPreviewItem(null);
  }

  return (
    <div
      className="saved-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="saved-modal" role="dialog" aria-modal="true" aria-labelledby="saved-modal-title">
        <header className="saved-modal-header">
          <h2 id="saved-modal-title">{previewItem ? "시간표 미리보기" : "저장 목록"}</h2>
          <button className="saved-modal-close" type="button" onClick={onClose} aria-label="저장 목록 닫기">×</button>
        </header>

        <div className="saved-modal-body">
          <aside className="saved-list-panel" aria-label="저장된 시간표 목록">
            <div className="saved-list-heading">
              <div>
                <strong>저장 목록</strong>
                <span>{savedTimetables.length}개</span>
              </div>
              <button type="button" onClick={onNew}>새로 입력</button>
            </div>
            {savedTimetables.length === 0 ? (
              <p className="saved-list-empty">저장된 시간표가 없습니다.</p>
            ) : (
              <div className="saved-list-items">
                {savedTimetables.map((item) => (
                  <div className="saved-list-item" key={item.id}>
                    <button
                      className={`saved-list-load${previewItem?.id === item.id ? " previewing" : ""}`}
                      type="button"
                      aria-label={`${item.name} 미리보기`}
                      onClick={() => setPreviewItem(item)}
                    >
                      <strong>{item.name}</strong>
                      <span>{formatSavedDate(item.savedAt)} · {item.sources.length}개 표</span>
                    </button>
                    <button className="saved-list-delete" type="button" onClick={() => deleteSavedItem(item)} aria-label={`${item.name} 삭제`}>삭제</button>
                  </div>
                ))}
              </div>
            )}
          </aside>

          {previewItem ? (
            <SavedTimetablePreview
              item={previewItem}
              onBack={() => setPreviewItem(null)}
              onSelect={() => onLoad(previewItem)}
            />
          ) : (
            <SavedTimetableWelcome
              hasSavedTimetables={savedTimetables.length > 0}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function formatSavedDate(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "날짜 없음";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "numeric", day: "numeric" }).format(date);
}

function DayPeriodSelector({
  values,
  onToggle,
  onRangeChange,
}: {
  values: DayPeriodSelection;
  onToggle: (day: Day, period: number) => void;
  onRangeChange: (startDay: Day, endDay: Day, startPeriod: number, endPeriod: number, selected: boolean) => void;
}) {
  type DragState = {
    pointerId: number;
    startDay: Day;
    endDay: Day;
    startPeriod: number;
    endPeriod: number;
    selected: boolean;
  };
  const dragRef = useRef<DragState | null>(null);
  const skipClickRef = useRef(false);
  const [draggingRange, setDraggingRange] = useState<DragState | null>(null);
  const onRangeChangeRef = useRef(onRangeChange);
  onRangeChangeRef.current = onRangeChange;

  function extendDrag(day: Day, period: number) {
    const drag = dragRef.current;
    if (!drag || (drag.endDay === day && drag.endPeriod === period)) return;

    drag.endDay = day;
    drag.endPeriod = period;
    setDraggingRange({ ...drag });
    onRangeChangeRef.current(drag.startDay, day, drag.startPeriod, period, drag.selected);
  }

  function finishDrag() {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDraggingRange(null);
    window.setTimeout(() => {
      skipClickRef.current = false;
    }, 0);
  }

  useEffect(() => {
    function updateFromPointer(event: globalThis.PointerEvent) {
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const button = element?.closest("button[data-day][data-period]") as HTMLButtonElement | null;
      const dayValue = button?.dataset.day;
      const period = Number(button?.dataset.period);
      if (!dayValue || !DAYS.includes(dayValue as Day) || !Number.isInteger(period)) return;
      extendDrag(dayValue as Day, period);
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      updateFromPointer(event);
      event.preventDefault();
    }

    function handlePointerEnd(event: globalThis.PointerEvent) {
      if (dragRef.current?.pointerId === event.pointerId) finishDrag();
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, []);

  function startDrag(day: Day, period: number, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    skipClickRef.current = true;
    const selected = values[day].includes(period);
    const drag: DragState = {
      pointerId: event.pointerId,
      startDay: day,
      endDay: day,
      startPeriod: period,
      endPeriod: period,
      selected: !selected,
    };
    dragRef.current = drag;
    setDraggingRange({ ...drag });
    onRangeChangeRef.current(day, day, period, period, drag.selected);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  return (
    <div className="day-period-selector" data-guide="day-periods">
      <div className="day-period-heading">
        <div>
          <strong>배정할 수업 교시 선택</strong>
        </div>
      </div>
      <div className="day-period-grid" role="group" aria-label="요일별 외부강의 가능 교시 선택">
        <div className="period-corner">교시</div>
        {DAYS.map((day) => (
          <div className="day-header" key={day}>
            <strong>{day}</strong>
            <span>{values[day].length > 0 ? `${values[day].length}개 선택` : "선택 안 함"}</span>
          </div>
        ))}
        {PERIODS.map((period) => [
          <div className="period-label" key={`label-${period}`}>{period}</div>,
          ...DAYS.map((day) => {
            const selected = values[day].includes(period);
            const firstDay = draggingRange
              ? Math.min(DAYS.indexOf(draggingRange.startDay), DAYS.indexOf(draggingRange.endDay))
              : -1;
            const lastDay = draggingRange
              ? Math.max(DAYS.indexOf(draggingRange.startDay), DAYS.indexOf(draggingRange.endDay))
              : -1;
            const dayIndex = DAYS.indexOf(day);
            const inDragRange = draggingRange !== null
              && dayIndex >= firstDay
              && dayIndex <= lastDay
              && period >= Math.min(draggingRange.startPeriod, draggingRange.endPeriod)
              && period <= Math.max(draggingRange.startPeriod, draggingRange.endPeriod);
            const dragClass = inDragRange
              ? draggingRange.selected ? "drag-filling" : "drag-clearing"
              : "";
            return (
              <button
                key={`${day}-${period}`}
                type="button"
                className={`${selected ? "selected" : ""} ${dragClass}`}
                data-day={day}
                data-period={period}
                aria-label={`${day}요일 ${period}교시 ${selected ? "선택됨" : "선택 안 됨"}`}
                aria-pressed={selected}
                onPointerDown={(event) => startDrag(day, period, event)}
                onPointerEnter={() => extendDrag(day, period)}
                onClick={(event) => {
                  if (skipClickRef.current) {
                    skipClickRef.current = false;
                    return;
                  }
                  onToggle(day, period);
                }}
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
  dayPeriods,
}: {
  result: ScheduleResult;
  dayPeriods: DayPeriodSelection;
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
        <strong>시간표를 만들지 못했어요.</strong>
        <p>{result.message}</p>
        {result.blockedClasses.length > 0 && (
          <p>다시 확인할 반: {result.blockedClasses.map((item) => `${item.grade}-${item.classNumber}`).join(", ")}</p>
        )}
      </div>
    );
  }

  const assignments = result.solutions[solutionIndex] ?? result.solutions[0];
  const lastUsedPeriod = Math.max(0, ...DAYS.flatMap((day) => dayPeriods[day]));
  const solutionCountLabel = result.truncated
    ? `${result.solutions.length}개 이상`
    : `${result.solutions.length}개`;

  async function copyCurrentSchedule() {
    const formats = scheduleToClipboardFormats(assignments, dayPeriods);
    try {
      await copyHtmlAndText(formats.html, formats.text);
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <div className="result-box success" data-guide="schedule-result">
      {copyStatus !== "idle" && (
        <p className={`copy-result-status ${copyStatus}`} role="status">
          {copyStatus === "success"
            ? "복사했어요. 엑셀이나 한글에서 Ctrl+V를 누르세요."
            : "복사하지 못했어요. 브라우저의 클립보드 권한을 확인해 주세요."}
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
      <div className="export-toolbar">
        <button
          className="export-copy-button"
          type="button"
          onClick={copyCurrentSchedule}
          aria-label="엑셀 또는 한글에 붙여넣을 표로 복사"
        >
          <span className="export-file-icons" aria-hidden="true">
            <span className="export-file-badge excel">X</span>
            <span className="export-file-badge hwp">한</span>
          </span>
          <span>엑셀·한글로 복사</span>
        </button>
      </div>
      <div className="table-scroll">
        <table className="result-table">
          <colgroup>
            <col style={{ width: "11.214%" }} />
            {DAYS.map((day) => <col key={day} style={{ width: "17.757%" }} />)}
          </colgroup>
          <thead>
            <tr><th>교시</th>{DAYS.map((day) => <th key={day}>{day}</th>)}</tr>
          </thead>
          <tbody>
            {PERIODS.filter((period) => period <= lastUsedPeriod).map((period) => (
              <tr key={period}>
                <th>{period}교시</th>
                {DAYS.map((day) => {
                  const assigned = assignments.filter(
                    (item) => item.day === day && item.periods.includes(period),
                  ).sort((a, b) => a.grade - b.grade || a.classNumber - b.classNumber);
                  return (
                    <td key={day} className={!dayPeriods[day].includes(period) ? "closed-slot" : ""}>
                      {assigned.map((item, index) => (
                        <span className="assignment-chip" key={`${item.grade}-${item.classNumber}`}>
                          {index > 0 && " / "}{item.grade}-{item.classNumber}
                        </span>
                      ))}
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

export default App;
