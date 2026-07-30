import { useEffect, useRef, useState } from 'react';

/**
 * Anima um progresso de 0 a 1 (com easing) assim que o elemento
 * referenciado entra na viewport. Use `progress` para interpolar
 * os valores exibidos (ex: Math.round(target * progress)).
 *
 * @param {number} duration duração da animação em ms
 */
export function useCountUp(duration = 1400) {
  const ref = useRef(null);
  const [progress, setProgress] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const animate = () => {
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setProgress(eased);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const checkAndRun = () => {
      const el = ref.current;
      if (!el || hasAnimated.current) return;
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.9 && rect.bottom > 0) {
        hasAnimated.current = true;
        animate();
      }
    };

    let ticking = false;
    const onScrollOrResize = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        checkAndRun();
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    onScrollOrResize();

    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  return { ref, progress };
}
