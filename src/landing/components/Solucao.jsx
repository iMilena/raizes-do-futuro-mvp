import { solucao, timelineData } from '../data/content';
import { useTimelineReveal } from '../hooks/useTimelineReveal';

export function Solucao() {
  const { containerRef, isRevealed, circleIsActive, lineProgress, trackBounds } =
    useTimelineReveal(timelineData.length);

  return (
    <div id="a-solucao" className="solucao">
      <div className="solucao-header">
        <div className="solucao-label">{solucao.label}</div>
        <h2 className="solucao-title">{solucao.title}</h2>
      </div>

      <div ref={containerRef} className="timeline">
        <div
          className="timeline-track"
          style={{ top: trackBounds.top, bottom: trackBounds.bottom }}
        />
        <div
          className="timeline-progress"
          style={{
            top: trackBounds.top,
            height: `${lineProgress * trackBounds.span}px`,
          }}
        />

        {timelineData.map((step, index) => {
          const isLeft = index % 2 === 0;
          const revealed = isRevealed(index);
          const side = isLeft ? 'left' : 'right';

          return (
            <div
              key={step.title}
              data-step-index={index}
              className={`timeline-step timeline-step--${side}`}
            >
              <div
                className={
                  `timeline-step-content timeline-step-content--${side} ` +
                  (revealed
                    ? 'timeline-step-content--visible'
                    : 'timeline-step-content--hidden')
                }
              >
                <div className="timeline-step-title">{step.title}</div>
                <div className="timeline-step-text">{step.text}</div>
              </div>
              <div
                className={
                  'timeline-step-circle' +
                  (circleIsActive(index) ? ' timeline-step-circle--active' : '')
                }
              >
                {index + 1}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}