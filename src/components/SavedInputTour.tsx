import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import CopyExample from "./CopyExample";

export type SavedInputTourStep = 0 | 1 | 2;

type SavedInputTourProps = {
  step: SavedInputTourStep;
  hasName: boolean;
  hasTimetable: boolean;
  onStepChange: (step: SavedInputTourStep) => void;
  onClose: () => void;
};

type TargetRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
};

const STEPS: Record<SavedInputTourStep, { target: string; label: string; title: string; description: string }> = {
  0: {
    target: "saved-name-input",
    label: "1 / 3",
    title: "시간표 이름을 입력하세요",
    description: "나중에 저장 목록에서 쉽게 찾을 수 있도록 시간표 이름을 입력해 주세요. 예: 4학년 전담 시간표",
  },
  1: {
    target: "saved-input-area",
    label: "2 / 3",
    title: "전담 시간표 입력하기",
    description: "한글이나 엑셀에서 표 전체를 복사해 위 칸에 붙여넣으세요. 전담 시간표가 여러 개라면 하나씩 붙여넣으면 한 표로 정리돼요. 직접 입력하려면 아래 ‘빈 시간표에 직접 입력’을 눌러 주세요.",
  },
  2: {
    target: "saved-save-button",
    label: "3 / 3",
    title: "시간표 저장하기",
    description: "표와 이름을 확인한 뒤 빨간 테두리 안의 저장 버튼을 눌러 주세요. 저장한 시간표는 다음부터 목록에서 선택해 쓸 수 있어요.",
  },
};

export default function SavedInputTour({
  step,
  hasName,
  hasTimetable,
  onStepChange,
  onClose,
}: SavedInputTourProps) {
  const content = STEPS[step];
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(250);
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
      setTargetRect({ top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom });
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
    const updateHeight = () => {
      const nextHeight = Math.ceil(tooltip.getBoundingClientRect().height);
      setTooltipHeight((current) => current === nextHeight ? current : nextHeight);
    };
    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(tooltip);
    return () => resizeObserver.disconnect();
  }, [step, targetRect]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!targetRect) return null;

  const outsideViewport = targetRect.bottom < 0 || targetRect.top > window.innerHeight || targetRect.right < 0 || targetRect.left > window.innerWidth;
  const highlightStyle: CSSProperties = {
    top: Math.max(6, targetRect.top - 6),
    left: Math.max(6, targetRect.left - 6),
    width: Math.max(0, Math.min(window.innerWidth - 6, targetRect.right + 6) - Math.max(6, targetRect.left - 6)),
    height: Math.max(0, Math.min(window.innerHeight - 6, targetRect.bottom + 6) - Math.max(6, targetRect.top - 6)),
    display: outsideViewport ? "none" : undefined,
  };
  const tooltipStyle = getTooltipStyle(targetRect, tooltipHeight);
  const canContinue = step === 0 ? hasName : step === 1 ? hasTimetable : true;

  return (
    <div className="guide-tour saved-input-tour" aria-live="polite">
      {outsideViewport && <div className="guide-full-dim" aria-hidden="true" />}
      <div className="guide-highlight" style={highlightStyle} aria-hidden="true" />
      <aside ref={tooltipRef} className="guide-tooltip" style={tooltipStyle} role="dialog" aria-label="시간표 만들기 안내">
        <div className="guide-tooltip-top">
          <span>{content.label}</span>
          <button type="button" onClick={onClose} aria-label="시간표 만들기 안내 종료">×</button>
        </div>
        <h3>{content.title}</h3>
        <p>{content.description}</p>
        {step === 1 && <CopyExample />}
        <div className="guide-actions">
          {step > 0 ? (
            <button className="guide-secondary" type="button" onClick={() => onStepChange((step - 1) as SavedInputTourStep)}>이전</button>
          ) : <span />}
          {step < 2 ? (
            <button className="guide-primary" type="button" disabled={!canContinue} onClick={() => onStepChange((step + 1) as SavedInputTourStep)}>다음</button>
          ) : (
            <button className="guide-primary" type="button" onClick={onClose}>확인</button>
          )}
        </div>
        {step === 0 && !hasName && <small>시간표 이름을 입력하면 다음 단계로 갈 수 있습니다.</small>}
        {step === 1 && !hasTimetable && <small>표를 붙여넣거나 빈 시간표를 추가하면 다음 단계로 갈 수 있습니다.</small>}
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
    if (top + tooltipHeight > window.innerHeight - 12) top = Math.max(12, rect.top - tooltipHeight - gap);
  }

  return {
    width,
    left: Math.max(12, Math.min(left, window.innerWidth - width - 12)),
    top: Math.max(12, Math.min(top, window.innerHeight - tooltipHeight - 12)),
  };
}
