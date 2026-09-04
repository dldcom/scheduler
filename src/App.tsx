import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import GuideTour, { type TourStep } from "./components/GuideTour";
import SavedInputTour, { type SavedInputTourStep } from "./components/SavedInputTour";
import {
  copyHtmlAndText,
  createBlankTimetableGrid,
  gridFromClipboard,
  scheduleToClipboardFormats,
} from "./lib/clipboard";
import { consolidateLessons, parseTimetableGrid } from "./lib/parser";
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
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [duration, setDuration] = useState<LectureDuration>(2);
  const [simultaneousClassCount, setSimultaneousClassCount] = useState(1);
  const [dayPeriods, setDayPeriods] = useState<DayPeriodSelection>(EMPTY_DAY_PERIODS);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [selectionMessage, setSelectionMessage] = useState("");
  const [guideStep, setGuideStep] = useState<TourStep | null>(null);
  const [savedTimetables, setSavedTimetables] = useState<SavedTimetable[]>([]);
  const [savedModalOpen, setSavedModalOpen] = useState(false);

  const lessons = useMemo(
    () => consolidateLessons(sources.flatMap((source) => source.parsed.lessons)),
    [sources],
  );
  const classes = useMemo(() => getClasses(lessons), [lessons]);
  const grades = useMemo(() => [...new Set(classes.map((item) => item.grade))], [classes]);
  const selectedTimetable = useMemo(
    () => savedTimetables.find((item) => item.id === selectedTimetableId) ?? null,
    [savedTimetables, selectedTimetableId],
  );

  useEffect(() => {
    const saved = readSavedTimetables();
    setSavedTimetables(saved);
    if (saved.length === 0) setSavedModalOpen(true);
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

  useEffect(() => {
    if (guideStep === 3 && result) setGuideStep(4);
  }, [guideStep, result]);

  function saveTimetable(item: SavedTimetable): boolean {
    const existing = savedTimetables.find((saved) => saved.name === item.name);
    const savedItem = existing ? { ...item, id: existing.id } : item;
    const next = [savedItem, ...savedTimetables.filter((saved) => saved.id !== savedItem.id)];
    if (!writeSavedTimetables(next)) return false;
    setSavedTimetables(next);
    return true;
  }

  function removeSavedTimetable(item: SavedTimetable): boolean {
    if (!window.confirm(`‘${item.name}’ 시간표를 삭제할까요?`)) return false;
    const next = savedTimetables.filter((saved) => saved.id !== item.id);
    if (!writeSavedTimetables(next)) return false;
    setSavedTimetables(next);
    return true;
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
    setSelectedGrade(null);
    setDayPeriods(EMPTY_DAY_PERIODS);
    setResult(null);
    setSelectionMessage("시간표가 선택되었습니다.");
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
      <header className="hero">
        <div>
          <h1>외부강의 편성 도우미</h1>
          <p className="hero-copy">
            전담 시간표를 선택하고 조건을 고르면, 비어 있는 시간에 외부강의를 배정할 수 있습니다.
          </p>
        </div>
        <button className="help-button" type="button" onClick={() => setGuideStep(0)}>사용방법</button>
      </header>

      <aside className="saved-sidebar">
        <button className="saved-sidebar-button" type="button" onClick={() => setSavedModalOpen(true)}>
          <span className="saved-sidebar-icon" aria-hidden="true">▣</span>
          <span>저장 목록</span>
        </button>
      </aside>

      <main>
        <section className="panel timetable-selection-panel" data-guide="timetable-select">
          <div className="section-heading timetable-selection-heading">
            <div>
              <span className="section-eyebrow">시작하기</span>
              <h2>전담 시간표를 선택하세요</h2>
              <p>저장 목록에서 이번에 사용할 전담 시간표를 골라 주세요.</p>
            </div>
            <button className="selection-open-button" type="button" onClick={() => setSavedModalOpen(true)}>
              저장 목록 열기
            </button>
          </div>

          {sources.length === 0 ? (
            <div className="timetable-selection-empty">
              <span className="timetable-selection-icon" aria-hidden="true">▣</span>
              <div>
                <strong>저장 목록에서 전담 시간표를 선택하세요.</strong>
                <p>아직 저장한 시간표가 없다면 저장 목록에서 표를 붙여넣거나 직접 입력해 저장할 수 있어요.</p>
              </div>
            </div>
          ) : (
            <div className="timetable-selection-selected" role="status">
              <span className="timetable-selection-check" aria-hidden="true">✓</span>
              <div>
                <strong>{selectedTimetable?.name ?? "전담 시간표"}</strong>
                <p>{selectionMessage || "시간표가 선택되었습니다."}</p>
              </div>
              <button className="selection-change-button" type="button" onClick={() => setSavedModalOpen(true)}>
                다른 시간표 선택
              </button>
            </div>
          )}
        </section>

        {sources.length > 0 && <section className="panel schedule-panel">
          <div className="section-heading">
            <span className="step">03</span>
            <div>
              <h2>외부강의 자동 편성</h2>
              <p>전담시간을 피해 외부강의를 넣을 수 있는 시간을 찾습니다.</p>
            </div>
          </div>

          <div className="schedule-grade-picker" data-guide="grade-picker">
            <span>편성할 학년</span>
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
              disabled={selectedGrade === null || !DAYS.some((day) => dayPeriods[day].length > 0)}
              onClick={runScheduler}
            >
              {selectedGrade ? `${selectedGrade}학년 자동 편성` : "자동 편성"}
            </button>
          </div>
          <p className="rule-note">
            반 수가 딱 나뉘지 않으면 남은 반은 따로 배정합니다. 예: 7개 반 ÷ 2개 반 → 2·2·2·1
          </p>
          {duration === 2 && <p className="rule-note">2교시 수업은 1~2, 3~4, 5~6교시 중 하나에 들어갑니다.</p>}

          {result && <ScheduleOutput result={result} grade={selectedGrade!} dayPeriods={dayPeriods} />}
        </section>}
      </main>

      <footer>입력한 시간표는 서버로 전송하지 않으며, 저장한 시간표는 이 브라우저에만 보관합니다.</footer>
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
          currentSources={sources}
          savedTimetables={savedTimetables}
          onClose={() => setSavedModalOpen(false)}
          onLoad={loadSavedTimetable}
          onSave={saveTimetable}
          onDelete={removeSavedTimetable}
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

function SavedTimetableWelcome({
  hasSavedTimetables,
  onNew,
}: {
  hasSavedTimetables: boolean;
  onNew: () => void;
}) {
  return (
    <div className="saved-editor saved-modal-welcome" role="status">
      <span className="saved-modal-welcome-icon" aria-hidden="true">{hasSavedTimetables ? "⌁" : "＋"}</span>
      <span className="section-eyebrow">{hasSavedTimetables ? "저장 목록에서 불러오기" : "처음 사용하시나요?"}</span>
      <h3>{hasSavedTimetables ? "시간표를 선택하세요." : "새로 입력 버튼을 눌러 시간표를 만드세요."}</h3>
      <p>
        {hasSavedTimetables
          ? "왼쪽 목록을 누르면 미리보기를 확인할 수 있어요. 사용할 시간표라면 미리보기에서 ‘선택’을 눌러 주세요."
          : "왼쪽 위 ‘새로 입력’ 버튼을 누르면 한글·엑셀 표를 붙여넣어 시간표를 만들 수 있어요."}
      </p>
      {!hasSavedTimetables && (
        <button className="saved-save-button saved-welcome-new-button" type="button" onClick={onNew}>새로 입력</button>
      )}
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
        <span className="section-eyebrow">미리보기</span>
        <h3>{item.name}</h3>
        <p>이 시간표를 확인한 뒤 사용하려면 아래 ‘선택’ 버튼을 눌러 주세요.</p>
      </div>
      <div className="selected-preview-list">
        {item.sources.map((source) => (
          <article className="selected-preview-card" key={`${item.id}-${source.name}`}>
            <div className="selected-preview-card-heading">
              <strong>{source.name}</strong>
              <span>전담 시간표</span>
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
        <button className="saved-cancel-button" type="button" onClick={onBack}>다른 시간표 보기</button>
        <button className="saved-save-button" type="button" onClick={onSelect}>선택</button>
      </div>
    </div>
  );
}

function SavedTimetableModal({
  currentSources,
  savedTimetables,
  onClose,
  onLoad,
  onSave,
  onDelete,
}: {
  currentSources: SourceTable[];
  savedTimetables: SavedTimetable[];
  onClose: () => void;
  onLoad: (item: SavedTimetable) => void;
  onSave: (item: SavedTimetable) => boolean;
  onDelete: (item: SavedTimetable) => boolean;
}) {
  const [draftName, setDraftName] = useState("");
  const [draftSources, setDraftSources] = useState<SourceTable[]>(() => cloneSourceTables(currentSources));
  const [previewItem, setPreviewItem] = useState<SavedTimetable | null>(null);
  const [modalView, setModalView] = useState<"welcome" | "create">("welcome");
  const [inputGuideStep, setInputGuideStep] = useState<SavedInputTourStep | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const rows = gridFromClipboard(
      event.clipboardData.getData("text/html"),
      event.clipboardData.getData("text/plain"),
    );
    if (rows.length === 0) {
      setMessage("표를 읽지 못했어요. 표 전체를 다시 복사해 주세요.");
      return;
    }

    const id = crypto.randomUUID();
    setDraftSources((current) => [
      ...current,
      {
        id,
        name: `전담 시간표 ${current.length + 1}`,
        rows,
        parsed: parseTimetableGrid(rows, id),
      },
    ]);
    setMessage(`시간표를 추가했어요. (${rows.length}행)`);
  }

  function addBlankSource() {
    const id = crypto.randomUUID();
    const rows = createBlankTimetableGrid();
    setDraftSources((current) => [
      ...current,
      {
        id,
        name: `직접 입력 시간표 ${current.length + 1}`,
        rows,
        parsed: parseTimetableGrid(rows, id),
      },
    ]);
    setMessage("빈 시간표를 추가했어요. 각 칸에 ‘4-1 영어’처럼 입력해 주세요.");
  }

  function updateCell(sourceId: string, rowIndex: number, columnIndex: number, value: string) {
    setDraftSources((current) => current.map((source) => {
      if (source.id !== sourceId) return source;
      const rows = source.rows.map((row) => [...row]);
      rows[rowIndex][columnIndex] = value;
      return { ...source, rows, parsed: parseTimetableGrid(rows, source.id) };
    }));
  }

  function renameSource(sourceId: string, name: string) {
    setDraftSources((current) => current.map((source) => source.id === sourceId ? { ...source, name } : source));
  }

  function removeSource(sourceId: string) {
    setDraftSources((current) => current.filter((source) => source.id !== sourceId));
  }

  function startNewDraft() {
    setPreviewItem(null);
    setModalView("create");
    setInputGuideStep(0);
    setDraftName("");
    setDraftSources([]);
    setMessage("새 시간표를 입력해 주세요.");
  }

  function deleteSavedItem(item: SavedTimetable) {
    if (onDelete(item) && previewItem?.id === item.id) setPreviewItem(null);
  }

  function showSavedPreview(item: SavedTimetable) {
    setPreviewItem(item);
    setModalView("welcome");
    setMessage("");
  }

  function saveDraft() {
    const name = draftName.trim();
    if (!name) {
      setMessage("저장할 이름을 먼저 입력해 주세요.");
      return;
    }
    if (draftSources.length === 0) {
      setMessage("시간표를 하나 이상 넣어 주세요.");
      return;
    }

    const saved = onSave({
      id: crypto.randomUUID(),
      name,
      savedAt: Date.now(),
      sources: draftSources.map((source) => ({
        name: source.name,
        rows: source.rows.map((row) => [...row]),
      })),
    });
    setMessage(saved ? "저장했어요. 왼쪽 목록에서 미리본 뒤 선택할 수 있습니다." : "저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.");
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
          <div>
            <span>시간표 보관함</span>
            <h2 id="saved-modal-title">시간표 만들기</h2>
            <p>전담 시간표를 입력하고 이름을 붙여 저장해 두세요.</p>
          </div>
          <button className="saved-modal-close" type="button" onClick={onClose} aria-label="저장 목록 닫기">×</button>
        </header>

        <div className="saved-modal-body">
          <aside className="saved-list-panel" aria-label="저장된 시간표 목록">
            <div className="saved-list-heading">
              <div>
                <strong>저장 목록</strong>
                <span>{savedTimetables.length}개</span>
              </div>
              <button type="button" onClick={startNewDraft}>새로 입력</button>
            </div>
            {savedTimetables.length === 0 ? (
              <p className="saved-list-empty">아직 저장한 시간표가 없어요.</p>
            ) : (
              <div className="saved-list-items">
                {savedTimetables.map((item) => (
                  <div className="saved-list-item" key={item.id}>
                    <button
                      className={`saved-list-load${previewItem?.id === item.id ? " previewing" : ""}`}
                      type="button"
                      aria-label={`${item.name} 미리보기`}
                      onClick={() => showSavedPreview(item)}
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
          ) : modalView === "create" ? <div className="saved-editor">
            <div className="saved-editor-heading">
              <label>
                <span>저장할 이름</span>
                <input
                  data-guide="saved-name-input"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="예: 4학년 전담 시간표"
                  maxLength={60}
                />
              </label>
              <p>현재 화면에 입력된 시간표가 있으면 미리 담아 두었어요.</p>
            </div>

            <div className="saved-input-area" data-guide="saved-input-area" aria-label="전담 시간표 입력">
              <div
                className="paste-zone saved-paste-zone"
                tabIndex={0}
                role="textbox"
                aria-label="저장할 전담 시간표 붙여넣기"
                onPaste={handlePaste}
              >
                <span className="paste-icon" aria-hidden="true">⌘</span>
                <strong>클릭한 뒤 Ctrl + V</strong>
                <span>시간표가 여러 개라면 이어서 붙여넣으세요.</span>
              </div>
              <div className="input-alternative">
                <span>또는</span>
                <button type="button" onClick={addBlankSource}>빈 시간표에 직접 입력</button>
              </div>
            </div>
            {message && <p className="saved-message" role="status">{message}</p>}

            <div className="source-list saved-source-list">
              {draftSources.map((source) => (
                <SourcePreview
                  key={source.id}
                  source={source}
                  onCellChange={updateCell}
                  onNameChange={renameSource}
                  onRemove={removeSource}
                />
              ))}
              {draftSources.length === 0 && <p className="saved-editor-empty">시간표를 붙여넣거나 직접 입력해 주세요.</p>}
            </div>

            <div className="saved-editor-actions">
              <button className="saved-cancel-button" type="button" onClick={onClose}>닫기</button>
              <button className="saved-save-button" data-guide="saved-save-button" type="button" onClick={saveDraft} disabled={!draftName.trim() || draftSources.length === 0}>이름을 정하고 저장</button>
            </div>
          </div> : (
            <SavedTimetableWelcome
              hasSavedTimetables={savedTimetables.length > 0}
              onNew={startNewDraft}
            />
          )}
        </div>
      </section>
      {modalView === "create" && inputGuideStep !== null && (
        <SavedInputTour
          step={inputGuideStep}
          hasName={draftName.trim().length > 0}
          hasTimetable={draftSources.length > 0}
          onStepChange={setInputGuideStep}
          onClose={() => setInputGuideStep(null)}
        />
      )}
    </div>
  );
}

function cloneSourceTables(sourceTables: SourceTable[]): SourceTable[] {
  return sourceTables.map((source) => {
    const id = crypto.randomUUID();
    const rows = source.rows.map((row) => [...row]);
    return { id, name: source.name, rows, parsed: parseTimetableGrid(rows, id) };
  });
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
          <strong>요일별 수업 교시</strong>
          <p>가능한 교시를 누르세요. 여러 교시를 드래그해서 한 번에 선택하거나 지울 수 있어요.</p>
        </div>
        <span>선택한 교시에서만 외부강의를 배정합니다.</span>
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
  grade,
  dayPeriods,
}: {
  result: ScheduleResult;
  grade: number;
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
      <div className="result-heading">
        <div>
          <span>편성 완료</span>
          <h3>{grade}학년 외부강의 시간표</h3>
        </div>
      </div>
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
