import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

export type SavedInputTourStep = 0 | 1 | 2;

type SavedInputTourProps = {
  step: SavedInputTourStep;
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
    target: "saved-paste-zone",
    label: "1 / 3",
    title: "표를 복사해 붙여넣기",
    description: "한글이나 엑셀에서 시간표의 셀을 모두 선택해 Ctrl+C를 누른 뒤, 빨간 테두리 안의 붙여넣기 칸을 클릭하고 Ctrl+V를 눌러 주세요.",
  },
  1: {
    target: "saved-name-input",
    label: "2 / 3",
    title: "시간표 이름 정하기",
    description: "나중에 찾기 쉽도록 학년이나 용도를 넣어 이름을 정해 주세요. 예: 4학년 전담 시간표",
  },
  2: {
    target: "saved-save-button",
    label: "3 / 3",
    title: "시간표 저장하기",
    description: "표와 이름을 확인한 뒤 빨간 테두리 안의 저장 버튼을 눌러 주세요. 저장한 시간표는 다음부터 목록에서 선택해 쓸 수 있어요.",
  },
};

export default function SavedInputTour({ step, hasTimetable, onStepChange, onClose }: SavedInputTourProps) {
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
  const canContinue = step !== 0 || hasTimetable;

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
        {step === 0 && !hasTimetable && <small>시간표를 붙여넣거나 빈 시간표를 추가하면 다음 버튼이 켜집니다.</small>}
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
