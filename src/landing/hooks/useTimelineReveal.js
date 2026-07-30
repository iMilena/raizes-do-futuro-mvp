import { useEffect, useRef, useState } from "react";

/**
 * Controla a revelação progressiva (fade-in) de cada etapa do
 * fluxo "A Solução" conforme o usuário rola a página, e calcula o
 * progresso (0 a 1) da linha vertical que conecta as etapas.
 *
 * Também mede onde exatamente fica o centro da primeira e da
 * última bolinha, para que a linha (track e progresso) comece e
 * termine exatamente nelas — sem "sobrar" pedaço de linha acima da
 * primeira etapa ou abaixo da última.
 *
 * @param {number} stepCount número de etapas do timeline
 */
export function useTimelineReveal(stepCount) {
  const containerRef = useRef(null);
  const [revealedSteps, setRevealedSteps] = useState([]);
  const [lineProgress, setLineProgress] = useState(0);
  const [trackBounds, setTrackBounds] = useState({
    top: 0,
    bottom: 0,
    span: 0,
  });

  useEffect(() => {
    const measureTrackBounds = (el) => {
      const circles = el.querySelectorAll(".timeline-step-circle");
      if (circles.length === 0) return { top: 0, bottom: 0, span: 0 };

      const containerRect = el.getBoundingClientRect();
      const firstRect = circles[0].getBoundingClientRect();
      const lastRect = circles[circles.length - 1].getBoundingClientRect();

      const top = firstRect.top + firstRect.height / 2 - containerRect.top;
      const bottom =
        containerRect.bottom - (lastRect.top + lastRect.height / 2);
      const span = Math.max(0, containerRect.height - top - bottom);

      return { top, bottom, span };
    };

    const run = () => {
      const el = containerRef.current;
      if (!el) return;

      const items = el.querySelectorAll("[data-step-index]");
      const vh = window.innerHeight;
      const revealed = [];
      items.forEach((item) => {
        const idx = Number(item.getAttribute("data-step-index"));
        if (item.getBoundingClientRect().top < vh * 0.85) revealed.push(idx);
      });

      const rect = el.getBoundingClientRect();
      const total = rect.height;
      const visible = Math.min(total, Math.max(0, vh * 0.85 - rect.top));
      const progress =
        total > 0 ? Math.max(0, Math.min(1, visible / total)) : 0;

      const bounds = measureTrackBounds(el);

      setRevealedSteps((prev) => {
        const same =
          prev.length === revealed.length &&
          revealed.every((v) => prev.includes(v));
        return same ? prev : revealed;
      });
      setLineProgress((prev) =>
        Math.abs(prev - progress) < 0.005 ? prev : progress,
      );
      setTrackBounds((prev) => {
        const same =
          Math.abs(prev.top - bounds.top) < 0.5 &&
          Math.abs(prev.bottom - bounds.bottom) < 0.5 &&
          Math.abs(prev.span - bounds.span) < 0.5;
        return same ? prev : bounds;
      });
    };

    let ticking = false;
    const onScrollOrResize = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        run();
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    onScrollOrResize();

    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepCount]);

  const isRevealed = (index) => revealedSteps.includes(index);
  const circleIsActive = (index) => lineProgress >= (index + 0.5) / stepCount;

  return {
    containerRef,
    isRevealed,
    circleIsActive,
    lineProgress,
    trackBounds,
  };
}
