import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";

export type TourStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type GuideTourProps = {
  step: TourStep;
  onStepChange: (step: TourStep) => void;
  onClose: () => void;
  onAddBlank: () => void;
  hasLessons: boolean;
  hasDayPeriods: boolean;
};

type TargetRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

const STEP_CONTENT: Record<TourStep, { target: string; label: string; title: string; description: string }> = {
  0: {
    target: "input",
    label: "1 / 6",
    title: "전담 시간표를 입력하세요",
    description: "한글이나 엑셀에서 요일과 교시를 포함한 표 전체를 복사하세요. 강조된 영역을 클릭해 파란색 ‘선택됨’ 상태로 만든 뒤 Ctrl+V를 누르세요. 시간표가 여러 개라면 모두 차례대로 붙여넣으면 됩니다.",
  },
  1: {
    target: "manual-input",
    label: "1 / 6 · 직접 입력",
    title: "빈 시간표에 직접 입력하세요",
    description: "요일과 교시는 이미 준비되어 있습니다. 각 칸에 ‘4-1 영어’처럼 학년-반과 과목을 입력하세요. 한 칸에 여러 수업이 있으면 줄을 바꿔 입력할 수 있습니다.",
  },
  2: {
    target: "recognition",
    label: "2 / 6",
    title: "인식 결과를 확인하세요",
    description: "앱이 찾은 학년, 반, 전담시간을 확인하세요. 잘못 인식된 내용은 위 시간표의 셀을 눌러 바로 고칠 수 있습니다.",
  },
  3: {
    target: "day-periods",
    label: "3 / 6",
    title: "요일별 마지막 교시를 선택하세요",
    description: "각 요일의 마지막 수업 교시를 누르세요. 예를 들어 월요일 5교시를 누르면 월요일 1~5교시가 수업 시간으로 지정됩니다.",
  },
  4: {
    target: "lecture-config",
    label: "4 / 6",
    title: "외부강의 조건을 정하세요",
    description: "각 반의 강의 시간과 동시에 수업하는 반 수를 선택하세요. 홀수 반이 남으면 마지막 타임에는 남은 반만 배정됩니다.",
  },
  5: {
    target: "schedule-button",
    label: "5 / 6",
    title: "자동 편성을 실행하세요",
    description: "강조된 자동 편성 버튼을 직접 눌러 주세요. 편성이 끝나면 결과 단계로 자동 이동합니다.",
  },
  6: {
    target: "schedule-result",
    label: "6 / 6",
    title: "편성 결과를 확인하세요",
    description: "여러 편성안은 이전과 다음 버튼으로 비교할 수 있습니다. 원하는 편성안을 고른 뒤 ‘엑셀·한글로 복사’를 누르면 다른 문서에 표로 붙여넣을 수 있습니다.",
  },
};

export default function GuideTour({
  step,
  onStepChange,
  onClose,
  onAddBlank,
  hasLessons,
  hasDayPeriods,
}: GuideTourProps) {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const content = STEP_CONTENT[step];

  useLayoutEffect(() => {
    const target = document.querySelector<HTMLElement>(`[data-guide="${content.target}"]`);
    if (!target) {
      setTargetRect(null);
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const updateRect = () => {
      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      });
    };

    const delayedUpdate = window.setTimeout(updateRect, 320);
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    const resizeObserver = new ResizeObserver(updateRect);
    resizeObserver.observe(target);

    return () => {
      window.clearTimeout(delayedUpdate);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
      resizeObserver.disconnect();
    };
  }, [content.target]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!targetRect) return null;

  const highlightStyle: CSSProperties = {
    top: Math.max(6, targetRect.top - 6),
    left: Math.max(6, targetRect.left - 6),
    width: Math.min(window.innerWidth - 12, targetRect.width + 12),
    height: Math.min(window.innerHeight - 12, targetRect.height + 12),
  };
  const tooltipStyle = getTooltipStyle(targetRect);
  const canContinue = step === 0 || step === 1
    ? hasLessons
    : step === 3
      ? hasDayPeriods
      : true;

  function goBack() {
    if (step === 1 || step === 2) onStepChange(0);
    else if (step > 2) onStepChange((step - 1) as TourStep);
  }

  function goNext() {
    if (step === 0 || step === 1) onStepChange(2);
    else if (step < 5) onStepChange((step + 1) as TourStep);
  }

  return (
    <div className="guide-tour" aria-live="polite">
      <div className="guide-highlight" style={highlightStyle} aria-hidden="true" />
      <aside className="guide-tooltip" style={tooltipStyle} role="dialog" aria-label="사용방법 안내">
        <div className="guide-tooltip-top">
          <span>{content.label}</span>
          <button type="button" onClick={onClose} aria-label="사용방법 종료">×</button>
        </div>
        <h3>{content.title}</h3>
        <p>{content.description}</p>
        {step === 0 && <CopyExample />}
        <div className="guide-actions">
          {step === 0 ? (
            <button className="guide-secondary" type="button" onClick={onAddBlank}>직접 입력하겠습니다</button>
          ) : step > 0 && step < 6 ? (
            <button className="guide-secondary" type="button" onClick={goBack}>이전</button>
          ) : <span />}

          {step < 5 && (
            <button className="guide-primary" type="button" disabled={!canContinue} onClick={goNext}>
              다음
            </button>
          )}
          {step === 5 && <span className="guide-action-hint">버튼을 직접 눌러주세요</span>}
          {step === 6 && <button className="guide-primary" type="button" onClick={onClose}>확인</button>}
        </div>
        {(step === 0 || step === 1) && !hasLessons && (
          <small>시간표에서 수업이 하나 이상 인식되면 다음 단계로 갈 수 있습니다.</small>
        )}
      </aside>
    </div>
  );
}

function CopyExample() {
  return (
    <div className="copy-example" aria-label="표 전체 선택 예시">
      <div className="copy-example-title">표 전체를 선택한 뒤 Ctrl + C</div>
      <div className="copy-example-previews">
        {["한글", "Excel"].map((name) => (
          <div className="copy-example-app" key={name}>
            <span>{name}</span>
            <div className="copy-example-grid">
              {Array.from({ length: 15 }, (_, index) => <i key={index} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getTooltipStyle(rect: TargetRect): CSSProperties {
  const width = Math.min(380, window.innerWidth - 24);
  const estimatedHeight = 390;
  const gap = 16;
  let left: number;
  let top: number;

  if (window.innerWidth - rect.right >= width + gap) {
    left = rect.right + gap;
    top = rect.top;
  } else if (rect.left >= width + gap) {
    left = rect.left - width - gap;
    top = rect.top;
  } else {
    left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    top = rect.bottom + gap;
    if (top + estimatedHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - estimatedHeight - gap);
    }
  }

  return {
    width,
    left: Math.max(12, Math.min(left, window.innerWidth - width - 12)),
    top: Math.max(12, Math.min(top, window.innerHeight - estimatedHeight - 12)),
  };
}
