import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import CopyExample from "./CopyExample";

export type TourStep = 0 | 1 | 2;

type GuideTourProps = {
  step: TourStep;
  onStepChange: (step: TourStep) => void;
  onClose: () => void;
  onOpenSaved: () => void;
  hasLessons: boolean;
  hasDayPeriods: boolean;
};

type GuideStep = {
  target: string;
  label: string;
  title: string;
  description: string;
  showCopyExample?: boolean;
  action: "next" | "confirm";
};

type TargetRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    target: "timetable-input",
    label: "1 / 3",
    title: "전담 시간표 가져오기",
    description: "한글이나 엑셀에서 표 전체를 복사해 아래 영역에 붙여넣으세요. 전담 시간표가 여러 개라면 차례대로 추가할 수 있어요.",
    showCopyExample: true,
    action: "next",
  },
  {
    target: "day-periods",
    label: "2 / 3",
    title: "배정할 수업 교시 선택",
    description: "외부강의를 넣을 수 있는 교시를 선택하세요. 필요한 경우 여러 칸을 드래그해서 한 번에 선택할 수 있습니다.",
    action: "next",
  },
  {
    target: "lecture-config",
    label: "3 / 3",
    title: "강의 조건을 정하고 결과표 만들기",
    description: "강의시간과 동시에 수업하는 반 수를 정한 뒤 ‘결과표 만들기’를 누르면 외부강의 시간표가 만들어집니다.",
    action: "confirm",
  },
] as const;

export default function GuideTour({
  step,
  onStepChange,
  onClose,
  onOpenSaved,
  hasLessons,
  hasDayPeriods,
}: GuideTourProps) {
  const content = GUIDE_STEPS[step];
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(390);
  const tooltipRef = useRef<HTMLElement>(null);

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

    updateRect();
    const delayedUpdate = window.setTimeout(updateRect, 180);
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
  const targetOutsideViewport = targetRect.bottom < 0
    || targetRect.top > window.innerHeight
    || targetRect.right < 0
    || targetRect.left > window.innerWidth;
  const highlightStyle: CSSProperties = {
    top: visibleTop,
    left: visibleLeft,
    width: Math.max(0, visibleRight - visibleLeft),
    height: Math.max(0, visibleBottom - visibleTop),
    display: targetOutsideViewport ? "none" : undefined,
  };
  const canContinue = step === 0 ? hasLessons : step === 1 ? hasDayPeriods : true;

  function goBack() {
    if (step > 0) onStepChange((step - 1) as TourStep);
  }

  function goNext() {
    if (step < GUIDE_STEPS.length - 1) onStepChange((step + 1) as TourStep);
  }

  return (
    <div className="guide-tour" aria-live="polite">
      {targetOutsideViewport && <div className="guide-full-dim" aria-hidden="true" />}
      <div className="guide-highlight" style={highlightStyle} aria-hidden="true" />
      <aside
        ref={tooltipRef}
        className="guide-tooltip"
        style={getTooltipStyle(targetRect, tooltipHeight)}
        role="dialog"
        aria-modal="true"
        aria-label="사용방법 안내"
      >
        <div className="guide-tooltip-top">
          <span>{content.label}</span>
          <button type="button" onClick={onClose} aria-label="사용방법 종료">×</button>
        </div>
        <h3>{content.title}</h3>
        <p>{content.description}</p>
        {content.showCopyExample && <CopyExample />}
        <div className="guide-actions">
          {step === 0 ? (
            <button className="guide-secondary" type="button" onClick={onOpenSaved}>저장 목록에서 불러오기</button>
          ) : (
            <button className="guide-secondary" type="button" onClick={goBack}>이전</button>
          )}
          {content.action === "next" ? (
            <button className="guide-primary" type="button" disabled={!canContinue} onClick={goNext}>다음</button>
          ) : (
            <button className="guide-primary" type="button" onClick={onClose}>확인</button>
          )}
        </div>
        {step === 0 && !hasLessons && <small>표를 붙여넣거나 직접 작성하면 다음 단계로 갈 수 있습니다.</small>}
        {step === 1 && !hasDayPeriods && <small>배정할 교시를 하나 이상 선택하면 다음 단계로 갈 수 있습니다.</small>}
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
