import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import CopyExample from "./CopyExample";

export type TourStep = 0 | 1 | 2 | 3 | 4;

type GuideTourProps = {
  step: TourStep;
  onStepChange: (step: TourStep) => void;
  onClose: () => void;
  onOpenSaved: () => void;
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
    target: "timetable-select",
    label: "1 / 5",
    title: "전담 시간표 선택",
    description: "왼쪽 저장 목록에서 이번에 사용할 전담 시간표를 선택합니다. 아직 저장한 시간표가 없다면 저장 목록을 열어 표를 붙여넣거나 직접 입력해 저장해 주세요.",
  },
  1: {
    target: "day-periods",
    label: "2 / 5",
    title: "요일별 가능 교시 선택",
    description: "외부강의를 넣을 수 있는 교시를 눌러 선택합니다. 여러 교시를 드래그해서 한 번에 선택하거나 지울 수 있어요.",
  },
  2: {
    target: "lecture-config",
    label: "3 / 5",
    title: "강의 조건 선택",
    description: "수업 길이와 한 번에 함께 듣는 반 수를 정합니다. 반이 남으면 마지막 시간에는 남은 반만 들어가요.",
  },
  3: {
    target: "schedule-button",
    label: "4 / 5",
    title: "시간표 만들기",
    description: "자동 편성 버튼을 눌러 주세요. 시간표가 만들어지면 결과로 바로 넘어갑니다.",
  },
  4: {
    target: "schedule-result",
    label: "5 / 5",
    title: "결과 확인",
    description: "편성안이 여러 개라면 이전·다음으로 비교해 보세요. 마음에 드는 편성안을 고른 뒤 ‘엑셀·한글로 복사’를 누르면 됩니다.",
  },
};

export default function GuideTour({
  step,
  onStepChange,
  onClose,
  onOpenSaved,
  hasLessons,
  hasDayPeriods,
}: GuideTourProps) {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(390);
  const tooltipRef = useRef<HTMLElement>(null);
  const content = STEP_CONTENT[step];

  useLayoutEffect(() => {
    const target = document.querySelector<HTMLElement>(`[data-guide="${content.target}"]`);
    if (!target) {
      setTargetRect(null);
      return;
    }

    target.scrollIntoView({ behavior: "auto", block: "center" });
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

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    const updateTooltipHeight = () => {
      const nextHeight = Math.ceil(tooltip.getBoundingClientRect().height);
      setTooltipHeight((current) => current === nextHeight ? current : nextHeight);
    };
    updateTooltipHeight();
    const resizeObserver = new ResizeObserver(updateTooltipHeight);
    resizeObserver.observe(tooltip);
    return () => resizeObserver.disconnect();
  }, [targetRect, step]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!targetRect) return null;

  const visibleTop = Math.max(6, targetRect.top - 6);
  const visibleLeft = Math.max(6, targetRect.left - 6);
  const visibleBottom = Math.min(window.innerHeight - 6, targetRect.bottom + 6);
  const visibleRight = Math.min(window.innerWidth - 6, targetRect.right + 6);
  const targetOutsideViewport = targetRect.bottom < 0 || targetRect.top > window.innerHeight || targetRect.right < 0 || targetRect.left > window.innerWidth;
  const highlightStyle: CSSProperties = {
    top: visibleTop,
    left: visibleLeft,
    width: Math.max(0, visibleRight - visibleLeft),
    height: Math.max(0, visibleBottom - visibleTop),
    display: targetOutsideViewport ? "none" : undefined,
  };
  const tooltipStyle = getTooltipStyle(targetRect, tooltipHeight);
  const canContinue = step === 0 ? hasLessons : step === 1 ? hasDayPeriods : true;

  function goBack() {
    if (step > 0) onStepChange((step - 1) as TourStep);
  }

  function goNext() {
    if (step < 3) onStepChange((step + 1) as TourStep);
  }

  return (
    <div className="guide-tour" aria-live="polite">
      {targetOutsideViewport && <div className="guide-full-dim" aria-hidden="true" />}
      <div className="guide-highlight" style={highlightStyle} aria-hidden="true" />
      <aside ref={tooltipRef} className="guide-tooltip" style={tooltipStyle} role="dialog" aria-label="사용방법 안내">
        <div className="guide-tooltip-top">
          <span>{content.label}</span>
          <button type="button" onClick={onClose} aria-label="사용방법 종료">×</button>
        </div>
        <h3>{content.title}</h3>
        <p>{content.description}</p>
        {step === 0 && <CopyExample />}
        <div className="guide-actions">
          {step === 0 ? (
            <button className="guide-secondary" type="button" onClick={onOpenSaved}>저장 목록 열기</button>
          ) : step > 0 && step < 4 ? (
            <button className="guide-secondary" type="button" onClick={goBack}>이전</button>
          ) : <span />}

          {step < 3 && (
            <button className="guide-primary" type="button" disabled={!canContinue} onClick={goNext}>
              다음
            </button>
          )}
          {step === 3 && <span className="guide-action-hint">자동 편성 버튼을 눌러 주세요</span>}
          {step === 4 && <button className="guide-primary" type="button" onClick={onClose}>확인</button>}
        </div>
        {step === 0 && !hasLessons && (
          <small>저장 목록에서 시간표를 선택하면 다음 버튼이 켜집니다.</small>
        )}
      </aside>
    </div>
  );
}

function getTooltipStyle(rect: TargetRect, tooltipHeight: number): CSSProperties {
  const width = Math.min(380, window.innerWidth - 24);
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
    if (top + tooltipHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - tooltipHeight - gap);
    }
  }

  return {
    width,
    left: Math.max(12, Math.min(left, window.innerWidth - width - 12)),
    top: Math.max(12, Math.min(top, window.innerHeight - tooltipHeight - 12)),
  };
}
