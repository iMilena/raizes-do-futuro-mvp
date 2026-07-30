import { LeafIcon } from '../icons/Icons';
import { intro, statsData } from '../data/content';
import { useCountUp } from '../hooks/useCountUp';

export function Intro() {
  const { ref, progress } = useCountUp(1400);

  return (
    <div id="o-problema" className="intro">
      <LeafIcon filled size={120} color="#2E5A3E" className="intro-leaf intro-leaf--left" />
      <LeafIcon filled size={110} color="#2E5A3E" className="intro-leaf intro-leaf--right" />

      <p className="intro-text">{intro.text}</p>

      <div ref={ref} className="intro-stats">
        {statsData.map((stat) => {
          const value = Math.round(stat.target * progress);
          return (
            <div key={stat.label}>
              <div className="intro-stat-value">
                {value}
                {stat.suffix}
              </div>
              <div className="intro-stat-label">{stat.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
